import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";
import { SIG_CALL_THIS_NUMBER, SIG_AGENCY_IMPERSONATION, AI_ALLOWED_SIGNALS, codeOnlyFrom } from "../src/signals.js";

const number = "010-0000-XXXX".replace("XXXX", "0".repeat(4));
const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);

describe("D56 해외 발신 결제 알림의 미승인 취소 창구", () => {
  const signal = "SIG_FOREIGN_PAYMENT_CALLBACK";
  const official = OFFICIAL_DOMAIN_CARDS.find(c => c.id === "EV-DOM-EPOST").callback_contact.numbers[0];
  const notice = (status, route, header = "[국외발신]") => [header, "분류 서식 / " + status, route].join("\n");
  const desk = "본인 결제가 아닌 경우 취소 접수처 ";
  for (const [header, status, route] of [
    ["[국외발신]", "결제 완료", desk + number],
    ["[국제발신]", "카드 승인 완료", "본인이 승인하지 않았다면 거래 취소 문의: " + number],
    ["[Web발신] [해외 발신]", "결제가 완료되었습니다.", "본인 거래가 아니면 결제 취소 고객센터 " + number],
    ["국제발신:", "결제 완료 USD 0.00", "본인이 한 결제가 아니라면 아래 번호로 취소를 접수하세요: " + number],
    ["[국제발신]", "결제 완료", "본인 결제가 아닐 시 " + number + "로 거래 취소를 신청하십시오."],
  ]) it(status + " / 지정 취소 번호", async () => {
    const r = await analyze({ text: notice(status, route, header) });
    assert.equal(r.level, "위험");
    assert.ok(r.fired_rules.includes("R19") && r.signals_code.includes(signal));
    assert.match(r.summary, /결제.*취소/);
  });
  for (const [name, text] of [
    ["정상 영수증", notice("결제 완료", "영수증을 발급했습니다. 주문 문의 " + number)],
    ["확인된 대표번호", notice("결제 완료", desk + official)],
    ["다른 곳에 미확인 번호가 적힌 공식 취소 창구", notice("결제 완료", desk + official + ". 배송 문의 " + number)],
    ["국내 발신", notice("결제 완료", desk + number, "[Web발신]")],
    ["취소 영수증", notice("결제 취소 완료", desk + number)],
    ["미처리 통지", notice("결제가 완료되지 않았습니다.", desk + number)],
    ["미래 결제", notice("결제 완료 예정", desk + number)],
    ["결제 방법 안내", notice("결제 완료 후 영수증을 출력하는 방법", desk + number)],
    ["단순 결제 취소 연락처", notice("결제 완료", "단순 변심에 따른 취소 문의 " + number)],
    ["별도 행사 연락처", notice("결제 완료. 별도 행사 안내입니다.", desk + number)],
    ["예방 자료", notice("사칭 피해 예방 안내 / 결제 완료", desk + number)],
    ["인용된 옛 창구", notice("카드 승인 완료", "‘" + desk + number + "’라는 문구가 쓰였습니다.")],
    ["취소는 앱에서, 번호는 배송처", notice("결제 완료", "본인 결제가 아닐 시 앱에서 취소하세요. 배송 문의 " + number)],
  ]) it(name, async () => {
    const r = await analyze({ text });
    assert.notEqual(r.level, "위험");
    assert.ok(!r.signals_code.includes(signal));
  });
  it("저장 결과에 남는 코드 전용 근거이며 AI 추출값만으로는 발동하지 않는다", () => {
    assert.deepEqual(codeOnlyFrom([signal]), [signal]);
    assert.ok(!AI_ALLOWED_SIGNALS.has(signal));
    assert.ok(!decide({ signals_code: [], signals_final: [signal] }).fired_rules.includes("R19"));
  });
  it("기존에 로컬에서 처리하던 건강 관련 알림은 새 결제 신호만으로 AI에 보내지 않는다", async () => {
    let calls = 0;
    const r = await analyze({ text: notice("안과 진료 영수증 / 결제 완료", desk + number), ai: {
      model: "fixture", apiKey: "fixture", fetchImpl: async () => { calls++; throw Error("fixture"); },
    } });
    assert.deepEqual([r.level, r.ai_skipped, calls], ["위험", "health", 0]);
  });
});

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
