// 2026-11-28: 개발 세트 v15에서 AI 경로로도 놓친 유형을 코드가 잡도록 넓혔다.
// 평가 세트 문장은 저장소에 옮기지 않고, 같은 유형을 새로 지어낸 문장으로 확인한다.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { systemPromptFor } from "../src/ai-client.js";
import {
  SIG_CASH_HANDOVER, SIG_LOAN_CASH_PICKUP, SIG_DOCUMENT_BUNDLE, SIG_SECRECY, SIG_MONEY, SIG_THIRD_PARTY_ACCOUNT,
} from "../src/signals.js";

const run = (text) => {
  const s = extractCodeSignals(text).signals;
  return { signals: s, ...decide({ signals_final: s, signals_code: s }) };
};

describe("위험으로 올라가야 하는 유형", () => {
  const cases = [
    [SIG_CASH_HANDOVER, "경찰청입니다 사건 확인을 위해 찾으신 현금은 오늘 오후 3시 수사관이 방문해 수거합니다"],
    [SIG_LOAN_CASH_PICKUP, "△△캐피탈 대출상환 안내\n기존 대출금을 현금으로 준비하시면 저희 직원이 방문 수령합니다"],
    [SIG_DOCUMENT_BUNDLE, "재택 부업 모집 안내\n신청하려면 신분증 사진+통장 사본+카드 앞뒤 사진 보내주세요\nwork-form.invalid"],
    [SIG_THIRD_PARTY_ACCOUNT, "직거래가 어려워서요 안전결제는 번거로우니 제 계좌로 먼저 입금해 주세요"],
  ];
  for (const [signal, text] of cases) {
    it(text, () => {
      const r = run(text);
      assert.ok(r.signals.includes(signal), String(r.signals));
      assert.equal(r.level, "위험");
    });
  }
  it("조건형 금액 요구와 가족에게 숨기라는 말", () => {
    const r = run("자기야 비행기표 값이 모자라 200만원만 보내주면 다음 주에 갚을게. 부모님한텐 비밀이야");
    assert.ok(r.signals.includes(SIG_MONEY) && r.signals.includes(SIG_SECRECY), String(r.signals));
  });
});

describe("경계: 예방 안내와 일상 대화는 올리지 않는다", () => {
  for (const text of [
    "중고거래할 때 안전결제 말고 계좌로 먼저 보내라고 하면 사기예요",
    "수사기관은 현금을 직원이 방문해 수거하지 않습니다. 이런 문자는 사기입니다",
    "엄마 비밀번호 바꿨어? 저녁에 통화해",
    "택배 도착했어요 문 앞에 두었습니다",
  ]) {
    it(text, () => assert.notEqual(run(text).level, "위험", String(run(text).signals)));
  }
});

describe("프롬프트 v4", () => {
  it("v3에 놓침 보완 문장을 더한다", () => {
    assert.ok(systemPromptFor("v4").startsWith(systemPromptFor("v3")));
    assert.match(systemPromptFor("v4"), /첫머리의 \[이름\]/);
  });
});
