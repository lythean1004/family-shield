/**
 * 스킬 서버 판별 핸들러 (PRD 13-3, F4-5~F4-6)
 *
 * 흐름:
 *   1. 토큰 검사 → 403
 *   2. utterance 파싱 → 400
 *   3. call_in_progress / called_before 화면 입력 파싱
 *   4. pipeline.analyze() → 판정
 *   5. 카카오 응답 포맷 생성
 *
 * 시간 예산: 카카오 5초 제한 중 소켓·파싱에 ~200ms 쓰고 ~4.8초가 남는다.
 * AI 타임아웃을 3초로 두면 규칙 결과 + 응답 조립에 충분한 여유가 있다.
 *
 * 이 파일은 Node built-in `http` 서버와 독립 함수 두 가지로 쓸 수 있다.
 * 테스트에서는 handleRequest()를 직접 가져다 쓴다.
 */
import { MAX_INPUT_CHARS } from "../../packages/core/src/pipeline.js";
import { analyzeCounted, createSignalMetrics } from './signal-metrics.js';
import { createMemoryResultStore, redactToken, toResultView } from "../../packages/core/src/result-token.js";
import { createSafeBrowsingChecker } from "../../packages/core/src/url-reputation.js";
import { loadPhishingListChecker, combineCheckers } from "../../packages/core/src/phishing-list.js";
import { createDomainAgeChecker } from "../../packages/core/src/domain-age.js";
import { readRequest, simpleText, quickReply } from "./kakao.js";
import { summarizePhrases } from "../../packages/core/src/summarizer.js";
import { CHECK_LEVEL_TEXT, HEALTH_SKIPPED_TEXT } from "../../packages/core/src/fixed-text.js";
import { tokenMatches } from "./config.js";
import { createRateLimiter, createConcurrencyLimit, clientKey } from "./rate-limit.js";
import { createDatabase } from './database.js';
import { createAuth, checkBrowserRequest } from './auth.js';
import { createAuthApi } from './auth-api.js';
import { createDbResultStore, createReceipts, createCheckRecorder } from './results.js';
import { createConfirmService } from './confirm.js';
import { createFamilyApi } from './family-api.js';
import { createPushService, createPushApi } from './push.js';

const HEADER_TOKEN_KEY = "x-skill-token";
const MAX_BODY_BYTES = 64 * 1024;

// ── 고정 안내 문구 (PRD 9-10) ────────────────────────────────────────────────
const FIXED = {
  ERROR: "지금은 확인이 어렵습니다. 잠시 후 다시 시도하거나 가족에게 직접 물어보세요.",
  TOO_SHORT: "판별할 문자 내용을 붙여 넣어 주세요.",
  CALL_IN_PROGRESS: "지금 바로 전화를 끊으세요.\n전화를 끊은 뒤 직접 찾은 공식 번호로 다시 확인하세요.\n악성 앱이 있다면 비행기 모드 후 가족에게 연락하세요.",
  // F4-8 한계 문구: project.md 문장 그대로(2026-11-11 운영자 결정 B). "메시지 속 번호·링크가 아닌"을 빼지 않는다
  DISCLAIMER: "\n\n이 결과는 참고용입니다. 정상 메시지를 위험으로 보거나 위험한 메시지를 놓칠 수 있습니다. " +
    "확실하지 않으면 메시지 속 번호나 링크가 아닌, 직접 찾은 공식 번호로 확인하세요.",
};

const LEVEL_TEXT = {
  위험: "⚠️ 위험",
  주의: "⚡ 주의",
  확인필요: "🔍 확인 필요",
};

/**
 * 판정 결과를 카카오 응답 텍스트로 변환한다.
 * R1(통화 중)은 끊기 안내를 첫 줄에, 나머지 설명을 그 뒤에 붙이고 한계 문구로 닫는다.
 * 확인 필요는 정해 둔 문장, 그 밖에는 explanation이 있으면 붙이고, 없으면 신호 요약을 쓴다.
 */
/** 링크 규칙과 그 신호: 규칙이 실제로 위험을 냈을 때만 AI 설명과 별개로 이유를 보여 준다 */
const LINK_RULE_SIGNALS = { R10: ["SIG_MALICIOUS_URL", "SIG_SB_UNSAFE_URL"], R11: ["SIG_LOOKALIKE_DOMAIN"], R12: ["SIG_NEW_DOMAIN"] };
/** Google Safe Browsing 이용 규칙: Google 경고에는 출처 표시와 안내 링크를 붙인다(다른 출처 경고에는 붙이지 않는다) */
const GOOGLE_ATTRIBUTION = "Advisory provided by Google";
const GOOGLE_ADVISORY_URL = "https://developers.google.com/safe-browsing/v4/advisory";
const hasGoogleWarning = (result) => (result.signals_final ?? []).includes("SIG_SB_UNSAFE_URL");

function buildReplyText(result) {
  const lvl = LEVEL_TEXT[result.level] ?? result.level;
  const lines = [];

  // 통화 중 R1이면 끊기 안내를 가장 먼저(F4-4). 이후 나머지 안내도 함께 표시.
  if (result.fired_rules?.includes("R1")) {
    lines.push(FIXED.CALL_IN_PROGRESS);
  }

  lines.push(`[${lvl}]`);

  if (result.level === "확인필요") {
    // AI 설명은 ‘안전’으로 읽힐 수 있어 쓰지 않는다. 웹과 같은 정해 둔 문장
    lines.push(CHECK_LEVEL_TEXT);
  } else if (result.explanation_for_parent?.length) {
    // 링크 규칙(R10 목록 일치, R11 공식 주소 흉내, R12 새 도메인+요구)은 AI가 모르는 이유라 AI 설명만으로는 위험한 까닭이 안 보인다.
    // 이 경우 정해 둔 신호 문구를 먼저 붙인다(2026-11-11 카카오 시험).
    const present = new Set(result.signals_final ?? []);
    const linkReasons = summarizePhrases((result.fired_rules ?? []).flatMap((r) => LINK_RULE_SIGNALS[r] ?? []).filter((id) => present.has(id)));
    if (linkReasons.length) lines.push(`위험 이유: ${linkReasons.join(" · ")}`);
    lines.push(...result.explanation_for_parent);
  } else if (result.summary) {
    lines.push(`감지된 신호: ${result.summary}`);
  }

  // 작업 ⑦: 건강 관련 안내라 해외 AI로 보내지 않은 경우
  if (result.ai_skipped === "health") lines.push(HEALTH_SKIPPED_TEXT);
  if (hasGoogleWarning(result)) lines.push(GOOGLE_ATTRIBUTION);
  lines.push(FIXED.DISCLAIMER); // F4-8: 모든 결과 화면에 한계 문구
  return lines.join("\n");
}

/**
 * 판정에 맞는 빠른 버튼을 만든다.
 * D25: 가족방패는 먼저 링크를 보내지 않으므로 webLink는 사용자 요청 버튼만 허용.
 * D34: [자세히 보기]는 1회용 토큰 주소(/check/result?t=…). 저장소가 없으면 버튼을 만들지 않는다.
 */
async function buildQuickReplies(result, webBaseUrl, resultStore) {
  const replies = [];
  if (result.level === "위험" || result.level === "주의") {
    replies.push(quickReply.message("이미 당했어요", "이미 당했어요"));
  }
  if (webBaseUrl && resultStore) {
    try {
      const token = await resultStore.put(result);
      replies.push(quickReply.webLink("자세히 보기", `${webBaseUrl}/check/result?t=${token}`));
    } catch { /* The already computed verdict remains available if DB storage fails. */ }
  }
  // Google 출처 표시의 안내 링크(부모님이 누를 때만 열림, D25 답변 버튼)
  if (hasGoogleWarning(result)) replies.push(quickReply.webLink("Google 안내", GOOGLE_ADVISORY_URL));
  replies.push(quickReply.message("처음으로", "처음으로"));
  return replies;
}

/**
 * HTTP 요청 바디를 읽는다. MAX_BODY_BYTES를 넘으면 null을 반환한다.
 * @param {import("node:http").IncomingMessage} req
 */
function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { req.destroy(); resolve(null); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(size <= MAX_BODY_BYTES ? Buffer.concat(chunks).toString("utf8") : null));
    req.on("error", () => resolve(null));
  });
}

/**
 * 핵심 판별 로직 — 테스트에서 직접 호출한다.
 *
 * @param {{ utterance: string, parentInputs?: object }} params
 * @param {{ ai: object, hmacKey?: string|null, cards?: object[], webBaseUrl?: string|null,
 *           resultStore?: ReturnType<typeof createMemoryResultStore>|null }} cfg
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleRequest(params, cfg) {
  const { utterance, parentInputs = {} } = params;

  if (!utterance || utterance.trim().length < 2) {
    return { status: 200, body: simpleText(FIXED.TOO_SHORT) };
  }

  // R1 빠른 경로: 통화 중이면 AI 없이 즉시 반환
  if (parentInputs.call_in_progress) {
    cfg.signalMetrics?.record({ rules: ['R1'], status: 'fast_path', elapsedMs: 0 });
    return {
      status: 200,
      // F4-4 끊기 안내가 첫 줄, F4-8 한계 문구는 빠른 경로에도 붙인다
      body: simpleText(FIXED.CALL_IN_PROGRESS + FIXED.DISCLAIMER, [quickReply.message("도움이 필요해요", "도움이 필요해요")]),
    };
  }

  let result;
  try {
    result = await analyzeCounted({
      text: utterance,
      parentInputs,
      hmacKey: cfg.hmacKey ?? undefined,
      cards: cfg.cards ?? [],
      ai: cfg.ai,
      urlReputation: cfg.urlReputation ?? null,
      domainAge: cfg.domainAge ?? null,
    }, cfg.signalMetrics);
  } catch (err) {
    console.error('pipeline error');
    return { status: 200, body: simpleText(FIXED.ERROR) };
  }

  const text = buildReplyText(result);
  const replies = await buildQuickReplies(result, cfg.webBaseUrl, cfg.resultStore ?? null);
  return { status: 200, body: simpleText(text, replies) };
}

/**
 * GET /api/result?t=… — 1회용 토큰으로 판별 결과 조회(PRD 13-4).
 * 성공: 200 { ok: true, result }  /  만료·사용됨·없음: 410 { ok: false, reason }
 * 응답은 캐시하지 않는다(no-store).
 */
export function handleResultLookup(token, resultStore) {
  if (!resultStore) return { status: 410, body: { ok: false, reason: "missing" } };
  const r = resultStore.redeem(token);
  if (r?.then) return r.then(value => value.ok
    ? {status:200,body:{ok:true,result:value.result}}
    : {status:410,body:{ok:false,reason:value.reason}});
  return r.ok
    ? { status: 200, body: { ok: true, result: r.result } }
    : { status: 410, body: { ok: false, reason: r.reason } };
}

/**
 * POST /api/analyze — 웹 직접 입력(PRD F4-1). 카카오 포맷이 아닌 JSON { text } 를 받는다.
 * token 헤더 검사는 하지 않는다(웹은 공개 화면). 대신 호출 한도(F4-9)가 걸려 있다.
 *
 * 요청: { "text": string }
 * 응답 200: { ok: true, result: <toResultView> }
 * 응답 400: { ok: false, reason: "empty"|"too_long" }
 * 응답 429: { ok: false, reason: "rate_limited", retryAfterMs }
 *
 * @param {{ text: string, parentInputs?: object }} params
 * @param {{ ai: object, hmacKey?: string|null, cards?: object[], urlReputation?: object|null }} cfg
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleAnalyze(params, cfg) {
  const text = typeof params.text === "string" ? params.text : "";
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return { status: 400, body: { ok: false, reason: "empty" } };
  }
  if ([...text].length > MAX_INPUT_CHARS) {
    return { status: 400, body: { ok: false, reason: "too_long" } };
  }

  let result;
  try {
    result = await analyzeCounted({
      text,
      parentInputs: params.parentInputs ?? {},
      hmacKey: cfg.hmacKey ?? undefined,
      cards: cfg.cards ?? [],
      ai: cfg.ai,
      urlReputation: cfg.urlReputation ?? null,
      domainAge: cfg.domainAge ?? null,
    }, cfg.signalMetrics);
  } catch (err) {
    console.error('pipeline error');
    return { status: 500, body: { ok: false, reason: "pipeline_error" } };
  }
  return { status: 200, body: { ok: true, result: toResultView(result) } };
}

/**
 * Node http.createServer 콜백.
 * @param {object} config  loadConfig()의 config 객체
 */
export function makeHandler(config) {
  const signalMetrics = config.signalMetrics ?? createSignalMetrics();
  const db = config.database ? createDatabase(config.database) : null;
  const auth = db ? createAuth(db, config) : null;
  const authApi = auth ? createAuthApi(auth, config) : null;
  const receipts = db ? createReceipts(config.hmacKey) : null;
  const recordCheck = db ? createCheckRecorder(db,receipts) : null;
  const push = db ? createPushService(db,config.push) : null;
  const pushApi = push ? createPushApi(auth,push,config) : null;
  const familyApi = db ? createFamilyApi(auth,createConfirmService(db,receipts),config,{notify:push.notify,recordCheck}) : null;
  const resultStore = config.resultStore || (db && config.webBaseUrl ? createDbResultStore(db) : null);
  // 평판 조회기: 캐시를 프로세스 동안 공유한다. 키가 없으면 null(조회 안 함).
  // 국내 KISA 목록(D40 ①)은 메모리 대조라 외부 전송·지연이 없다. 둘 다 없으면 null(조회 안 함).
  const phishingList = config.phishingList === undefined ? loadPhishingListChecker().check : config.phishingList;
  const urlReputation = combineCheckers([
    phishingList,
    createSafeBrowsingChecker({
      apiKey: config.safeBrowsingKey,
      timeoutMs: config.urlLookupTimeoutMs || 800,
    }),
  ]);
  // 도메인 생성일(D41): 등록 도메인 이름만 RDAP에 묻는다. 설정 일수가 0이거나 없으면 끈다(시험 설정은 기본으로 꺼짐).
  const domainAge = config.domainAge !== undefined ? config.domainAge
    : config.domainAgeDays > 0
      ? createDomainAgeChecker({ thresholdDays: config.domainAgeDays, timeoutMs: config.domainAgeTimeoutMs || 2500, includeStats: true })
      : null;
  // F4-9 호출 한도 + 동시성 제한. 프로세스 안에서만 동작(운영에서는 Redis로 교체, [임시]).
  const rateLimiter = createRateLimiter({
    maxPerMinute: config.maxPerMinute || 5,
    maxPerDay: config.maxPerDay || 50,
  });
  const concurrency = createConcurrencyLimit({ max: config.maxConcurrent || 8 });

  const handler = async function(req, res) {
    const started = Date.now();

    function send(status, body, extraHeaders = {}) {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders });
      res.end(JSON.stringify(body));
      // 원문 없이 상태 코드·경과시간만 기록 (PRD 13-3). 토큰 값은 가린다(13-4).
      console.log(`${new Date().toISOString()} ${req.method} ${new URL(req.url, 'http://local').pathname} ${status} ${Date.now() - started}ms`);
    }

    if (req.method === "GET" && req.url === "/health") {
      return send(200, { ok: true, model: config.ai.model });
    }

    if (authApi && await authApi(req, send, readBody)) return;
    if (pushApi && await pushApi(req, send, readBody)) return;
    if (familyApi && await familyApi(req, send, readBody)) return;

    if (req.method === "GET" && req.url?.startsWith("/api/result")) {
      const token = new URL(req.url, "http://local").searchParams.get("t");
      const { status, body } = await handleResultLookup(token, resultStore);
      if (body.ok && receipts) {
        const session = await auth.authenticate(req);
        body.result.receipt = receipts.issue(body.result,session?.userId || null);
      }
      return send(status, body, { "cache-control": "no-store" });
    }

    // 웹 직접 입력(PRD F4-1). 토큰 헤더 없음. 한도·동시성만 건다.
    if (req.method === "POST" && req.url?.startsWith("/api/analyze")) {
      if (auth) {
        try {
          checkBrowserRequest(req, config.webBaseUrl);
          req.auth = await auth.authenticate(req);
          if (!req.auth) return send(401, {ok:false,reason:'login_required'});
        } catch (error) {
          return send(error.status || 503, {ok:false,reason:error.reason || 'unavailable'});
        }
      }
      const key = req.auth?.userId || clientKey(req);
      const limit = rateLimiter.check(key);
      if (!limit.ok) {
        return send(429, { ok: false, reason: "rate_limited", retryAfterMs: limit.retryAfterMs },
          { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) });
      }
      await concurrency.acquire();
      try {
        const rawBody = await readBody(req);
        if (!rawBody) return send(400, { ok: false, reason: "body too large" });
        let payload;
        try { payload = JSON.parse(rawBody); }
        catch { return send(400, { ok: false, reason: "bad json" }); }
        const text = typeof payload?.text === "string" ? payload.text : "";
        const parentInputs = payload?.parentInputs ?? {};
        // 해외 AI 분석(국외 이전)은 부모님이 허락했을 때만. 아니면 규칙만으로 판정한다(동의 재설계 v3)
        let aiAllowed = !auth;
        if (auth) {
          try { aiAllowed = await auth.overseasAiAllowed(req.auth.userId); } catch { aiAllowed = false; }
        }
        const { status, body } = await handleAnalyze(
          { text, parentInputs },
          // F4-6: 웹 채널은 카카오 5초 제한이 없으므로 webTimeoutMs(기본 8초)로 덮어 쓴다.
          { ai: aiAllowed ? { ...config.ai, model:config.ai.webModel || config.ai.model, timeoutMs: config.ai.webTimeoutMs } : null,
            hmacKey: config.hmacKey, cards: [], urlReputation, domainAge, signalMetrics },
        );
        if (body.ok && !aiAllowed) body.result.ai_consent = false;
        if (body.ok && receipts) {
          body.result.receipt = receipts.issue(body.result,req.auth.userId);
          await recordCheck(req.auth.userId,body.result.receipt);
        }
        return send(status, body, { "cache-control": "no-store" });
      } finally {
        concurrency.release();
      }
    }

    if (req.method !== "POST" || !req.url?.startsWith("/api/kakao-skill")) {
      return send(404, { error: "not found" });
    }

    if (!tokenMatches(req.headers[HEADER_TOKEN_KEY], config.headerToken)) {
      return send(403, { error: "forbidden" });
    }

    const rawBody = await readBody(req);
    if (!rawBody) return send(400, { error: "body too large" });

    let payload;
    try { payload = JSON.parse(rawBody); }
    catch { return send(400, { error: "bad json" }); }

    const parsed = readRequest(payload);
    if (!parsed) return send(400, { error: "invalid kakao payload" });

    // 카카오 스킬에도 같은 한도·동시성을 건다(botUserKey 우선).
    const key = clientKey(req, parsed.botUserKey);
    const limit = rateLimiter.check(key);
    if (!limit.ok) {
      return send(429, {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "조금 전에 여러 번 물어보셨어요. 1분 뒤에 다시 시도해 주세요." } }],
        },
      });
    }

    await concurrency.acquire();
    try {
      const { status, body } = await handleRequest(
        { utterance: parsed.text, parentInputs: parsed.parentInputs ?? {} },
        { ai: config.ai, hmacKey: config.hmacKey, cards: [], webBaseUrl: config.webBaseUrl, resultStore, urlReputation, domainAge, signalMetrics },
      );
      send(status, body);
    } finally {
      concurrency.release();
    }
  };
  const safeHandler = (req,res) => handler(req,res).catch(() => {
    if (!res.headersSent) res.writeHead(503, {'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({ok:false,reason:'unavailable'}));
  });
  safeHandler.signalMetrics = signalMetrics;
  safeHandler.close = () => { signalMetrics.flush({ includeToday: true }); return db?.close(); };
  return safeHandler;
}
