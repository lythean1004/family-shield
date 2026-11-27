import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const receipt = "금융회사 대출 담당자를 자처한 사람이 보낸 연락을 받았다.";
const onsite = "담당 직원이 방문할 예정이며 수신인의 대출 상환금을 현금으로 현장에서 수거한다고 설명했다.";
const visits = "소속 직원이 방문할 계획이고 수신자 본인의 융자금 상환액을 현찰로 수령한다는 내용이라고 밝혔다.";
const direct = "담당자가 직접 방문하여 상환금을 현금으로 회수한다고 알렸다.";

const cases = [
  ["앞 문장의 발신과 방문자가 이어진 현장 수거 보고", receipt + " " + onsite, true],
  ["다음 절이 방문자와 수신자의 상환액을 밝힌 보고", receipt + " " + visits, true],
  ["같은 수신 기록에 남은 직접 방문 수거 보고", receipt + " " + direct, true],
  ["다른 회사 직원의 별건 방문", receipt + " " + onsite.replace("담당 직원이", "별도 업체의 직원이"), false],
  ["다른 화자가 맡은 새 수거", receipt + " " + onsite.replace("상환금을 현금으로 현장에서", "상환금을 현금으로 현장에서 다른 직원이"), false],
  ["창구에서 납부하는 거래", receipt + " " + onsite.replace("현장에서", "지점 창구에서"), false],
  ["수거 대상이 영수증으로 바뀐 보고", receipt + " " + onsite.replace("현장에서 수거한다고", "현장에서 영수증을 수거한다고"), false],
  ["앞선 문단과 나뉜 독립 기록", receipt + "\n\n" + onsite, false],
  ["직원 자신의 대출 상환금", receipt + " " + onsite.replace("수신인의", "직원 자신의"), false],
  ["첫 방문 뒤 별도 상환액을 수거한 기록", receipt + " " + onsite.replace("예정이며 수신인의", "예정이었다가 별건 수신인의"), false],
  ["확정 보고 뒤 상담 기록 정정", receipt + " " + onsite + " 수신자는 앞선 기록을 정정했다.", false],
  ["가정으로만 남긴 방문 보고", receipt + " " + onsite.replace("설명했다.", "가정한 기록이다."), false],
  ["뒤에 나온 수신자의 행정 방문을 직원의 계획과 구별",
    receipt + " " + onsite.replace("예정이며 수신인의", "예정이며 수신자가 민원 상담으로 방문할 예정이고 수신인의"), false],
  ["동행인의 다른 방문에 현장 수거 동사를 귀속하지 않음",
    receipt + " " + visits.replace("계획이고 수신자", "계획이고 동행인이 안내를 듣기 위해 방문할 예정이며 수신자"), false],
  ["다른 사람의 방문이 들어간 접수 기록",
    receipt + " " + onsite.replace("예정이며 수신인의", "예정이며 신청인이 서류 확인 차 방문할 계획이고 수신인의"), false],
  ["뒤쪽 행정 업무의 방문으로 앞쪽 직원의 방문을 대신하지 않음",
    receipt + " " + onsite.replace("예정이며 수신인의", "예정이며 민원 접수 부서가 절차 확인을 위해 방문할 예정이고 수신인의"), false],
  ["접수 기록의 출처가 귀속되지 않은 연락", receipt.replace("사람이 보낸 연락을 받았다.", "사람에게 연락이 왔다.") + " " + onsite, false],
];

for (const [name, text, expected] of cases) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.fired_rules.includes("R18"), expected);
  });
}
