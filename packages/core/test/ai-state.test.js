// 카카오 답 ↔ 웹 [자세히 보기] 일치(docs/plan-kakao-web-consistency.md, 운영자 A안): AI 사용 상태 값
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AI_STATES, aiState, aiStateNotice } from "../src/ai-state.js";
import { RULES_ONLY_TEXT, AI_DECLINED_TEXT, HEALTH_SKIPPED_TEXT } from "../src/fixed-text.js";

const explained = { explanation_for_parent: ["설명"], fallback_used: false };
const none = { explanation_for_parent: [], fallback_used: true };

describe("aiState", () => {
  it("건강정보로 AI를 건너뛰면 health(동의 상태보다 먼저)", () => {
    assert.equal(aiState({ ...none, ai_skipped: "health" }, { consent: "granted" }), "health");
  });
  it("AI 설명이 있으면 explained", () => assert.equal(aiState(explained, { consent: "granted" }), "explained"));
  it("카카오 동의 기록 없음은 rules_only", () => assert.equal(aiState(none, { consent: "unknown" }), "rules_only"));
  it("거절·끄기는 declined", () => {
    assert.equal(aiState(none, { consent: "refused" }), "declined");
  });
  it("동의했는데 설명이 없으면(시간 초과·검증 실패) fallback", () => {
    assert.equal(aiState(none, { consent: "granted" }), "fallback");
    assert.equal(aiState(none, {}), "fallback");
  });
  it("모든 값은 정해진 목록 안", () => {
    for (const s of ["explained", "rules_only", "declined", "health", "fallback"]) assert.ok(AI_STATES.includes(s));
  });
});

describe("aiStateNotice", () => {
  it("동의 전·거절·건강정보는 정해진 문장, 나머지는 null", () => {
    assert.ok(aiStateNotice("rules_only").includes(RULES_ONLY_TEXT));
    assert.equal(aiStateNotice("declined"), AI_DECLINED_TEXT);
    assert.equal(aiStateNotice("health"), HEALTH_SKIPPED_TEXT);
    assert.equal(aiStateNotice("explained"), null);
    assert.equal(aiStateNotice("fallback"), null);
    assert.equal(aiStateNotice(undefined), null);
  });
});
