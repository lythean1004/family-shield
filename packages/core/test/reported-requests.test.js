import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_DELETE_APP, SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

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

describe("가족·주위 사람에게 도움을 구하지 않는 것이 이용 조건", () => {
  checkSignal(SIG_ISOLATION, true, [
    "문의 답장에는 가족과의 연락을 끊어야 상담이 이어진다고 나와 있어요.",
    "참여 신청은 주변 누구와도 상의하지 않기로 동의해야 한대요.",
    "제게 온 서류는 이웃들과 대화를 끊는 것을 지급 조건으로 걸었어요.",
  ]);
  checkSignal(SIG_ISOLATION, false, [
    "가족과의 연락을 끊어야 한다는 예방 교육 사례였어요.",
    "상담 후 스팸 전화와는 연락을 끊어도 된다는 안내를 받았어요.",
    "주변 누구와도 상의하지 않겠다는 요구를 거절하고 상담을 마쳤어요.",
    "주변 사람들과 대화를 잠깐 멈추고 공연에 집중하는 시간이래요.",
    "문의 답장에는 가족과의 연락을 끊어야 할 필요가 없다고 적혀 있어요.",
  ]);
});

describe("처리를 계속하려면 정상 보호 프로그램을 지우라는 요구", () => {
  checkSignal(SIG_DELETE_APP, true, [
    "문의 접수를 하려면 쓰던 보안 앱을 삭제해야 한다는 답을 받았어요.",
    "점검 신청 화면은 제 백신 프로그램을 지우는 게 필수라고 해요.",
    "제 휴대폰의 보호 프로그램을 지워야만 처리해 준다는 조건이에요.",
  ]);
  checkSignal(SIG_DELETE_APP, false, [
    "점검 때 가짜 백신 프로그램을 지워야 한다는 보안 공지예요.",
    "점검하려면 보안 앱을 삭제해야 한다는 피해 사례를 교육에서 배웠어요.",
    "자료 정리하다 실수로 보안 앱을 삭제했고 다시 설치했어요.",
    "점검을 받으려고 서명을 삭제했어요. 보호 프로그램은 계속 켜 뒀어요.",
    "접수를 위해 백신 프로그램을 지울 필요는 없다는 답변이 왔어요.",
  ]);
});
