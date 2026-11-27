
import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_PREPAYMENT } from "../src/signals.js";

const report = "중고품 구매 과정의 상담 기록입니다.";
const aheadOfViewing = "판매할 물품을 확인하기에 앞서 대금을 미리 납부하라는 요청이 있었다고 기록했습니다.";
const tests = [
  ["보고에서 아직 보지 못한 상품과 선납 지시가 연결됨", report + " " + aheadOfViewing, true],
  ["당사자가 요구를 받았지만 지급하지 않음", "거래 상담에서는 매물을 살펴보기 전에 먼저 보증금을 송금하라는 지시를 받았다고 전했습니다. 수신자는 납부하지 않았습니다.", true],
  ["발췌 기록에 거래 성립 전 실제 요구 접수", "수신 기록\n계약이 성사되기 전 선납 요구를 받았다고 남김.\n납부하지 않고 연락을 그만함.", true],
  ["목적을 묻는 말에 앞선 지불을 얘기한 것이 아님", report + " 매물을 확인하기 전에 수수료를 보내야 하는지 물었고 답변을 기다렸습니다.", false],
  ["과거 예방 안내는 새 요구가 아님", "거래 예방 교육 자료입니다. 매물을 확인하기 전에 비용을 납부하라는 요청이 있었다는 예시를 읽었습니다.", false],
  ["요구가 없었다는 부정", report + " 매물을 살펴보기 전에 돈을 미리 입금하라는 요구가 없었다고 기록했습니다.", false],
  ["동일 사건에서 발신자가 철회", report + " " + aheadOfViewing + " 해당 요구는 나중에 철회됐습니다.", false],
  ["요구한 쪽이 취소한 목적과 조건", report + " " + aheadOfViewing + " 발신자가 그 납부 요구를 취소했습니다.", false],
  ["뒷문장에서 교육 사례라는 사실을 밝힘", report + " " + aheadOfViewing + " 교육 자료의 예시였습니다.", false],
  ["발신자가 수신자에게 지급한다는 보고", report + " 물건을 보여주기 전에 판매자가 저에게 대금을 먼저 지불하겠다고 한 내용이었습니다.", false],
  ["수신자가 먼저 냈다고 한 자발 지급", report + " 저는 물건을 살펴보기 전에 스스로 먼저 돈을 내겠다고 제안했습니다.", false],
  ["정식 확정된 결제의 납부 안내", "이미 확정된 계약의 정식 납부 안내입니다. 예약을 완료해서 기본 대금을 공식 수납처에서 정산한다고 적혀 있습니다.", false],
  ["두 문단의 별개 연락을 연결하지 않음", "중고품 거래 상담 기록입니다.\n\n" + aheadOfViewing, false],
  ["예약 우선권과 검품 제한을 구분", "중고 상품을 확인하러 가기로 했습니다. 상대에게서 물품 예약금을 낼 수 있다는 제안을 받았습니다. 현장 확인에는 영향이 없다고 답했습니다.", false],
  ["문서에 선입금이라는 단어만 있음", "거래가 성립하기 전 상담에서 선입금이라는 단어를 확실히 들었는지만 물었습니다. 돈을 보내라고 한 요청은 없었습니다.", false],
];
for (const [name,text,expected] of tests) {
  test(name, async () => {
    const result=await analyze({text,ai:null,urlReputation:null,domainAge:null});
    assert.equal(result.signals_code.includes(SIG_PREPAYMENT),expected);
  });
}
