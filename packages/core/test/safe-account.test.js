// D50(운영자 결정 2026-11-27): 수사기관(검찰·경찰·법원·금감원) 사칭 + ‘안전계좌’로 돈을 옮기라는 요구는 AI 없이도 위험.
// 수사기관은 돈을 ‘안전계좌·보호계좌’로 옮기라고 하지 않는다. 문장은 모두 지어낸 것이다.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

const run = (text) => {
  const s = extractCodeSignals(text).signals;
  return { signals: s, ...decide({ signals_final: s, signals_code: s }) };
};

describe("D50 수사기관 + 안전계좌 이체 요구 → 위험", () => {
  for (const text of [
    "[서울중앙지검] 귀하 명의 계좌가 범죄에 연루되어 동결 예정입니다. 예금 보호를 위해 안전계좌로 이체하세요",
    "금융감독원입니다. 고객님 자산을 보호계좌로 옮겨 주세요",
    "경찰청 수사팀입니다 피해 예방을 위해 국가 안전 계좌로 송금 바랍니다",
    "법원 통지. 예금이 압류되기 전에 안전한 계좌로 옮기셔야 합니다",
  ]) {
    it(text, () => {
      const r = run(text);
      assert.ok(r.signals.includes(SIG_THIRD_PARTY_ACCOUNT), String(r.signals));
      assert.equal(r.level, "위험");
    });
  }
});

describe("D50 경계", () => {
  it("안전계좌 이야기를 하는 예방 경고문은 신호를 켜지 않는다", () => {
    for (const text of [
      "[금융감독원] 검찰·경찰은 절대 안전계좌로 이체를 요구하지 않습니다",
      "경찰청 안내: 안전계좌로 옮기라는 전화는 100% 사기입니다",
    ]) {
      assert.ok(!run(text).signals.includes(SIG_THIRD_PARTY_ACCOUNT), text);
    }
  });
  it("수사기관이 아닌 곳 + 안전계좌는 이 규칙 대상이 아니다", () => {
    assert.ok(!run("[OO쇼핑] 환불금은 안전계좌로 입금해 드립니다").signals.includes(SIG_THIRD_PARTY_ACCOUNT));
  });
  it("진짜 세금 납부 안내는 그대로 위험이 아니다", () => {
    assert.notEqual(run("[국세청] 종합소득세 납부 기한은 5월 31일입니다. 홈택스에서 납부하세요").level, "위험");
  });
  it("수사기관 + 돈 요구만(안전계좌 없음)은 이 신호를 켜지 않는다", () => {
    for (const text of ["[서울중앙지검] 벌금 30만원을 납부하세요", "검찰청입니다 벌금을 송금하세요"]) {
      assert.ok(!run(text).signals.includes(SIG_THIRD_PARTY_ACCOUNT), text);
    }
  });
});
