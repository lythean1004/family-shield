import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../src/rule-engine.js";

// PRD 9-7 규칙 표 기반 테스트
// 평가셋 기대값(DEV-C01 등)에 맞게 레이블을 붙인다.

describe("규칙 엔진 - 위험 판정", () => {
  it("R1: 통화 중이면 위험", () => {
    const { level, fired_rules } = decide({ signals_final: [], call_in_progress: true });
    assert.equal(level, "위험");
    assert.ok(fired_rules.includes("R1"));
  });

  it("R2: 전화 받은 뒤 링크 → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_LINK"], called_before: true });
    assert.equal(level, "위험");
  });

  it("R2: 전화 받은 뒤 앱 설치 요구 → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_APP_INSTALL"], called_before: true });
    assert.equal(level, "위험");
  });

  it("R3: 가족 사칭 + 새 번호 + 돈 요구 → 위험 (DEV-C01 기준)", () => {
    const { level, fired_rules } = decide({
      signals_final: ["SIG_FAMILY_IMPERSONATION", "SIG_NEW_NUMBER", "SIG_MONEY"],
    });
    assert.equal(level, "위험");
    assert.ok(fired_rules.includes("R3"));
  });

  it("R3: 가족 사칭 + 새 번호 + 상품권 요구 → 위험", () => {
    const { level } = decide({
      signals_final: ["SIG_FAMILY_IMPERSONATION", "SIG_NEW_NUMBER", "SIG_GIFTCARD"],
    });
    assert.equal(level, "위험");
  });

  it("R4: 가족 사칭 + 통화 회피 → 위험", () => {
    const { level, fired_rules } = decide({
      signals_final: ["SIG_FAMILY_IMPERSONATION", "SIG_AVOID_VOICE"],
    });
    assert.equal(level, "위험");
    assert.ok(fired_rules.includes("R4"));
  });

  it("R5: 가족이 부인 → 위험", () => {
    const { level } = decide({ signals_final: [], family_denied: true });
    assert.equal(level, "위험");
  });

  it("R6: 기관 사칭 + 링크 → 위험", () => {
    const { level, fired_rules } = decide({
      signals_final: ["SIG_AGENCY_IMPERSONATION", "SIG_LINK"],
    });
    assert.equal(level, "위험");
    assert.ok(fired_rules.includes("R6"));
  });

  it("R6: 기관 사칭 + 문자 속 번호로 전화 유도 → 위험", () => {
    const { level } = decide({
      signals_final: ["SIG_AGENCY_IMPERSONATION", "SIG_CALL_THIS_NUMBER"],
    });
    assert.equal(level, "위험");
  });

  it("R9: 고립 요구 → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_ISOLATION"] });
    assert.equal(level, "위험");
  });

  it("R9: 선입금 요구 → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_PREPAYMENT"] });
    assert.equal(level, "위험");
  });

  it("R9: 개인 계좌 입금 요구 → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_THIRD_PARTY_ACCOUNT"] });
    assert.equal(level, "위험");
  });

  it("R9: 앱 삭제 지시 → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_DELETE_APP"] });
    assert.equal(level, "위험");
  });

  it("R10: 악성 URL → 위험", () => {
    const { level } = decide({ signals_final: ["SIG_MALICIOUS_URL"] });
    assert.equal(level, "위험");
  });
});

describe("규칙 엔진 - 주의 판정", () => {
  it("R7: 링크만 있으면 주의", () => {
    const { level, fired_rules } = decide({ signals_final: ["SIG_LINK"] });
    assert.equal(level, "주의");
    assert.ok(fired_rules.includes("R7"));
  });

  it("R7: 돈 요구만 있으면 주의", () => {
    const { level } = decide({ signals_final: ["SIG_MONEY"] });
    assert.equal(level, "주의");
  });

  it("R7: 개인정보 요구만 있으면 주의", () => {
    const { level } = decide({ signals_final: ["SIG_PERSONAL_INFO"] });
    assert.equal(level, "주의");
  });

  it("R7: 재촉만 있으면 주의", () => {
    const { level } = decide({ signals_final: ["SIG_URGENCY"] });
    assert.equal(level, "주의");
  });

  it("R7: 비밀 요구만 있으면 주의", () => {
    const { level } = decide({ signals_final: ["SIG_SECRECY"] });
    assert.equal(level, "주의");
  });

  it("R7: 가족 사칭 + 새 번호 (돈 요구 없음) → 주의", () => {
    const { level, fired_rules } = decide({
      signals_final: ["SIG_FAMILY_IMPERSONATION", "SIG_NEW_NUMBER"],
    });
    assert.equal(level, "주의");
    assert.ok(fired_rules.includes("R7"));
  });

  it("DEV-C02: 링크·요구 없는 택배 주소 확인 → 확인필요", () => {
    // PRD v0.3에서 '주의'에서 '확인필요'로 정정된 케이스 (15-1)
    const { level } = decide({ signals_final: ["SIG_AGENCY_IMPERSONATION"] });
    assert.equal(level, "확인필요");
  });
});

describe("규칙 엔진 - 확인필요 판정", () => {
  it("R8: 신호 없음 → 확인필요", () => {
    const { level, fired_rules } = decide({ signals_final: [] });
    assert.equal(level, "확인필요");
    assert.ok(fired_rules.includes("R8"));
  });

  it("기관 사칭만 있고 위험 신호 없음 → 확인필요", () => {
    const { level } = decide({ signals_final: ["SIG_AGENCY_IMPERSONATION"] });
    assert.equal(level, "확인필요");
  });
});

describe("규칙 엔진 - 복합 (판정은 올라가기만)", () => {
  it("R7 조건과 R3 조건이 동시에 있으면 위험이 우선", () => {
    const { level, fired_rules } = decide({
      signals_final: ["SIG_FAMILY_IMPERSONATION", "SIG_NEW_NUMBER", "SIG_MONEY", "SIG_URGENCY"],
    });
    assert.equal(level, "위험");
    assert.ok(fired_rules.includes("R3"));
    assert.ok(fired_rules.includes("R7"));
  });

  it("통화 안 했고 링크만 있으면 위험 아님", () => {
    const { level } = decide({ signals_final: ["SIG_LINK"], called_before: false });
    assert.equal(level, "주의");
  });
});
