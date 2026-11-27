import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

const reports = [
  ["거래 상대와 무관한 사람 명의가 실제 수취처",true,"장부에서 가격을 확인했다. 거래 상대 대신 그 거래에 관련 없는 다른 사람 명의 통장으로 물품값을 보내 달라는 요청을 받았다는 기록이다."],
  ["본래 계약 업체와 무관한 수취처를 적은 보고",true,"계약 업체 대신 해당 계약에 관여하지 않는 다른 사람의 이름인 계좌로 금액을 입금해 달라는 요구를 받았다고 적었다."],
  ["지급 목적물을 앞 절에서 제시",true,"물건값을 보낼 경우 판매자 대신 이 거래와 무관한 타인 명의 계좌로 보내 달라고 말했던 것으로 상담 기록에 남겼다."],
  ["환불은 지급 요청의 반대 방향",false,"계약 상대 대신 이전에 안내된 수납 대행처가 수신자에게 보증금을 돌려준다는 환불 내역을 읽었다."],
  ["지급 안내 후 같은 요청을 철회",false,"거래 상대 대신 그 거래에 관련 없는 다른 사람 명의 통장으로 물품값을 보내 달라는 요청이 적혀 있었다. 해당 요청을 이미 철회했다."],
  ["계좌 정보 보관과 대금 지급 목적이 분리됨",false,"계약 대금의 납입을 요청받았다. 이와 별개로 다른 사람 명의 계좌의 조회 기록도 읽었다."],
  ["정식 수납 대행처",false,"계약 업체 대신 정식으로 승인받은 수납 대행처의 계좌에 대금을 납부한다는 안내를 받았다."],
];

for (const [description, expected, text] of reports) {
  test(description, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_THIRD_PARTY_ACCOUNT), expected);
    assert.equal(result.level === "위험", expected);
  });
}
