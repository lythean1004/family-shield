import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const direct = "금융기관 대출 담당을 자처한 사람이 수신자의 대출 상환액을 현금으로 직접 방문해 회수한다고 밝혔다.";
const conditional = "금융회사 상환 업무 직원이라고 소개한 상대가 대출금 잔액을 현찰로 준비해 두면 본인이 직접 방문하여 수령한다는 내용을 설명했다.";

const cases = [
  ["직접 방문 수거의 간접 인용", direct, true],
  ["현금 준비 조건이 붙은 방문 수거의 간접 인용", conditional, true],
  ["직접 방문 뒤 수거하는 대상이 증빙 자료", direct.replace("직접 방문해 회수한다고", "직접 방문해 증빙 자료만 회수한다고"), false],
  ["조건부 현금 수거가 철회된 기록", conditional + " 그 방문 계획은 철회됐다.", false],
  ["창구로 방문하는 주체가 수신자인 조건부 상담", conditional.replace("본인이 직접 방문하여 수령한다는", "수신자가 창구로 방문하여 납부한다는"), false],
  ["앞선 현금 방문이 취소되고 별건 서류를 수신자가 받는 보고",
    "금융기관 대출 담당을 자처한 사람이 수신자의 대출 상환액을 현금으로 직접 방문해 회수하겠다고 했다가 방문이 취소되었고, 수신자가 보관 서류를 수령한다고 밝혔다.", false],
  ["앞선 현금 절차와 직원의 영수증 수취가 다른 보고",
    "금융회사 상환 업무 직원이라고 소개한 상대가 대출금 잔액을 현찰로 준비해 두면 본인이 직접 방문하여 수령하는 절차를 설명했고, 직원은 영수증을 수령한다고 밝혔다.", false],
];

for (const [name, text, expected] of cases) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.fired_rules.includes("R18"), expected);
  });
}
