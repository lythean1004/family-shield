import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_CALL_THIS_NUMBER, SIG_AGENCY_IMPERSONATION } from "../src/signals.js";

const number = "010-0000-XXXX".replace("XXXX", "0".repeat(4));
const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);

describe("전담 창구에 결제·본인확인을 하도록 지정한 회신 번호", () => {
  for (const [issuer, text] of [
    ["국민연금공단", "본인 확인 서식 / 전담창구 N 로 전화하시어 확인"],
    ["신한카드", "해외 승인 견본 / 신고센터 N 으로 연락 바랍니다"],
    ["국민건강보험공단", "환급 문의 서식 / 전담 상담실 N 로 전화 주시면 확인합니다"],
    ["삼성카드", "분실신고 양식 / 명의도용 우려가 있다면 N 으로 확인 바랍니다"],
    ["지방검찰청 조사부", "담당 수사관(N)에게 직접 연락 바랍니다"],
  ]) it(issuer, () => {
    const signals = extractCodeSignals("[" + issuer + "] " + text.replace("N", number)).signals;
    assert.ok(signals.includes(SIG_CALL_THIS_NUMBER) && signals.includes(SIG_AGENCY_IMPERSONATION));
  });
  for (const text of [
    "전담창구 N으로 전화하지 마세요.",
    "오늘 교육에서 들은 ‘전담 상담실 N 로 전화 주시면’이라는 표현입니다.",
    "분실신고 기록. N으로 확인했습니다.",
    "신고센터 N의 전화상담 기록을 보관 중입니다.",
  ]) it(text, () => assert.ok(!hasCall(text.replace("N", number))));
  it("같은 창구 표현이라도 일반 행사 안내는 기관 사칭으로 올리지 않는다", () => {
    const signals = extractCodeSignals("[신한카드] 미술 교실 전담창구 " + number + " 로 전화하시어 참석 여부를 알려주세요.").signals;
    assert.ok(!signals.includes(SIG_AGENCY_IMPERSONATION));
  });
  it("대표번호와 분실신고 번호는 카드에서 대조한다", () => {
    for (const name of ["신한카드", "삼성카드", "국민연금공단", "국민건강보험공단"]) {
      const card = OFFICIAL_DOMAIN_CARDS.find(item => item.name === name);
      for (const phone of card.callback_contact.numbers) {
        assert.ok(!hasCall("본인확인 전담창구 " + phone + " 로 전화하시어 확인하세요."));
      }
    }
  });
});

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
