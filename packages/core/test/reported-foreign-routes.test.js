import assert from "node:assert/strict";
import test from "node:test";
import { classifyCallback } from "../src/callback-number.js";
import { analyze } from "../src/pipeline.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";

const dummy = "000-0000-0000";
const officialNumber = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" &&
  card.callback_contact?.numbers.some(number => number.replace(/\D/g, "").length >= 8))
  .callback_contact.numbers.find(number => number.replace(/\D/g, "").length >= 8);
const memo = (...rows) => rows.join("\n");
const origin = "발신 구분 | 국외";
const outcome = "결제 상태 | 카드 결제 승인 완료";
const condition = "취소 대상 | 본인이 하지 않은 거래";
const route = `취소 접수 번호 | ${dummy}`;

const risk = [
  ["a received table binds origin, approval, exception and number", memo("수신 기록 요약", origin, outcome, condition, route)],
  ["the same fields work in a different order and punctuation format", memo(
    `취소 연락처: ${dummy}`, "취소 조건: 수신자가 승인하지 않은 거래", "전송 출처: 국제 발신", "승인 결과: 승인됐음")],
  ["a semicolon memo preserves field roles without relying on word order", [
    "취소 조건: 카드 명의자가 결제한 거래가 아닌 경우", "발신 위치: 해외", "결제 결과: 결제 완료", `취소 문의처: ${dummy}`,
  ].join("; ")],
];
const normal = [
  ["delivery phone is not the cancellation route", memo(origin, outcome, condition, `배송 연락처 | ${dummy}`)],
  ["a verified institution number is still exempt", memo(origin, outcome, condition, `취소 접수 번호 | ${officialNumber}`)],
  ["a redacted number supplies no destination", memo(origin, outcome, condition, "취소 접수 번호 | 번호 가림")],
  ["a masked placeholder is not parsed as a destination", memo(origin, outcome, condition, "취소 접수 번호 | 000-****-0000")],
  ["a pending approval does not count as a completed payment", memo(origin, "결제 상태 | 결제 보류", condition, route)],
  ["a completed refund has no present cancellation step", memo(origin, "결제 상태 | 환불 완료", condition, route)],
  ["the two notes describe different documents", memo(origin, outcome, "", condition, route)],
  ["a second note expressly changes the source", memo(origin, outcome, "다른 문서의 안내", condition, route)],
  ["a heading identifies a comparison example", memo("피싱 예방 수업의 교육 예시", origin, outcome, condition, route)],
  ["the purchase belongs to the recipient", memo(origin, outcome, "취소 대상 | 본인이 결제한 거래", route)],
  ["a sample heading is not an actual transfer notice", memo("작성 예시", origin, outcome, condition, route)],
  ["a structured closing status cancels the previous instruction", memo(origin, outcome, condition, route, "취소 상태 | 철회됨")],
  ["contradictory statuses are not combined in one record", memo(origin, outcome, condition, route, "결제 상태 | 승인 보류")],
  ["the cancellation instruction has been withdrawn", memo(origin, outcome, condition, route, "해당 취소 요청은 철회됐습니다.")],
  ["merely mentioning a number in the condition is not a contact field", memo(origin, outcome, `${condition} ${dummy}`)],
  ["a generic customer center number is not specifically for cancellation", memo(origin, outcome, condition, `대표 문의처 | ${dummy}`)],
  ["an origin value cannot simultaneously be domestic and foreign", memo("발신 구분 | 해외 아님, 국내", outcome, condition, route)],
];

for (const [cases, expected] of [[risk, true], [normal, false]]) {
  for (const [name, text] of cases) {
    test(name, async () => {
      assert.equal(classifyCallback(text, []).foreignPayment, expected);
      assert.equal((await analyze({ text, ai: null })).fired_rules.includes("R19"), expected);
    });
  }
}
