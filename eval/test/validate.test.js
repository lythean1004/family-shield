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

  it("문자형 평가의 정상·경계 사례만 근거 카드의 대표 홈페이지를 사용할 수 있다", () => {
    const official = { ...base, group: "D1", message_text: "은행 첫 화면 www.kbanknow.com" };
    assert.deepEqual(checkCase(official, { messageDataset: true }), []);
    assert.deepEqual(checkCase({ ...official, group: "E" }, { messageDataset: true }), []);
    assert.ok(checkCase(official).length);
    assert.ok(checkCase({ ...official, group: "B" }, { messageDataset: true }).length);
    for (const link of ["www.example.org", "www.kbanknow.com/archive", "other.epost.go.kr"]) {
      assert.ok(checkCase({ ...official, message_text: link }, { messageDataset: true }).length, link);
    }
  });

  it("문자형 평가의 공식 주소 정답 대조에는 공식 주소 조건과 동봉된 통화 정보가 반영된다", () => {
    const sample = { ...base, group: "D1", message_text: "공식 첫 화면 www.kbanknow.com",
      gold: { ...base.gold, signals_code: ["SIG_LINK"], signals_ai: [], level_rule: "확인필요" } };
    assert.equal(ruleMismatch(sample, { messageDataset: true }), null);
    assert.equal(ruleMismatch({ ...sample, parent_inputs: { called_before: true },
      gold: { ...sample.gold, level_rule: "위험" } }, { messageDataset: true }), null);
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
