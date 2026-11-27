import assert from "node:assert/strict";
import test from "node:test";
import { classifyCallback } from "../src/callback-number.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { analyze } from "../src/pipeline.js";

const number = "010-0000-0000";
const official = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
  .flatMap(card => card.callback_contact?.numbers ?? []).find(value => value.replace(/\D/g, "").length >= 8);
assert.ok(official, "대조에 쓸 카드의 긴 대표 번호가 필요합니다.");
const origin = "국외에서 발송됐다고 표시된 알림을 받았습니다.";
const approval = "거래가 승인되었다고 적혀 있었고";
const condition = "제가 한 거래가 아니라면";
const contact = phone => "발신자가 지정한 취소 접수 번호 " + phone + " 로 회신해야 한다는 내용이었습니다.";
const report = (...parts) => parts.join(" ");

for (const [name, text] of [
  ["수신한 안내의 승인 사실과 지정된 취소 접수 연락처",
    report(origin, approval, condition, contact(number))],
  ["결제 승인과 부인 조건이 연속한 다른 문장",
    report("해외 발신으로 표시된 메시지를 확인했습니다.", "카드 결제가 승인됐다고 적혀 있었습니다.",
      "본인 결제가 아닌 경우 문자에 실린 취소용 연락처 " + number + " 으로 전화해야 한다고 했습니다.")],
  ["접수 창구 변경과 메시지에 적힌 번호",
    report("국제 발신이라고 표시된 문자가 왔습니다.", "이미 결제가 완료되었고",
      "제 결제가 아닐 때 평소 상담 창구 대신 상대가 따로 적은 취소 문의 번호 " + number + " 로 연락하라는 안내였습니다.")],
]) {
  test(name, async () => {
    assert.ok(classifyCallback(text, []).foreignPayment);
    assert.ok((await analyze({ text, ai: null })).fired_rules.includes("R19"));
  });
}

for (const [name, text] of [
  ["국외 거래이지만 발신지는 국내", report("국내 발신으로 표시된 해외 거래 안내입니다.", approval, condition, contact(number))],
  ["결제 예정", report(origin, "거래 승인 예정이라고 적혀 있었고", condition, contact(number))],
  ["이미 취소된 승인", report(origin, "거래 승인이 취소되었다고 적혀 있었고", condition, contact(number))],
  ["승인 여부를 확인하는 질문", report(origin, "거래가 승인됐는지 문의했고", condition, contact(number))],
  ["본인 결제라는 반대 조건", report(origin, approval, "제가 한 거래라면", contact(number))],
  ["취소 창구가 없는 영수증", report(origin, approval, condition, "결제 내역을 보관한다고 했습니다.")],
  ["번호가 빠진 접수 안내", report(origin, approval, condition, contact("번호 미기재"))],
  ["근거 카드에 등록된 번호", report(origin, approval, condition, contact(official))],
  ["일반 배송 문의처", report(origin, approval, condition, contact(number).replace("취소 접수", "상품 배송"))],
  ["다른 메시지의 번호", report(origin, approval, "관련 안내는 끝났습니다.",
    "다른 곳에서 받은 별도 문자에는", condition, contact(number))],
  ["서로 다른 기록 사이에는 빈 줄", report(origin, approval + "\n\n", condition, contact(number))],
  ["발신자가 같은 요청을 철회", report(origin, approval, condition, contact(number), "그 취소 요청은 이미 철회됐습니다.")],
  ["같은 절에서 요청을 취소한 발신자", report(origin, approval, condition,
    "발신자가 지정한 취소 접수 번호 " + number + " 로 회신해야 한다는 내용이었지만 발신자가 그 요청을 철회했습니다.")],
  ["교육 자료에서 읽은 사례", report("피해 예방 교육 자료입니다.", origin, approval, condition, contact(number))],
  ["고객이 독립적으로 확인한 창구", report(origin, approval, condition,
    "제가 직접 찾아본 취소 접수 번호 " + number + " 로 연결된다는 경험을 적었습니다.")],
]) {
  test(name, async () => {
    assert.equal(classifyCallback(text, []).foreignPayment, false);
    assert.equal((await analyze({ text, ai: null })).fired_rules.includes("R19"), false);
  });
}
