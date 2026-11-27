import assert from "node:assert/strict";
import { test } from "node:test";
import { isCardCallbackNumber } from "../src/card-sender.js";
import { addInstitutionRequestContext } from "../src/institution-request-context.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { analyze } from "../src/pipeline.js";
import { SIG_FOREIGN_PAYMENT_CALLBACK } from "../src/signals.js";

const approvalRecord = "국외발신: 거래 승인 기록. ";
const cancellationField = "본인이 하지 않은 거래의 취소 연락처: ";
const referenceAddress = "https://receipt.invalid/entry";
const checkedContacts = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
  .flatMap(card => card.callback_contact?.numbers ?? []);
const paymentContacts = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked" &&
  card.callback_contact?.topics?.some(topic => topic.includes("결제취소")))
  .flatMap(card => card.callback_contact.numbers)
  .filter(number => /^1\d{3}-\d{4}$/.test(number));

function receiptContextSignal(value) {
  const signals = new Set();
  addInstitutionRequestContext(approvalRecord + cancellationField + value, signals);
  return signals.has(SIG_FOREIGN_PAYMENT_CALLBACK);
}

test("공개 결제 대표번호의 국내 표기가 달라도 취소 연락처에서 제외", async () => {
  assert.ok(paymentContacts.length > 0);
  for (const contact of paymentContacts) {
    for (const separator of ["-", ".", " "]) {
      const field = contact.replace("-", separator);
      assert.equal(receiptContextSignal(field), false);
      const result = await analyze({ text: approvalRecord + cancellationField + field, ai: null });
      assert.equal(result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK), false);
      assert.equal(result.fired_rules.includes("R19"), false);
      assert.notEqual(result.level, "위험");
    }
  }
});

test("완결된 미등록 장부 번호는 국내 표기·국가번호 표기에서 동일", async () => {
  for (const field of ["02-000-0000", "02.000.0000", "(02) 000-0000", "+82 2 000 0000"]) {
    assert.equal(isCardCallbackNumber(field), false);
    assert.equal(receiptContextSignal(field), true);
    const result = await analyze({ text: approvalRecord + cancellationField + field, ai: null });
    assert.equal(result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK), true);
    assert.equal(result.fired_rules.includes("R19"), true);
    assert.equal(result.level, "위험");
  }
});

test("누락, 공개 단축번호, 긴 번호가 아닌 값과 주소는 취소번호가 아님", async () => {
  const checkedShortNumbers = checkedContacts.filter(number => /^1\d{2,3}$/.test(number));
  assert.ok(checkedShortNumbers.length > 0);
  for (const field of [
    "", "[번호]", ...checkedShortNumbers, "1" + "0".repeat(3), "02-000-0000-0",
    referenceAddress, referenceAddress + "/02-000-0000", "02-000-0000.receipt.invalid",
  ]) {
    assert.equal(receiptContextSignal(field), false);
    const result = await analyze({ text: approvalRecord + cancellationField + field, ai: null });
    assert.equal(result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK), false);
    assert.equal(result.fired_rules.includes("R19"), false);
  }
});

test("같은 기록의 조회 주소와 완결된 취소번호의 역할은 서로 바뀌지 않음", () => {
  const number = "02.000.0000";
  const leadingReference = new Set();
  addInstitutionRequestContext(approvalRecord + "조회 주소: " + referenceAddress + ", " +
    cancellationField + number, leadingReference);
  assert.ok(leadingReference.has(SIG_FOREIGN_PAYMENT_CALLBACK));
  assert.ok(receiptContextSignal(number + ", 조회 주소: " + referenceAddress));
});
