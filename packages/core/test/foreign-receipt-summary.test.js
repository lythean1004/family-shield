import assert from "node:assert/strict";
import test from "node:test";
import { classifyCallback } from "../src/callback-number.js";
import { analyze } from "../src/pipeline.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";

const fixture = "000-0000-0000";
const officialNumber = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
  .flatMap(card => card.callback_contact?.numbers ?? []).find(number => number.replace(/\D/g, "").length >= 8);
assert.ok(officialNumber, "공식 취소 연락처 대조에 쓸 긴 번호가 근거 카드에 있어야 합니다.");
const heading = "국외 발신 안내 분류 기록.";
const approval = "결제 승인 사실로 표시됨.";
const condition = "본인 거래가 아닐 때";
const route = value => "취소할 연락처로 " + value + "이 본문에 지정되었음.";
const report = (...clauses) => clauses.filter(Boolean).join(" ");

const positive = [
  report(heading, approval, condition, route(fixture)),
  report("수신 내역 발췌 요약.", "해외 발신으로 표시된 문자에 결제 승인 통보가 있었음.", condition, route(fixture)),
  report("수신 기록 요약.", "문자에 국제 발신으로 표시됨.", "카드 결제 승인 완료로 기록됨.",
    "본인이 한 결제가 아닌 경우", "결제 취소 문의처로 미확인 " + fixture + "이 그 문자에 기재됨."),
];

const negative = [
  ["국외 표시가 없음", report("수신 내역 발췌 요약.", approval, condition, route(fixture))],
  ["결제가 승인 대기 중", report(heading, "결제 승인 대기로 표시됨.", condition, route(fixture))],
  ["명의자의 조건이 없음", report(heading, approval, route(fixture))],
  ["구체적인 번호가 없음", report(heading, approval, condition, route("번호 가림"))],
  ["번호가 일부만 표시됨", report(heading, approval, condition, route("000-****-0000"))],
  ["검증된 카드 번호", report(heading, approval, condition, route(officialNumber))],
  ["국외 표시가 아니라고 보고함", report("국외 발신이 아닌 안내 분류 기록.", approval, condition, route(fixture))],
  ["서로 다른 문자", report(heading, approval, "별도로 받은 메시지 기록.", condition, route(fixture))],
  ["같은 내용 사이에 빈 줄이 있어 별도 기록으로 분리됨", heading + "\n" + approval + "\n\n" + report(condition, route(fixture))],
  ["다른 회사의 구체적인 번호", report(heading, approval, condition, "다른 업체의 " + route(fixture))],
  ["취소가 아닌 일반 문의처", report(heading, approval, condition, "대표 문의처로 " + fixture + "이 본문에 지정됨.")],
  ["취소 문의처 필드와 배송 번호가 별개", report(heading, approval, condition, route("번호 가림"),
    "배송 연락처로 " + fixture + "이 본문에 기재됨.")],
  ["번호 지정이 부정됨", report(heading, approval, condition, "취소할 연락처로 " + fixture + "이 본문에 지정된 사실은 없음.")],
  ["본인 거래일 때로 조건이 반대", report(heading, approval, "본인 거래인 경우", route(fixture))],
  ["부정된 승인", report(heading, "결제가 승인됐다는 뜻이 아님.", condition, route(fixture))],
  ["교재의 가상 예시", report("교육 자료.", heading, approval, condition, route(fixture))],
  ["현재 취소 요청의 철회", report(heading, approval, condition, route(fixture), "그 취소 요청은 이미 철회됐음.")],
  ["취소 완료", report(heading, approval, condition, route(fixture), "해당 취소 절차는 완료됐음.")],
  ["번호를 단순히 읽었다고 보고함", report(heading, approval, condition, "취소할 연락처로 " + fixture + "이라는 표기를 읽기만 했음.")],
];

async function expectR19(text, expected) {
  assert.equal(classifyCallback(text, []).foreignPayment, expected);
  assert.equal((await analyze({ text, ai: null })).fired_rules.includes("R19"), expected);
}

for (const [index, text] of positive.entries()) {
  test("수신 요약의 네 연결 근거 " + (index + 1), () => expectR19(text, true));
}
for (const [name, text] of negative) {
  test(name, () => expectR19(text, false));
}
