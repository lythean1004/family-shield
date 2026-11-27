
import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";

const unlisted = "010-0000-0181";
const official = "1577-1000";
const receipt = "국외 발신 표시가 붙은 알림에 카드 결제가 완료됐다고 적혀 있었습니다.";
const route = number => "제가 한 결제가 아니면 알림에 적힌 " + number + "로 전화해서 결제 취소하라는 안내였습니다.";
const cases = [
  ["같은 결제의 취소를 위해 전화하라는 요청", receipt + " " + route(unlisted), true],
  ["연락 다음에 취소하는 경우", "국제 발신 표시가 있는 통지에 거래가 승인됐다고 쓰여 있었습니다. 본인이 한 거래가 아니라면 본문에 지정된 " + unlisted + "로 연락한 뒤 거래를 취소하라는 내용이었습니다.", true],
  ["공식 번호", receipt + " " + route(official), false],
  ["발신 국가가 아닌 해외 결제 유형", "국내에서 받은 알림에 해외 카드 결제가 완료됐다고 적혀 있었습니다. " + route(unlisted), false],
  ["본문의 발신 표기가 빠졌음", "받은 문자에 결제가 완료됐다고 적혀 있었습니다. " + route(unlisted), false],
  ["승인 대기", "국외 발신 표시가 붙은 알림에 결제가 대기 중이라고 적혀 있었습니다. " + route(unlisted), false],
  ["본인 거래 확정", receipt + " 제가 한 결제는 알림에 적힌 " + unlisted + "로 전화해서 취소하라는 안내였습니다.", false],
  ["실제 전화 번호 빠짐", receipt + " 제 거래가 아니라면 이 알림이 지정한 연락처로 전화해서 결제를 취소하라고 적혀 있었습니다.", false],
  ["연락은 영업 시간 조회일 뿐", receipt + " 제가 한 결제가 아니라면 알림에 적힌 " + unlisted + "로 전화해서 영업 시간만 확인하라는 안내였습니다.", false],
  ["취소 여부를 묻는 질문", receipt + " 제가 한 결제가 아니면 알림에 적힌 " + unlisted + "로 전화해서 취소해야 하는지 내가 물었습니다.", false],
  ["이미 발신자가 취소 안내를 철회", receipt + " " + route(unlisted) + " 발신자가 그 취소 요청을 철회했습니다.", false],
  ["별건 연락처로 넘어감", receipt + " 그와는 별개로 받은 다른 메시지였습니다. " + route(unlisted), false],
  ["별도 문자에 결제만 나옴", "국외 발신 표시가 붙은 알림에 행사 안내가 적혀 있었습니다. 같은 날 결제가 완료됐다고 적혀 있었습니다. " + route(unlisted), false],
  ["다른 전화로 취소하는 두 연락처 분리", receipt + " 제가 한 결제가 아니면 알림에 적힌 " + unlisted + "로 영업 시간을 문의한 뒤 등록된 창구로 전화해서 취소하라는 안내였습니다.", false],
];
for (const [name,text,expected] of cases) {
  test(name, async () => {
    const result = await analyze({text,ai:null,urlReputation:null,domainAge:null});
    assert.equal(result.fired_rules.includes("R19"), expected);
  });
}
