import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_CALL_THIS_NUMBER, SIG_AGENCY_IMPERSONATION } from "../src/signals.js";

const number = "010-0000-XXXX".replace("XXXX", "0".repeat(4));
const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);

describe("요청에 적힌 회신 번호", () => {
  for (const text of [
    `전시 중 파손 신고는 아래 번호로 신고하세요. ☎ ${number}`,
    `분실물 접수처 ${number} 로 바로 연락주세요.`,
    `시간 변경은 상담원 연결 ${number} (내선 안내)`,
  ]) it(text, () => assert.ok(hasCall(text)));

  for (const text of [
    `교육 자료의 번호 ${number} 로 연락하지 마세요.`,
    `공지 양식에 전화번호 ${number} 가 있습니다.`,
    `접수 기록입니다. 아래 번호로 신고했습니다. ${number}`,
    `상담원 연결 ${number}은 지난 행사 안내에 있던 예시입니다.`,
  ]) it(text, () => assert.ok(!hasCall(text)));

  it("자료로 확인한 대표번호에는 회신 유도 신호를 붙이지 않는다", () => {
    const card = OFFICIAL_DOMAIN_CARDS.find(c => c.id === "EV-DOM-EPOST");
    const official = card.callback_contact.numbers[0];
    assert.ok(!hasCall(`아래 번호로 연락해 주세요. ☎ ${official}`));
    assert.ok(!hasCall(`[우체국] 고객센터 ${official} 로 바로 연락주세요.`));
    assert.ok(hasCall(`고객센터 ${official}. 분실물 접수처 ${number} 로 연락주세요.`));
  });

  it("등록된 발신 이름과 별도 회신처로 접수를 지시하는 경우를 함께 찾는다", () => {
    const sig = extractCodeSignals(`[우체국] 분실물 확인은 상담원 연결 ${number}`).signals;
    assert.ok(sig.includes(SIG_CALL_THIS_NUMBER) && sig.includes(SIG_AGENCY_IMPERSONATION));
  });
});
