import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/validator.js";

// 유효한 기본 출력 (이 구조를 기준으로 변형해 테스트한다)
function base(overrides = {}) {
  return {
    signals: ["SIG_MONEY"],
    impersonation_type: "family",
    impersonated_relation: "딸",
    evidence_card_ids: ["EC001"],
    explanation_for_parent: ["돈을 요구하는 내용이 있어요."],
    ...overrides,
  };
}

describe("검증기 - 정상 통과", () => {
  it("유효한 구조는 ok: true를 반환한다", () => {
    const result = validate(base());
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.signals, ["SIG_MONEY"]);
  });

  it("허용 목록에 있는 카드 ID만 통과한다", () => {
    const result = validate(base({ evidence_card_ids: ["EC001", "UNKNOWN"] }), new Set(["EC001"]));
    assert.ok(result.ok);
    assert.deepEqual(result.data.evidence_card_ids, ["EC001"]);
  });

  it("카드 ID가 비어 있어도 통과한다", () => {
    const result = validate(base({ evidence_card_ids: [] }));
    assert.ok(result.ok);
  });
});

describe("검증기 - 신호 필터링", () => {
  it("허용 목록 밖 신호는 조용히 버린다", () => {
    const result = validate(base({ signals: ["SIG_MONEY", "SIG_LINK", "UNKNOWN_SIGNAL"] }));
    assert.ok(result.ok);
    // SIG_LINK는 코드 전용이라 AI 출력에서 허용 안 됨
    assert.ok(!result.data.signals.includes("SIG_LINK"));
    assert.ok(!result.data.signals.includes("UNKNOWN_SIGNAL"));
    assert.ok(result.data.signals.includes("SIG_MONEY"));
  });

  it("signals가 배열이 아니면 ok: false", () => {
    const result = validate(base({ signals: "SIG_MONEY" }));
    assert.equal(result.ok, false);
  });
});

describe("검증기 - impersonation_type", () => {
  it("family + relation 없음 → unknown으로 바꾼다", () => {
    const result = validate(base({ impersonated_relation: null }));
    assert.ok(result.ok);
    assert.equal(result.data.impersonation_type, "unknown");
    assert.equal(result.data.impersonated_relation, null);
  });

  it("허용 목록 밖 relation은 null로 바꾼다", () => {
    const result = validate(base({ impersonated_relation: "할머니" }));
    assert.ok(result.ok);
    assert.equal(result.data.impersonated_relation, null);
  });

  it("잘못된 impersonation_type은 ok: false", () => {
    const result = validate(base({ impersonation_type: "suspicious" }));
    assert.equal(result.ok, false);
  });
});

describe("검증기 - 설명 문장 필터", () => {
  it("'안전'이 포함된 문장을 제거한다", () => {
    const result = validate(base({ explanation_for_parent: ["이 문자는 안전해요.", "확인하세요."] }));
    assert.ok(result.ok);
    assert.ok(!result.data.explanation_for_parent.includes("이 문자는 안전해요."));
    assert.ok(result.data.explanation_for_parent.includes("확인하세요."));
  });

  it("'정상'이 포함된 문장을 제거한다", () => {
    const result = validate(base({ explanation_for_parent: ["정상적인 문자입니다."] }));
    assert.ok(result.ok);
    assert.equal(result.data.explanation_for_parent.length, 0);
  });

  it("숫자 4자리 이상 연속된 문장을 제거한다", () => {
    const result = validate(base({ explanation_for_parent: ["1234 라는 번호입니다."] }));
    assert.ok(result.ok);
    assert.equal(result.data.explanation_for_parent.length, 0);
  });

  it("URL이 포함된 문장을 제거한다", () => {
    const result = validate(base({ explanation_for_parent: ["https://example.com 확인하세요."] }));
    assert.ok(result.ok);
    assert.equal(result.data.explanation_for_parent.length, 0);
  });

  it("40자 초과 문장은 40자로 자른다", () => {
    const long = "가".repeat(50);
    const result = validate(base({ explanation_for_parent: [long] }));
    assert.ok(result.ok);
    assert.equal([...result.data.explanation_for_parent[0]].length, 40);
  });

  it("최대 3문장을 넘으면 앞 3개만 남긴다", () => {
    const result = validate(base({
      explanation_for_parent: ["a", "b", "c", "d"],
    }));
    assert.ok(result.ok);
    assert.equal(result.data.explanation_for_parent.length, 3);
  });
});

describe("검증기 - 스키마 오류", () => {
  it("null 입력은 ok: false", () => {
    assert.equal(validate(null).ok, false);
  });

  it("배열 입력은 ok: false", () => {
    assert.equal(validate([]).ok, false);
  });

  it("evidence_card_ids가 배열이 아니면 ok: false", () => {
    assert.equal(validate(base({ evidence_card_ids: "EC001" })).ok, false);
  });

  it("explanation_for_parent가 배열이 아니면 ok: false", () => {
    assert.equal(validate(base({ explanation_for_parent: "설명" })).ok, false);
  });
});
