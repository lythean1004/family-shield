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

  it("40자 경계는 유지하고 긴 문장의 일부만 표시하지 않는다", () => {
    const limit = "가".repeat(40);
    const result = validate(base({ explanation_for_parent: [limit + "요", limit] }));
    assert.deepEqual(result.data.explanation_for_parent, [limit]);
  });

  it("내부 신호·무이상 단정·보이지 않는 문자를 걸러도 쉬운 안내는 남는다", () => {
    const keep = "보낸 곳을 다시 확인해 보세요.";
    const result = validate(base({ explanation_for_parent: [
      "SIG_MONEY 항목이에요.", "이상이 없어요.", "이상 없습니다.", "확인\u200b해요.", keep,
    ] }));
    assert.deepEqual(result.data.explanation_for_parent, [keep]);
    assert.deepEqual(result.data.signals, ["SIG_MONEY"]);
  });

  // 카카오 2026-11-27: “돈을 보내라는 내용은 모두 사기입니다.” — 진짜 가족 부탁·납부 안내까지 사기로 읽힌다
  it("사기를 단정·일반화하는 문장을 제거한다", () => {
    for (const s of [
      "돈을 보내라는 내용은 모두 사기입니다.",
      "이런 문자는 무조건 사기예요.",
      "100% 사기입니다.",
      "전부 사기니까 무시하세요.",
      "이 문자는 사기가 확실해요.",
      "틀림없이 사기예요.",
      "모든 송금 요구는 사기입니다.",
    ]) {
      const result = validate(base({ explanation_for_parent: [s] }));
      assert.deepEqual(result.data.explanation_for_parent, [], s);
    }
  });

  it("단정이 아닌 안내·사칭 설명은 남는다", () => {
    const keep = [
      "검찰을 사칭하여 계좌 이체를 요구하고 있어요.",
      "링크는 절대 누르지 마세요.",
      "모르는 주소를 누르지 마세요.",
      "사기일 수 있으니 공식 번호로 확인하세요.",
    ];
    const result = validate(base({ explanation_for_parent: keep.slice(0, 3) }));
    assert.deepEqual(result.data.explanation_for_parent, keep.slice(0, 3));
    assert.deepEqual(validate(base({ explanation_for_parent: [keep[3]] })).data.explanation_for_parent, [keep[3]]);
  });

  it("최대 3문장을 넘으면 앞 3개만 남긴다", () => {
    const result = validate(base({
      explanation_for_parent: ["첫째예요.", "둘째예요.", "셋째예요.", "넷째예요."],
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
