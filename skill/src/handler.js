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
import { analyze } from "../../packages/core/src/pipeline.js";
import { readRequest, simpleText, quickReply } from "./kakao.js";
import { tokenMatches } from "./config.js";

const HEADER_TOKEN_KEY = "x-skill-token";
const MAX_BODY_BYTES = 64 * 1024;

// ── 고정 안내 문구 (PRD 9-10) ────────────────────────────────────────────────
const FIXED = {
  ERROR: "지금은 확인이 어렵습니다. 잠시 후 다시 시도하거나 가족에게 직접 물어보세요.",
  TOO_SHORT: "판별할 문자 내용을 붙여 넣어 주세요.",
  CALL_IN_PROGRESS: "지금 바로 전화를 끊으세요.\n전화를 끊은 뒤 직접 찾은 공식 번호로 다시 확인하세요.\n악성 앱이 있다면 비행기 모드 후 가족에게 연락하세요.",
  DISCLAIMER: "\n\n이 결과는 참고용입니다. 의심되면 반드시 직접 공식 번호로 확인하세요.",
};

const LEVEL_TEXT = {
  위험: "⚠️ 위험",
  주의: "⚡ 주의",
  확인필요: "🔍 확인 필요",
};

/**
 * 판정 결과를 카카오 응답 텍스트로 변환한다.
 * explanation이 있으면 붙이고, 없으면 신호 요약을 쓴다.
 */
function buildReplyText(result) {
  const lvl = LEVEL_TEXT[result.level] ?? result.level;
  const lines = [`[${lvl}]`];

  if (result.explanation_for_parent?.length) {
    lines.push(...result.explanation_for_parent);
  } else if (result.summary) {
    lines.push(`감지된 신호: ${result.summary}`);
  }

  // 통화 중 R1이면 항상 가장 먼저 전화 끊기 안내
  if (result.fired_rules.includes("R1")) return FIXED.CALL_IN_PROGRESS;

  lines.push(FIXED.DISCLAIMER);
  return lines.join("\n");
}

/**
 * 판정에 맞는 빠른 버튼을 만든다.
 * D25: 가족방패는 먼저 링크를 보내지 않으므로 webLink는 사용자 요청 버튼만 허용.
 */
function buildQuickReplies(result, webBaseUrl) {
  const replies = [];
  if (result.level === "위험" || result.level === "주의") {
    replies.push(quickReply.message("이미 당했어요", "이미 당했어요"));
  }
  if (webBaseUrl) {
    replies.push(quickReply.webLink("자세히 보기", `${webBaseUrl}/check`));
  }
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
 * @param {{ ai: object, hmacKey?: string|null, cards?: object[], webBaseUrl?: string|null }} cfg
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleRequest(params, cfg) {
  const { utterance, parentInputs = {} } = params;

  if (!utterance || utterance.trim().length < 2) {
    return { status: 200, body: simpleText(FIXED.TOO_SHORT) };
  }

  // R1 빠른 경로: 통화 중이면 AI 없이 즉시 반환
  if (parentInputs.call_in_progress) {
    return {
      status: 200,
      body: simpleText(FIXED.CALL_IN_PROGRESS, [quickReply.message("도움이 필요해요", "도움이 필요해요")]),
    };
  }

  let result;
  try {
    result = await analyze({
      text: utterance,
      parentInputs,
      hmacKey: cfg.hmacKey ?? undefined,
      cards: cfg.cards ?? [],
      ai: cfg.ai,
    });
  } catch (err) {
    console.error(`pipeline error: ${err.message}`);
    return { status: 200, body: simpleText(FIXED.ERROR) };
  }

  const text = buildReplyText(result);
  const replies = buildQuickReplies(result, cfg.webBaseUrl);
  return { status: 200, body: simpleText(text, replies) };
}

/**
 * Node http.createServer 콜백.
 * @param {object} config  loadConfig()의 config 객체
 */
export function makeHandler(config) {
  return async function handler(req, res) {
    const started = Date.now();

    function send(status, body) {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
      // 원문 없이 상태 코드·경과시간만 기록 (PRD 13-3)
      console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${status} ${Date.now() - started}ms`);
    }

    if (req.method === "GET" && req.url === "/health") {
      return send(200, { ok: true, model: config.ai.model });
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

    const { status, body } = await handleRequest(
      { utterance: parsed.text, parentInputs: {} },
      { ai: config.ai, hmacKey: config.hmacKey, cards: [], webBaseUrl: config.webBaseUrl },
    );
    send(status, body);
  };
}
