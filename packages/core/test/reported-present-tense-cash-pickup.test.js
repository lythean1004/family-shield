import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const affirmed = "은행 대출 담당으로 자신을 소개한 사람이 융자 상환액을 현금으로 마련하면 같은 회사 직원이 방문해 회수한다고 알렸다는 상담 기록이다.";

const records = [
  ["수거한다고 알린 적이 없다는 정정", false, "은행 대출 담당을 자처한 사람이 상환금을 현금으로 마련하면 직원이 방문해 수거한다고 알린 적은 없다는 정정 기록이다."],
  ["미실행 별도 기록", true, "은행 대출 담당 직원이라고 밝힌 사람이 대출 상환액을 현찰로 마련하면 소속 직원이 찾아와서 수령한다고 알렸다는 상담 메모다. 실제 방문은 없었다."],
  ["수거가 일어나지 않은 신고", true, "은행 상환 담당자를 자처한 상대가 융자금 상환금을 현금으로 마련하면 직원이 방문하여 회수한다는 취지로 말했다고 기록됐다. 수거는 이루어지지 않았다."],
  ["발신자가 자기 소속과 자신의 방문 수령을 밝힘", true, "금융회사 대출 담당이라고 밝힌 사람이 상환금을 현금으로 직접 찾아와 수거한다고 알린 것으로 접수됐다."],
  ["같은 방문 수거가 철회됨", false, "은행 대출 담당 직원이라고 밝힌 사람이 융자금 상환금을 현금으로 준비하면 소속 직원이 찾아와서 회수한다고 알렸다는 메모다. 그 방문 계획은 철회됐다."],
  ["방문 수령 대상은 서류", false, "은행 대출 담당자를 자처한 상대가 상환금을 현금으로 받는다고 했으나, 직원이 방문해 수거한다고 밝힌 것은 서류뿐이었다."],
  ["납부하러 방문하는 사람은 수신자", false, "은행 대출 담당자를 자처한 사람이 수신자가 창구에 방문해 현금으로 입금하면 그곳 직원이 대출 상환금을 수령한다고 안내한 기록이다."],
  ["별도 주체가 방문하여 수령", false, "은행 직원이라고 소개한 사람이 상환금을 현금으로 준비하는 상황을 설명했다. 다른 업체 직원이 방문해 수령한다고 말한 부분은 별도 상담이었다."],
  ["금융권 소속이 아닌 개인 채권자", false, "개인 채권자가 상환금을 현금으로 마련한 뒤 방문해 회수한다고 설명했다는 기록이다."],
  ["직원은 현금 반환 주체", false, "은행 대출 담당자를 자처한 사람이 직원이 방문하여 대출 상환금 중 과납금을 현금으로 반환한다고 밝혔다는 접수 기록이다."],
  ["방문 직원은 다른 회사 소속", false, "은행 대출 담당이라고 밝힌 사람이 상환금을 현금으로 마련하면 다른 회사의 직원이 찾아와서 수거한다고 설명한 상담 기록이다."],
];

for (const [name, expected, text] of records) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.fired_rules.includes("R18"), expected);
  });
}

for (const [name, text] of [
  ["인용절에 붙은 발언 부정", affirmed.replace("알렸다는 상담 기록이다.", "알렸다는 사실을 부인했다.")],
  ["인용절에 붙은 가정", affirmed.replace("알렸다는 상담 기록이다.", "알렸다고 가정한 문서다.")],
  ["후행 확인에서 연락 사실 부정", affirmed + " 추가 확인 결과 그러한 연락을 받은 사실이 없었다."],
  ["미실행 뒤 수신자가 기록을 정정", affirmed + " 실제 방문은 없었다. 수신자는 해당 보고를 정정했다."],
  ["같은 방문 계획 폐기", affirmed + " 발신자가 그 방문 계획을 폐기했다."],
  ["같은 방문 계획 재개 뒤 실제 계획을 다시 부정", affirmed + " 그 방문 계획은 취소됐다. 그 방문 계획은 재개됐다. 그 방문 계획은 없었다."],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.ok(!result.fired_rules.includes("R18"));
  });
}

for (const [name, text] of [
  ["후속 독립 신고의 취소는 앞선 인용에 귀속되지 않음", affirmed + " 다른 발신자가 정책 문의를 받았다. 그 방문 계획은 취소됐다."],
  ["같은 방문 계획의 재개 확정", affirmed + " 그 방문 계획은 취소됐다. 그 방문 계획은 재개됐다."],
  ["기존 비정규 활용형 유지", affirmed.replace("회수한다고", "회수하ㄴ다고")],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.ok(result.fired_rules.includes("R18"));
  });
}

for (const [name, repayment, expected] of [
  ["발신자가 자기 채무로 특정한 경우", "자신의 개인 융자 상환액을", false],
  ["수신과 무관한 다른 이용자 채무", "거래와 관계없는 이용자의 융자 상환액을", false],
  ["채무 근거가 별도 업무 기록인 경우", "별도 업무 기록에 있던 융자 상환액을", false],
  ["생략된 귀속을 같은 수신 보고 안에서 읽음", "융자 상환액을", true],
  ["수신자 본인의 채무로 특정한 경우", "수신자 본인의 융자 상환액을", true],
]) {
  test(name, async () => {
    const text = affirmed.replace("융자 상환액을", repayment);
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.fired_rules.includes("R18"), expected);
  });
}
