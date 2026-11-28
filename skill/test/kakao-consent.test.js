// D59(2026-11-28): 카카오 경로도 해외 AI 분석(국외 이전) 동의를 받은 뒤에만 AI를 부른다.
// 동의 전·거절 뒤에는 규칙만 판정하고, 판별(기본 기능)은 막지 않는다(멘토 Q4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { makeHandler } from "../src/handler.js";
import {
  createMemoryKakaoConsentStore, kakaoUserHash, KAKAO_CONSENT_VERSION, KAKAO_CONSENT_COMMANDS, KAKAO_AI_NOTICE,
} from "../src/kakao-consent.js";

const SCAM = "엄마 나 폰 고장나서 임시폰이야 급하게 50만원만 보내줘";

function fakeAi() {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(JSON.parse(options.body).model);
    const args = { signals: ["SIG_FAMILY_IMPERSONATION"], impersonation_type: "family", evidence_card_ids: [], explanation_for_parent: ["가족을 사칭했어요."] };
    return new Response(JSON.stringify({
      model: "fake", usage: {},
      choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: { name: "report_signals", arguments: JSON.stringify(args) } }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

async function withServer(config, run) {
  const server = createServer(makeHandler({ phishingList: null, domainAge: null, ...config }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const say = async (utterance, botUserKey = "user-1") => {
    const res = await fetch(`${base}/api/kakao-skill`, {
      method: "POST", headers: { "content-type": "application/json", "x-skill-token": "h" },
      body: JSON.stringify({ userRequest: { utterance, user: { properties: { botUserKey } } } }),
    });
    const body = await res.json();
    const text = body.template.outputs.map((o) => o.simpleText?.text ?? "").join("\n");
    const replies = (body.template.quickReplies ?? []).map((q) => q.messageText);
    return { body, text, replies };
  };
  try { await run(say); } finally { await new Promise((r) => server.close(r)); }
}

const baseConfig = (ai, store) => ({
  headerToken: "h", webBaseUrl: null, hmacKey: "test-secret", maxPerMinute: 50, maxPerDay: 500, maxConcurrent: 8,
  ai: { model: "fake", apiKey: "k", timeoutMs: 1000, promptVersion: "v4", fetchImpl: ai.fetchImpl },
  kakaoConsentStore: store,
});

describe("카카오 해외 AI 동의(D59)", () => {
  it("동의 기록이 없으면 AI를 부르지 않고, 결과와 함께 안내 버튼을 준다", async () => {
    const ai = fakeAi();
    await withServer(baseConfig(ai, createMemoryKakaoConsentStore()), async (say) => {
      const r = await say(SCAM);
      assert.equal(ai.calls.length, 0);
      assert.match(r.text, /\[⚠️ 위험\]|\[⚡ 주의\]/);
      assert.match(r.text, /규칙으로만 확인했어요/);
      assert.ok(r.replies.includes(KAKAO_CONSENT_COMMANDS.notice), String(r.replies));
    });
  });

  it("안내를 열면 국외 이전 5요소와 동의·거절 버튼이 보인다", async () => {
    const ai = fakeAi();
    await withServer(baseConfig(ai, createMemoryKakaoConsentStore()), async (say) => {
      const r = await say(KAKAO_CONSENT_COMMANDS.notice);
      for (const part of [/가린 문장/, /Google/, /해외/, /보관/, /동의하지 않아도/, /AI 끄기/]) assert.match(r.text, part);
      assert.deepEqual(r.replies.slice(0, 2), [KAKAO_CONSENT_COMMANDS.agree, KAKAO_CONSENT_COMMANDS.refuse]);
      assert.equal(ai.calls.length, 0);
    });
  });

  it("동의하면 다음 문자부터 AI를 부르고, ‘AI 끄기’ 뒤에는 다시 규칙만", async () => {
    const ai = fakeAi();
    const store = createMemoryKakaoConsentStore();
    await withServer(baseConfig(ai, store), async (say) => {
      const ok = await say(KAKAO_CONSENT_COMMANDS.agree);
      assert.match(ok.text, /다시 보내/);
      assert.equal(ai.calls.length, 0);
      const r = await say(SCAM);
      assert.equal(ai.calls.length, 1);
      assert.doesNotMatch(r.text, /규칙으로만 확인했어요/);
      await say(KAKAO_CONSENT_COMMANDS.off);
      const after = await say(SCAM);
      assert.equal(ai.calls.length, 1);
      // 거절한 사람에게는 매번 [AI 분석 안내]를 누르라고 하지 않는다. 왜 규칙만인지는 웹과 같은 문장으로 알린다(카카오·웹 일치)
      assert.doesNotMatch(after.text, /눌러 주세요/, "거절한 사람에게는 매번 묻지 않는다");
      assert.match(after.text, /허락하지 않아 정해진 규칙으로만 확인했어요/);
      assert.ok(after.replies.includes(KAKAO_CONSENT_COMMANDS.notice), "다시 켤 수 있는 버튼은 남긴다");
    });
  });

  it("사용자마다 따로 기록한다", async () => {
    const ai = fakeAi();
    await withServer(baseConfig(ai, createMemoryKakaoConsentStore()), async (say) => {
      await say(KAKAO_CONSENT_COMMANDS.agree, "user-a");
      await say(SCAM, "user-b");
      assert.equal(ai.calls.length, 0);
      await say(SCAM, "user-a");
      assert.equal(ai.calls.length, 1);
    });
  });

  it("동의 저장소가 없으면(설정 누락) 가장 보수적으로 규칙만", async () => {
    const ai = fakeAi();
    await withServer(baseConfig(ai, null), async (say) => {
      await say(KAKAO_CONSENT_COMMANDS.agree);
      await say(SCAM);
      assert.equal(ai.calls.length, 0);
    });
  });

  it("저장소 오류도 규칙만으로 판정한다", async () => {
    const ai = fakeAi();
    const broken = { get: async () => { throw new Error("db"); }, set: async () => { throw new Error("db"); } };
    await withServer(baseConfig(ai, broken), async (say) => {
      const r = await say(SCAM);
      assert.equal(ai.calls.length, 0);
      assert.match(r.text, /위험|주의/);
    });
  });
});

describe("카카오 사용자 키 해시", () => {
  it("비밀키 HMAC-SHA256 64자, 원래 키를 담지 않는다", () => {
    const h = kakaoUserHash("bot-user-key-1", "secret");
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.ok(!h.includes("bot-user-key-1"));
    assert.equal(h, kakaoUserHash("bot-user-key-1", "secret"));
    assert.notEqual(h, kakaoUserHash("bot-user-key-1", "other"));
  });
  it("키나 비밀값이 없으면 null", () => {
    assert.equal(kakaoUserHash(null, "s"), null);
    assert.equal(kakaoUserHash("k", null), null);
  });
  it("안내문은 1,000자 안이고 문구 버전이 있다", () => {
    assert.ok([...KAKAO_AI_NOTICE].length <= 1000);
    assert.match(KAKAO_CONSENT_VERSION, /^kakao-\d{4}-\d{2}-\d{2}-v\d+$/);
  });
});
