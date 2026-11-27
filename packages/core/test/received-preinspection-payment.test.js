import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_PREPAYMENT } from "../src/signals.js";

const reports = [
  ["판매자가 물품 상태 확인 전에 선납을 요구",true,"판매자가 물품의 상태를 확인하기 전에 선납금을 이체하라는 요청을 적었다."],
  ["지불을 먼저 쓰고 물건 공개를 뒤에 서술",true,"매도인에게서 답장을 받았다. 보증금을 보내야 그제야 매물을 보여 준다고 설명했다."],
  ["거래 조건 검토를 가로막는 비용 조건",true,"거래 상대가 거래 조건을 검토하기에 앞서 비용을 납부해 달라는 요구를 남겼다."],
  ["물건을 이미 확인한 뒤의 예약금",false,"판매자와 대화했습니다. 이미 물건 상태를 확인한 뒤 원하는 경우에만 예약금을 내는 절차였다."],
  ["수신자 쪽에서 먼저 제안한 지급",false,"판매자와 채팅했다. 제가 먼저 예약금을 내겠다고 제안했고, 상대에게서 지급 요구는 받지 않았다."],
  ["같은 선결제 요구가 철회됨",false,"판매자가 실물을 보여 주기 전에 예약금을 입금하라는 요청을 남겼다. 해당 요청을 이미 철회했다."],
  ["별개 기록의 지급과 물품 확인",false,"판매자와 채팅했다. 물품을 확인하는 방법을 읽었다. 한편 다른 거래에서 보증금을 돌려받았다."],
];

for (const [name, expected, text] of reports) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_PREPAYMENT), expected);
    assert.equal(result.level === "위험", expected);
  });
}
