import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkCase, ruleMismatch, similarity, SIMILARITY_LIMIT } from "../validate.mjs";

const base = {
  case_id: "T-A01", split: "test", group: "A", message_text: "엄마 나야 새 번호 010-0000-1111 급해",
  parent_inputs: {},
  gold: {
    signals_code: [], signals_ai: ["SIG_FAMILY_IMPERSONATION", "SIG_NEW_NUMBER"],
    impersonation_type: "family", impersonated_relation: "딸", level_human: "주의", level_rule: "주의",
  },
};

describe("평가 케이스 검사 (PRD 15-1)", () => {
  it("정상 케이스는 문제 없음", () => {
    assert.deepEqual(checkCase(base), []);
    assert.equal(ruleMismatch(base), null);
  });

  it("실제처럼 보이는 휴대폰 번호는 거부(010-0000-XXXX만)", () => {
    const errs = checkCase({ ...base, message_text: "010-1234-5678로 연락" });
    assert.ok(errs.some((e) => e.includes("010-0000")));
  });

  it(".invalid가 아닌 링크는 거부, 단축 URL은 허용", () => {
    assert.ok(checkCase({ ...base, message_text: "http://real-bank.com/login" }).length > 0);
    assert.deepEqual(checkCase({ ...base, message_text: "http://bank.invalid/login bit.ly/x" }), []);
  });

  it("모르는 신호·잘못된 판정 값", () => {
    const errs = checkCase({ ...base, gold: { ...base.gold, signals_ai: ["SIG_WHAT"], level_rule: "안전" } });
    assert.ok(errs.some((e) => e.includes("SIG_WHAT")));
    assert.ok(errs.some((e) => e.includes("level_rule")));
  });

  it("평가용은 D1/D2만, 개발용은 D 허용", () => {
    assert.ok(checkCase({ ...base, group: "D" }).length > 0);
    assert.deepEqual(checkCase({ ...base, split: "dev", group: "D" }), []);
  });

  it("규칙 엔진과 다르면 알려 준다", () => {
    assert.match(ruleMismatch({ ...base, gold: { ...base.gold, level_rule: "위험" } }), /주의/);
  });

  it("말만 바꾼 문장은 유사도가 높다", () => {
    const a = "엄마 나 폰 액정 깨져서 이 번호로 연락해 상품권 좀 사줘";
    assert.ok(similarity(a, "엄마 나 폰 액정 깨져서 이 번호로 연락해. 상품권 좀 사 줘!") >= SIMILARITY_LIMIT);
    assert.ok(similarity(a, "[택배] 주소 불일치로 반송 예정입니다") < SIMILARITY_LIMIT);
  });
});
