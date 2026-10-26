import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/handler.js";
import { readRequest, simpleText, quickReply, anonymousCode } from "../src/kakao.js";
import { loadConfig, tokenMatches } from "../src/config.js";

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
