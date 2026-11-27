import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_LOAN_CASH_PICKUP } from "../src/signals.js";

// Existing reports are reused here. The variations describe administrative status only.
const conditional = "은행 직원이라고 한 상대가 대출금 잔액을 현찰로 준비하면 직접 방문해 받아 가겠다고 했다.";
const finite = "은행 대출 담당으로 자신을 소개한 사람이 융자 상환액을 현금으로 마련하면 같은 회사 직원이 방문해 회수한다고 알렸다는 상담 기록이다.";
const transaction = "은행 직원이라고 한 사람이 담당자가 방문해 대출 상환금을 현금으로 수거하는 방식이라고 알렸습니다.";
const directed = "금융기관 대출 담당이라고 밝힌 발신자가 대출금 상환액을 현찰로 방문해서 회수하겠다고 밝혔습니다.";
const received = "금융회사 직원이라고 적힌 안내를 받았다. 수신자 자택에 찾아와 상환금을 현금으로 수거할 예정이라는 내용이다.";

const cancel = "그 방문 계획은 취소됐다.";
const reopen = "그 방문 계획은 재개됐다.";
const sameClause = (report, note) => report.slice(0, -1) + ", " + note;
const run = text => analyze({ text, ai: null, urlReputation: null, domainAge: null });

for (const [label, report] of [
  ["준비 조건", conditional],
  ["현재형 간접 인용", finite],
  ["수신 거래", transaction],
  ["직접 발신자", directed],
  ["발신자와 계획이 이어진 수신 기록", received],
]) {
  test(`${label}: 같은 방문 계획의 확정 취소`, async () => {
    const original = await run(report);
    assert.ok(original.fired_rules.includes("R18"));
    for (const text of [sameClause(report, cancel), `${report} ${cancel}`]) {
      const result = await run(text);
      assert.ok(!result.fired_rules.includes("R18"), text);
      assert.ok(!result.signals_code.includes(SIG_LOAN_CASH_PICKUP), text);
    }
  });
}

for (const [label, text, active] of [
  ["수거 계획을 명시한 확정 철회", sameClause(conditional, "그 방문 수거 계획은 철회됐다."), false],
  ["확정 취소 뒤 같은 계획 재개", sameClause(conditional, cancel) + " " + reopen, true],
  ["같은 계획 재개 뒤 최종 철회", sameClause(conditional, cancel) + " " + reopen + " 같은 방문 계획은 철회됐다.", false],
  ["취소 뒤 재개 검토", sameClause(conditional, cancel) + " 같은 방문 계획은 재개를 검토 중이다.", false],
  ["취소를 부정", sameClause(conditional, "그 방문 계획은 취소하지 않았다."), true],
  ["취소를 검토", sameClause(conditional, "그 방문 계획은 취소를 검토 중이다."), true],
  ["취소 가능성", sameClause(conditional, "그 방문 계획은 취소될 수도 있다."), true],
  ["방문 미이행", sameClause(conditional, "방문은 아직 하지 않았다."), true],
  ["별도 방문 일정", sameClause(conditional, "별도 방문 일정은 취소됐다."), true],
  ["상담의 종료", sameClause(conditional, "그 상담은 종료됐다."), true],
  ["다른 사람의 상태", sameClause(conditional, "다른 사람이 그 방문 계획을 취소했다."), true],
  ["별개 방문 요청", sameClause(finite, "별개의 방문 요청은 취소됐다."), true],
  ["다른 발신자의 방문 계획", sameClause(finite, "다른 발신자의 방문 계획은 취소됐다."), true],
  ["담당자가 맡은 다른 업무의 완료", sameClause(finite, "담당자의 별도 업무는 완료됐다."), true],
  ["현재형 간접 인용 뒤 취소 검토", sameClause(finite, "그 방문 계획은 취소를 검토 중이다."), true],
  ["현재형 인용 뒤 취소한 계획이 재개됨", sameClause(finite, cancel) + " " + reopen, true],
  ["확정 취소 후 다른 발신자의 재개", sameClause(conditional, cancel) + " 다른 발신자의 방문 계획은 재개됐다.", false],
  ["다른 계획의 취소 뒤 앞선 계획을 가리킨다고 단정할 수 없는 지시어", sameClause(finite, "별개의 방문 요청은 취소됐다.") + " 그 방문 계획은 철회됐다.", true],
  ["다른 기록자의 취소", `신고인: ${conditional}\n기록자: ${cancel}`, true],
  ["다른 문단의 취소", `${conditional}\n\n${cancel}`, true],
  ["별도로 남은 활성 방문 수거", `${sameClause(conditional, cancel)}\n\n${transaction}`, true],
  ["같은 문단의 별도로 남은 활성 방문 수거", `${sameClause(conditional, cancel)} ${transaction}`, true],
]) {
  test(label, async () => {
    const result = await run(text);
    assert.equal(result.fired_rules.includes("R18"), active);
    assert.equal(result.signals_code.includes(SIG_LOAN_CASH_PICKUP), active);
  });
}

test("같은 계획이 취소돼도 별도 금융 위험 신호는 유지", async () => {
  const independent = "수사팀에서 보냈다는 문자를 받았다. 현금을 방문 직원이 제게서 직접 받아 간다는 것이 안내의 요구 사항이었다.";
  const result = await run(`${sameClause(conditional, cancel)}\n\n${independent}`);
  assert.ok(result.fired_rules.includes("R15"));
  assert.ok(!result.fired_rules.includes("R18"));
  assert.equal(result.level, "위험");
});
