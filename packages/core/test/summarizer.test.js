import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarize, summarizePhrases } from "../src/summarizer.js";

describe("요약 문구 생성", () => {
  it("단일 신호를 문구로 변환한다", () => {
    assert.equal(summarize(["SIG_MONEY"]), "송금 요구");
  });

  it("여러 신호를 ' · '로 잇는다", () => {
    const result = summarize(["SIG_LINK", "SIG_URGENCY"]);
    assert.equal(result, "링크 포함 · 급하게 재촉");
  });

  it("SIG_FAMILY_IMPERSONATION은 relation을 포함한 문구로", () => {
    const result = summarize(["SIG_FAMILY_IMPERSONATION"], { impersonated_relation: "딸" });
    assert.equal(result, "딸이라고 함");
  });

  it("relation이 없으면 '가족이라고 함'", () => {
    const result = summarize(["SIG_FAMILY_IMPERSONATION"]);
    assert.equal(result, "가족이라고 함");
  });

  it("알 수 없는 ID는 문구에서 빠진다", () => {
    const result = summarize(["SIG_MONEY", "UNKNOWN_SIG"]);
    assert.equal(result, "송금 요구");
  });

  it("빈 배열이면 빈 문자열", () => {
    assert.equal(summarize([]), "");
  });

  it("받침 없는 관계는 '라고 함' (엄마라고 함)", () => {
    assert.equal(summarize(["SIG_FAMILY_IMPERSONATION"], { impersonated_relation: "엄마" }), "엄마라고 함");
    assert.equal(summarize(["SIG_FAMILY_IMPERSONATION"], { impersonated_relation: "언니" }), "언니라고 함");
  });

  it("받침 있는 관계는 '이라고 함' (아들이라고 함)", () => {
    assert.equal(summarize(["SIG_FAMILY_IMPERSONATION"], { impersonated_relation: "아들" }), "아들이라고 함");
    assert.equal(summarize(["SIG_FAMILY_IMPERSONATION"], { impersonated_relation: "동생" }), "동생이라고 함");
  });

  it("summarizePhrases는 문구 배열을 돌려준다(웹 SignalList용)", () => {
    assert.deepEqual(
      summarizePhrases(["SIG_FAMILY_IMPERSONATION", "SIG_NEW_NUMBER", "UNKNOWN"], { impersonated_relation: "딸" }),
      ["딸이라고 함", "새 번호로 연락"],
    );
  });

  it("같은 문구는 한 번만", () => {
    assert.deepEqual(summarizePhrases(["SIG_MONEY", "SIG_MONEY"]), ["송금 요구"]);
  });

  it("PRD 9-9 전체 신호 매핑을 확인한다", () => {
    const all = [
      "SIG_NEW_NUMBER", "SIG_LINK", "SIG_GIFTCARD", "SIG_APP_INSTALL",
      "SIG_MONEY", "SIG_DELETE_APP", "SIG_PERSONAL_INFO", "SIG_PREPAYMENT",
      "SIG_AGENCY_IMPERSONATION", "SIG_ISOLATION", "SIG_URGENCY", "SIG_SECRECY",
      "SIG_AVOID_VOICE", "SIG_CALL_THIS_NUMBER", "SIG_THIRD_PARTY_ACCOUNT",
      "SIG_SHORT_URL", "SIG_MALICIOUS_URL",
    ];
    const result = summarize(all);
    // 17개 신호 → 17개 문구가 ' · '로 연결되면 구분자가 16개
    assert.equal(result.split(" · ").length, 17);
  });
});
