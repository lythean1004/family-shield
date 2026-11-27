import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

function checkSignal(signal, expected, samples) {
  for (const text of samples) it(text, () => {
    assert.equal(extractCodeSignals(text).signals.includes(signal), expected);
  });
}

describe("받을 돈의 조건으로 제시된 별도 비용", () => {
  checkSignal(SIG_PREPAYMENT, true, [
    "제가 받을 환급금 조건에 보증금을 먼저 내야 한다고 나와 있어요.",
    "정산 요청의 답변란에 별도 수수료부터 내는 게 지급 조건이라고 적혀요.",
    "포상금을 타려면 추가 비용을 앞서 내야 한대요.",
  ]);
  checkSignal(SIG_PREPAYMENT, false, [
    "환급을 받으려면 수수료를 먼저 내야 한다는 주장은 거짓이라는 교육 자료예요.",
    "환급 안내에 수수료를 먼저 내야 할 필요가 없다고 나와 있어요.",
    "결제한 예약금을 먼저 환불받았고 나머지 잔액도 받았어요.",
    "수업 등록 조건에 재료비를 먼저 내야 한다고 나와 있어요.",
    "정산금에서 수수료를 공제한 영수증을 받았어요.",
  ]);
});

describe("거래와 무관한 수취인에게 보내라는 현재 요구", () => {
  checkSignal(SIG_THIRD_PARTY_ACCOUNT, true, [
    "문의 답장에는 계약과 무관한 사람의 개인 계좌로 비용을 내라고 되어 있어요.",
    "제가 받은 요청은 제3자의 개인 통장에 보내라는 내용이에요.",
    "거래처와 관계없는 다른 사람의 계좌로 대금을 입금하라는 답이 왔어요.",
  ]);
  checkSignal(SIG_THIRD_PARTY_ACCOUNT, false, [
    "계약과 무관한 사람의 개인 계좌로 비용을 내라는 피해 사례를 수업에서 읽었어요.",
    "제3자의 개인 통장에 보내라는 요청을 거절하고 신고를 마쳤어요.",
    "제3자의 개인 통장에 보내지 말라는 공지예요.",
    "거래와 무관한 사람의 계좌로 보내라는 뜻이 아니라고 정정했어요.",
    "계약과 무관한 사람의 개인 계좌가 장부에 잘못 적혔어요.",
    "직거래로 산 책값을 판매자 본인의 통장에 냈어요.",
  ]);
});
