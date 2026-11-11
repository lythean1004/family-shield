import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { handleRequest, handleResultLookup, handleAnalyze, makeHandler } from "../src/handler.js";
import { createMemoryResultStore } from "../../packages/core/src/result-token.js";
import { readRequest, simpleText, quickReply, anonymousCode } from "../src/kakao.js";
import { loadConfig, tokenMatches } from "../src/config.js";
import { CHECK_LEVEL_TEXT } from "../../packages/core/src/fixed-text.js";
import { createRateLimiter, createConcurrencyLimit, clientKey } from "../src/rate-limit.js";

// ── kakao.js ─────────────────────────────────────────────────────────────────
describe("카카오 파서", () => {
  it("utterance와 botUserKey를 꺼낸다", () => {
    const p = {
      userRequest: { utterance: "검찰청입니다", user: { properties: { botUserKey: "abc123" } } },
    };
    const r = readRequest(p);
    assert.equal(r.text, "검찰청입니다");
    assert.equal(r.botUserKey, "abc123");
  });

  it("userRequest가 없으면 null", () => assert.equal(readRequest({}), null));
  it("utterance가 없어도 text가 빈 문자열", () => assert.equal(readRequest({ userRequest: {} }).text, ""));
});

describe("카카오 응답", () => {
  it("simpleText 형식이 맞다", () => {
    const r = simpleText("안녕하세요", [quickReply.message("확인", "확인")]);
    assert.equal(r.version, "2.0");
    assert.equal(r.template.outputs[0].simpleText.text, "안녕하세요");
    assert.equal(r.template.quickReplies[0].action, "message");
  });

  it("1000자 초과는 잘린다", () => {
    const r = simpleText("가".repeat(1100));
    assert.equal([...r.template.outputs[0].simpleText.text].length, 1000);
  });

  it("버튼 4개 이상은 3개로 제한", () => {
    const btns = [1, 2, 3, 4].map((i) => quickReply.message(`B${i}`, `B${i}`));
    assert.equal(simpleText("x", btns).template.quickReplies.length, 3);
  });
});

describe("anonymousCode", () => {
  it("같은 입력은 같은 코드", async () => {
    const a = await anonymousCode("usr1", "salt");
    const b = await anonymousCode("usr1", "salt");
    assert.equal(a, b);
  });
  it("다른 입력은 다른 코드", async () => {
    const a = await anonymousCode("usr1", "salt");
    const b = await anonymousCode("usr2", "salt");
    assert.notEqual(a, b);
  });
  it("키나 솔트 없으면 null", async () => {
    assert.equal(await anonymousCode(null, "salt"), null);
    assert.equal(await anonymousCode("usr", null), null);
  });
});

// ── config.js ─────────────────────────────────────────────────────────────────
describe("설정 로드", () => {
  it("필수값 있으면 ok:true", () => {
    const r = loadConfig({ SKILL_HEADER_TOKEN: "t", AI_API_KEY: "k" });
    assert.equal(r.ok, true);
    assert.equal(r.config.ai.model, "gemini-3.1-flash-lite");
    assert.equal(r.config.ai.webModel, "claude-sonnet-5-5");
    assert.equal(r.config.port, 3000);
  });
  it("필수값 없으면 ok:false와 missing 목록", () => {
    const r = loadConfig({});
    assert.equal(r.ok, false);
    assert.ok(r.missing.includes("SKILL_HEADER_TOKEN"));
    assert.ok(r.missing.includes("AI_API_KEY"));
  });
  it("AI_TIMEOUT_MS 설정값을 반영", () => {
    const r = loadConfig({ SKILL_HEADER_TOKEN: "t", AI_API_KEY: "k", AI_TIMEOUT_MS: "5000" });
    assert.equal(r.config.ai.timeoutMs, 5000);
  });
});

describe("tokenMatches", () => {
  it("같은 토큰은 true", () => assert.equal(tokenMatches("abc", "abc"), true));
  it("다른 토큰은 false", () => assert.equal(tokenMatches("abc", "xyz"), false));
  it("빈 expected는 false", () => assert.equal(tokenMatches("abc", ""), false));
  it("null은 false", () => assert.equal(tokenMatches(null, "abc"), false));
  it("길이가 다르면 false", () => assert.equal(tokenMatches("ab", "abc"), false));
});

// ── handler.js ───────────────────────────────────────────────────────────────
function fakeGateway(signals, impersonation_type = "none") {
  return async (_u, opts) => {
    const args = {
      signals,
      impersonation_type,
      impersonated_relation: null,
      evidence_card_ids: [],
      explanation_for_parent: signals.length ? ["의심 내용이 있어요."] : ["특이 내용을 찾지 못했어요."],
    };
    return {
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => ({
        model: "fake", usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ finish_reason: "tool_calls", message: {
          tool_calls: [{ function: { name: "report_signals", arguments: JSON.stringify(args) } }],
        }}],
      }),
    };
  };
}

const cfg = { ai: { model: "fake", apiKey: "k", timeoutMs: 1000, promptVersion: "v1", fetchImpl: fakeGateway([]) }, hmacKey: null, cards: [], webBaseUrl: null };

describe("핸들러 - 기본", () => {
  it("빈 utterance → 200 + 안내 문구", async () => {
    const r = await handleRequest({ utterance: "" }, cfg);
    assert.equal(r.status, 200);
    assert.ok(r.body.template.outputs[0].simpleText.text.includes("붙여"));
  });

  it("통화 중이면 즉시 끊기 안내", async () => {
    const r = await handleRequest({ utterance: "문자내용", parentInputs: { call_in_progress: true } }, cfg);
    assert.ok(r.body.template.outputs[0].simpleText.text.includes("끊으세요"));
  });

  it("정상 문자 → 확인 필요 판정", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway([]) } };
    const r = await handleRequest({ utterance: "[롯데택배] 배송 예정입니다." }, c);
    assert.equal(r.status, 200);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("확인 필요") || text.includes("주의") || text.includes("위험"));
  });

  it("링크 규칙(R11)으로 위험이면 AI 설명이 있어도 이유 문구를 함께 보여 준다(2026-11-11 카카오 시험)", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_LINK"]) } };
    const r = await handleRequest({ utterance: "[시험] 보험료 환급 안내 nhis-event.or.kr" }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("위험"));
    assert.ok(text.includes("위험 이유: 공식 주소를 흉내 낸 링크"), text);
    assert.ok(text.includes("의심 내용이 있어요."), "AI 설명도 그대로 남긴다");
  });

  it("R12(새 도메인 + 개인정보 요구)로 위험이면 이유 줄에 새 도메인을 보여 준다", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_LINK", "SIG_PERSONAL_INFO"]) },
      domainAge: async () => ({ ok: true, young: ["fresh-login.shop"] }) };
    const r = await handleRequest({ utterance: "본인 확인을 위해 주민등록번호를 입력하세요 http://fresh-login.shop/a" }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("위험 이유: 만든 지 얼마 안 된 링크 주소"), text);
  });

  it("새 도메인 신호만 있고 위험이 아니면 '위험 이유'를 붙이지 않는다", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_LINK"]) },
      domainAge: async () => ({ ok: true, young: ["fresh-shop.shop"] }) };
    const r = await handleRequest({ utterance: "신상품 안내 http://fresh-shop.shop/a" }, c);
    assert.ok(!r.body.template.outputs[0].simpleText.text.includes("위험 이유:"));
  });

  it("설정에 도메인 생성일 일수가 없으면 조회기를 만들지 않는다(시험에서 외부 접속 없음)", () => {
    assert.equal(loadConfig({ SKILL_HEADER_TOKEN: "t", AI_API_KEY: "k" }).config.domainAgeDays, 30);
    assert.equal(loadConfig({ SKILL_HEADER_TOKEN: "t", AI_API_KEY: "k", DOMAIN_AGE_DAYS: "0" }).config.domainAgeDays, 0);
  });

  it("확인 필요면 AI 설명 대신 정해 둔 문장을 쓴다('안전'으로 읽히는 AI 문장 방지, 2026-11-11 카카오 확인)", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway([]) } };
    const r = await handleRequest({ utterance: "아무말이나 보내봅니다" }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("확인 필요"));
    assert.ok(text.includes(CHECK_LEVEL_TEXT), text);
    assert.ok(!text.includes("특이 내용을 찾지 못했어요."), "AI 설명은 쓰지 않는다");
  });

  it("Google 목록으로 위험이면 단정하지 않는 이유 문구, 'Advisory provided by Google', Google 안내 버튼", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_LINK"]) },
      urlReputation: async () => ({ ok: true, malicious: ["evil.invalid"], sources: { safe_browsing: ["evil.invalid"] } }) };
    const r = await handleRequest({ utterance: "택배 확인 http://evil.invalid/a" }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("위험 이유: Google이 위험할 수 있다고 표시한 링크"), text);
    assert.ok(text.includes("Advisory provided by Google"));
    const qr = r.body.template.quickReplies ?? [];
    assert.ok(qr.some((q) => q.action === "webLink" && q.webLinkUrl === "https://developers.google.com/safe-browsing/v4/advisory"));
  });

  it("KISA 목록으로만 위험이면 Google 표시를 붙이지 않는다", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_LINK"]) },
      urlReputation: async () => ({ ok: true, malicious: ["evil.invalid"], source: "kisa" }) };
    const r = await handleRequest({ utterance: "택배 확인 http://evil.invalid/a" }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("위험 이유: KISA 피싱 사이트 목록에 있던 링크"), text);
    assert.ok(!text.includes("Google"));
  });

  it("카카오: '엄마 나 입원했어 병원비 90만원 급해'(가족 사칭+돈, 번호 정보 없음) → 위험(R13)", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_FAMILY_IMPERSONATION", "SIG_MONEY", "SIG_URGENCY"], "family") } };
    const r = await handleRequest({ utterance: "엄마 나 입원했어 병원비 90만원 급해" }, c);
    assert.ok(r.body.template.outputs[0].simpleText.text.includes("위험"));
  });

  it("건강 관련 안내라 해외 AI로 보내지 않았으면 그 사실을 알린다(작업 ⑦)", async () => {
    const seen = {};
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: async (...a) => { seen.called = true; return fakeGateway([])(...a); } } };
    const r = await handleRequest({ utterance: "[○○병원] 11월 2일 오전 10시 내과 예약 확인됐습니다." }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.equal(seen.called, undefined, "AI 호출 없음");
    assert.ok(text.includes("건강 관련 내용이 있어 해외 AI로 보내지 않았어요."), text);
  });

  it("링크 규칙이 아닌 위험이면 이유 줄을 따로 붙이지 않는다", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_AGENCY_IMPERSONATION", "SIG_LINK"], "agency") } };
    const r = await handleRequest({ utterance: "[검찰청] 링크 클릭: http://x.invalid/a" }, c);
    assert.ok(!r.body.template.outputs[0].simpleText.text.includes("위험 이유:"));
  });

  it("위험 판정이면 quickReplies에 처음으로 버튼", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_AGENCY_IMPERSONATION", "SIG_LINK"], "agency") } };
    const r = await handleRequest(
      { utterance: "[검찰청] 링크 클릭: http://x.invalid/a" },
      c,
    );
    assert.ok(r.body.template.quickReplies?.length > 0);
  });

  it("AI 실패해도 200 반환 (fallback)", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: async () => { throw new Error("network"); } } };
    const r = await handleRequest({ utterance: "테스트 문자입니다" }, c);
    assert.equal(r.status, 200);
  });
});

describe("핸들러 - R1과 한계 문구", () => {
  it("R1 판정이어도 한계 문구가 포함된다", async () => {
    // call_in_progress=true면 pipeline이 R1을 실행, buildReplyText에 DISCLAIMER가 붙어야 함
    const r = await handleRequest(
      { utterance: "검찰청입니다", parentInputs: { call_in_progress: true } },
      cfg,
    );
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("끊으세요"), "끊기 안내 포함");
    assert.ok(text.includes("참고용"), "한계 문구 포함");
  });

  it("R1이 아닌 위험 판정에도 한계 문구가 포함된다", async () => {
    const c = { ...cfg, ai: { ...cfg.ai, fetchImpl: fakeGateway(["SIG_AGENCY_IMPERSONATION", "SIG_LINK"], "agency") } };
    const r = await handleRequest({ utterance: "[검찰청] 링크: http://x.invalid/a" }, c);
    const text = r.body.template.outputs[0].simpleText.text;
    assert.ok(text.includes("참고용"), "한계 문구 포함");
  });

  it("한계 문구는 project.md 문장 그대로다(문자 속 번호·링크 말고, 놓칠 수 있음)", async () => {
    const PROJECT_MD = "이 결과는 참고용입니다. 정상 메시지를 위험으로 보거나 위험한 메시지를 놓칠 수 있습니다. " +
      "확실하지 않으면 메시지 속 번호나 링크가 아닌, 직접 찾은 공식 번호로 확인하세요.";
    const normal = await handleRequest({ utterance: "[롯데택배] 배송 예정입니다." }, cfg);
    assert.ok(normal.body.template.outputs[0].simpleText.text.endsWith(PROJECT_MD));
    const call = await handleRequest({ utterance: "검찰청입니다", parentInputs: { call_in_progress: true } }, cfg);
    assert.ok(call.body.template.outputs[0].simpleText.text.endsWith(PROJECT_MD));
  });
});

describe("자세히 보기 1회용 토큰 (D34, PRD 13-4)", () => {
  const dangerAi = { ...cfg.ai, fetchImpl: fakeGateway(["SIG_AGENCY_IMPERSONATION", "SIG_LINK"], "agency") };

  function detailUrl(body) {
    return body.template.quickReplies.find((q) => q.label === "자세히 보기")?.webLinkUrl;
  }

  it("WEB_BASE_URL과 저장소가 있으면 버튼 주소가 /check/result?t=토큰", async () => {
    const store = createMemoryResultStore();
    const r = await handleRequest(
      { utterance: "[검찰청] 링크: http://x.invalid/a" },
      { ...cfg, ai: dangerAi, webBaseUrl: "https://fs.example", resultStore: store },
    );
    assert.match(detailUrl(r.body), /^https:\/\/fs\.example\/check\/result\?t=[A-Za-z0-9_-]{22}$/);
    assert.equal(store.size(), 1);
  });

  it("WEB_BASE_URL이 없으면 버튼이 없다", async () => {
    const r = await handleRequest({ utterance: "[검찰청] 링크: http://x.invalid/a" }, { ...cfg, ai: dangerAi });
    assert.equal(detailUrl(r.body), undefined);
  });

  it("조회는 한 번만 되고, 결과에 원문이 없다", async () => {
    const store = createMemoryResultStore();
    const utterance = "[검찰청] 사건 확인 링크: http://x.invalid/a";
    const r = await handleRequest({ utterance }, { ...cfg, ai: dangerAi, webBaseUrl: "https://fs.example", resultStore: store });
    const token = new URL(detailUrl(r.body)).searchParams.get("t");

    const first = handleResultLookup(token, store);
    assert.equal(first.status, 200);
    assert.equal(first.body.result.level, "위험");
    assert.ok(!JSON.stringify(first.body).includes("x.invalid"), "도메인·원문 없음");
    assert.ok(!JSON.stringify(first.body).includes("사건 확인"), "원문 없음");

    const second = handleResultLookup(token, store);
    assert.equal(second.status, 410);
    assert.equal(second.body.reason, "used");
  });

  it("저장소가 없거나 모르는 토큰이면 410", () => {
    assert.equal(handleResultLookup("x".repeat(22), null).status, 410);
    assert.equal(handleResultLookup("x".repeat(22), createMemoryResultStore()).body.reason, "missing");
  });
});

describe("HTTP 서버 - 결과 조회 경로", () => {
  it("GET /api/result: 한 번 200, 다음 410, 로그에 토큰 없음", async () => {
    const config = {
      headerToken: "h", webBaseUrl: "https://fs.example", hmacKey: null,
      ai: { model: "fake", apiKey: "k", timeoutMs: 1000, promptVersion: "v1",
            fetchImpl: fakeGateway(["SIG_AGENCY_IMPERSONATION", "SIG_LINK"], "agency") },
    };
    const server = createServer(makeHandler({...config,resultStore:createMemoryResultStore()}));
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const logs = [];
    const origLog = console.log;
    console.log = (m) => logs.push(String(m));
    try {
      const skill = await fetch(`${base}/api/kakao-skill`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-skill-token": "h" },
        body: JSON.stringify({ userRequest: { utterance: "[검찰청] 링크: http://x.invalid/a" } }),
      }).then((r) => r.json());
      const url = skill.template.quickReplies.find((q) => q.label === "자세히 보기").webLinkUrl;
      const token = new URL(url).searchParams.get("t");

      const a = await fetch(`${base}/api/result?t=${token}`);
      assert.equal(a.status, 200);
      assert.equal(a.headers.get("cache-control"), "no-store");
      assert.equal((await a.json()).result.level, "위험");

      const b = await fetch(`${base}/api/result?t=${token}`);
      assert.equal(b.status, 410);

      assert.ok(logs.length >= 3);
      assert.ok(logs.every((l) => !l.includes(token)), "로그에 토큰 원문이 없다");
    } finally {
      console.log = origLog;
      server.close();
    }
  });
});

describe("카카오 파서 - parentInputs", () => {
  it("params에서 call_in_progress를 파싱한다", () => {
    const p = {
      userRequest: {
        utterance: "문자내용",
        user: { properties: { botUserKey: "u1" } },
        params: { call_in_progress: "true" },
      },
    };
    const r = readRequest(p);
    assert.equal(r.parentInputs.call_in_progress, true);
  });

  it("params에서 called_before를 파싱한다", () => {
    const p = { userRequest: { utterance: "x", params: { called_before: "true" } } };
    assert.equal(readRequest(p).parentInputs.called_before, true);
  });

  it("detail_params 형태({ value }) 도 파싱한다", () => {
    const p = {
      userRequest: {
        utterance: "x",
        params: { call_in_progress: { value: "true" }, sender_last4: { value: "1234" } },
      },
    };
    const r = readRequest(p).parentInputs;
    assert.equal(r.call_in_progress, true);
    assert.equal(r.sender_last4, "1234");
  });

  it("params가 없으면 parentInputs는 빈 객체", () => {
    const p = { userRequest: { utterance: "x" } };
    assert.deepEqual(readRequest(p).parentInputs, {});
  });
});

// ── handleAnalyze (POST /api/analyze) ─────────────────────────────────────────
describe("handleAnalyze", () => {
  const fakeCfg = {
    ai: {
      model: "fake", apiKey: "k", timeoutMs: 1000, promptVersion: "v1",
      fetchImpl: fakeGateway(["SIG_FAMILY_IMPERSONATION", "SIG_MONEY"], "family"),
    },
    hmacKey: null, cards: [], urlReputation: null,
  };

  it("빈 문자열은 400 empty", async () => {
    const r = await handleAnalyze({ text: "  " }, fakeCfg);
    assert.equal(r.status, 400);
    assert.equal(r.body.reason, "empty");
  });

  it("정상 입력은 200 + toResultView 필드만", async () => {
    const r = await handleAnalyze({ text: "엄마 나 딸인데 50만원만 보내줘" }, fakeCfg);
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    const v = r.body.result;
    assert.ok(v.level && v.fired_rules && Array.isArray(v.signals_final));
    assert.equal(v.masked, undefined);
    assert.equal(v.phoneHmacs, undefined);
    assert.equal(v.domains, undefined);
  });

  it("2000자 초과는 400 too_long", async () => {
    const r = await handleAnalyze({ text: "가".repeat(2001) }, fakeCfg);
    assert.equal(r.status, 400);
    assert.equal(r.body.reason, "too_long");
  });
});

// ── rate-limit.js ─────────────────────────────────────────────────────────────
describe("createRateLimiter", () => {
  it("분당 한도 내면 ok", () => {
    const rl = createRateLimiter({ maxPerMinute: 3, maxPerDay: 100 });
    assert.equal(rl.check("k1").ok, true);
    assert.equal(rl.check("k1").ok, true);
    assert.equal(rl.check("k1").ok, true);
  });

  it("분당 한도 초과면 false reason=minute", () => {
    const rl = createRateLimiter({ maxPerMinute: 2, maxPerDay: 100 });
    rl.check("k2"); rl.check("k2");
    const r = rl.check("k2");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "minute");
    assert.ok(r.retryAfterMs > 0);
  });

  it("일일 한도 초과면 false reason=day", () => {
    const rl = createRateLimiter({ maxPerMinute: 100, maxPerDay: 2 });
    rl.check("k3"); rl.check("k3");
    const r = rl.check("k3");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "day");
  });

  it("키가 다르면 독립적으로 잡힌다", () => {
    const rl = createRateLimiter({ maxPerMinute: 1, maxPerDay: 100 });
    assert.equal(rl.check("a").ok, true);
    assert.equal(rl.check("b").ok, true);
    assert.equal(rl.check("a").ok, false);
  });

  it("빈 키는 anon으로 잡힌다", () => {
    const rl = createRateLimiter({ maxPerMinute: 1, maxPerDay: 100 });
    assert.equal(rl.check("").ok, true);
    assert.equal(rl.check("").ok, false);
  });
});

describe("createConcurrencyLimit", () => {
  it("max 이내는 바로 acquire", async () => {
    const cl = createConcurrencyLimit({ max: 2 });
    await cl.acquire();
    assert.equal(cl.running, 1);
    cl.release();
    assert.equal(cl.running, 0);
  });

  it("max 초과면 release까지 대기", async () => {
    const cl = createConcurrencyLimit({ max: 1 });
    await cl.acquire();
    let entered = false;
    const p = (async () => { await cl.acquire(); entered = true; })();
    assert.equal(entered, false);
    cl.release();
    await p;
    assert.equal(entered, true);
    cl.release();
  });
});

describe("clientKey", () => {
  it("botUserKey 있으면 kakao: 우선", () => {
    const req = { headers: { "x-forwarded-for": "1.2.3.4" }, socket: { remoteAddress: "9.9.9.9" } };
    assert.equal(clientKey(req, "bot123"), "kakao:bot123");
  });

  it("botUserKey 없으면 x-forwarded-for 첫 값", () => {
    const req = { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, socket: { remoteAddress: "9.9.9.9" } };
    assert.equal(clientKey(req, null), "ip:1.2.3.4");
  });

  it("둘 다 없으면 socket.remoteAddress", () => {
    const req = { headers: {}, socket: { remoteAddress: "9.9.9.9" } };
    assert.equal(clientKey(req, null), "ip:9.9.9.9");
  });
});

// ── HTTP 서버: /api/analyze + rate limit ─────────────────────────────────────
describe("HTTP 서버 - /api/analyze", () => {
  function makeTestConfig(extra = {}) {
    return {
      headerToken: "h", webBaseUrl: null, hmacKey: null,
      maxPerMinute: extra.maxPerMinute ?? 5, maxPerDay: 50, maxConcurrent: 8,
      ai: {
        model: "fake", apiKey: "k", timeoutMs: 1000, promptVersion: "v1",
        fetchImpl: fakeGateway(["SIG_FAMILY_IMPERSONATION", "SIG_MONEY"], "family"),
      },
    };
  }

  it("웹은 지정된 웹 모델, 카카오는 스킬 모델로 호출한다", async () => {
    const models = [];
    const config = makeTestConfig();
    config.ai.webModel = "fake-web";
    config.ai.fetchImpl = async (url, options) => {
      models.push(JSON.parse(options.body).model);
      return fakeGateway([])(url, options);
    };
    const server = createServer(makeHandler(config));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const web = await fetch(`${base}/api/analyze`, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({text:"합성 시험 문자입니다"})});
      assert.equal(web.status, 200);
      const kakao = await fetch(`${base}/api/kakao-skill`, {method:"POST", headers:{"content-type":"application/json","x-skill-token":"h"}, body:JSON.stringify({userRequest:{utterance:"합성 시험 문자입니다"}})});
      assert.equal(kakao.status, 200);
      assert.deepEqual(models, ["fake-web", "fake"]);
    } finally { server.close(); }
  });

  it("정상 응답 200 + cache-control: no-store", async () => {
    const server = createServer(makeHandler(makeTestConfig()));
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const res = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "엄마 나 딸인데 50만원 보내줘" }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.ok(body.result.level);
    } finally { server.close(); }
  });

  it("분당 한도 초과시 429 + retry-after 헤더", async () => {
    const server = createServer(makeHandler(makeTestConfig({ maxPerMinute: 2 })));
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const post = (t) => fetch(`${base}/api/analyze`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      await post("엄마 50만원"); await post("엄마 60만원");
      const res = await post("엄마 70만원");
      assert.equal(res.status, 429);
      assert.ok(res.headers.get("retry-after"));
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.reason, "rate_limited");
    } finally { server.close(); }
  });

  it("빈 body 400 bad json", async () => {
    const server = createServer(makeHandler(makeTestConfig()));
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const res = await fetch(`${base}/api/analyze`, {
        method: "POST", headers: { "content-type": "application/json" }, body: "NOT_JSON",
      });
      assert.equal(res.status, 400);
    } finally { server.close(); }
  });
});

