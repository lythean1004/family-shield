import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_PREPAYMENT } from "../src/signals.js";

const scenarios = [
  ["수신자 제안 뒤 판매자가 확인 전 수납을 부인", false,
   "판매자와 채팅했고, 제가 먼저 예약금 납부를 제안했다. 상대는 아직 물건 확인 전에 받을 돈은 없다고 답했다."],
  ["매물 검토 전 청구의 부재를 명시", false,
   "상담 내역으로 남겼다. 수신자가 먼저 보증금 납부를 제안했다. 판매자는 아직 매물 검토 전에 청구할 비용은 없다고 설명했다."],
  ["현금 요구 부재를 일반적인 문장으로 보고", false,
   "판매자와 채팅했다. 제가 먼저 예약금을 내겠다고 제안했고, 상대에게서 지급 요구는 받지 않았다."],
  ["나중에 받은 별개 연락의 필수 선입금은 유지", true,
   "판매자와 채팅했고, 제가 먼저 예약금 납부를 제안했다. 상대는 아직 물건 확인 전에 받을 돈은 없다고 답했다. 다른 거래의 답장을 받았다. 발신 쪽은 추가 거래 확인 수수료를 먼저 내야 절차를 이어갈 수 있다는 조건을 적었다."],
  ["실제 발신자가 확인을 막고 비용을 부과", true,
   "별개로 도착한 계약 안내의 기록이다. 아직 확인되지 않은 계약의 검증 비용을 먼저 납부해야 거래를 계속할 수 있다는 조건을 안내했다."]
];
for(const [title, expected, text] of scenarios) {
  test(title, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_PREPAYMENT), expected);
  });
}
