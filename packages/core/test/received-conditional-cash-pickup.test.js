import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_LOAN_CASH_PICKUP } from "../src/signals.js";

const reports = [
  ["직원을 자칭한 발신자가 현금 준비 뒤 방문을 예고",true,"은행의 상환 담당 직원이라고 소개한 사람이 미상환 대출금을 현찰로 준비하면 자기가 집에 방문해서 수거하겠다고 알렸다는 접수 메모다."],
  ["준비 조건과 같은 발신자의 직접 수거",true,"금융기관 대출 직원이라고 한 상대가 융자금 잔액을 현금으로 마련해 놓을 경우 직접 찾아가서 받아 가겠다고 답한 기록이다."],
  ["자기 역할을 밝혀 방문 회수 계획을 보고",true,"은행 직원이라고 밝힌 발신자가 대출금 잔금을 현금으로 준비해 두면 자신이 자택으로 방문하여 회수하겠다는 내용을 말했음."],
  ["상환인이 영업점에 방문하는 반대 방향",false,"은행 직원이라고 한 상대가 대출금 잔액을 현금으로 준비하면 수신자가 영업점에 직접 방문해 납부하는 절차를 설명했다."],
  ["방문하는 목적이 증빙 확인",false,"금융회사 직원이라고 한 상대가 대출 잔액 정리의 경우 자택에 방문하여 영수증만 확인한다고 밝혔다."],
  ["같은 방문 수거가 취소됨",false,"은행 직원이라고 한 상대가 대출금 잔액을 현찰로 준비하면 직접 방문해 받아 가겠다고 했다. 그 수거 계획은 취소됐다."],
  ["현금은 반환 대상이고 돈을 맡기지 않음",false,"은행 직원이라고 밝힌 상대가 대출 상환금을 확인한 뒤 수신자에게 현금을 돌려준다고 설명했다."],
  ["수거 대상과 접수 목적이 서로 다름",false,"은행 직원이라고 한 상대가 대출금을 현금으로 준비한다고 물었다. 별도로 방문해 종이 문서만 받겠다고 답했다."],
];

for (const [name, expected, text] of reports) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_LOAN_CASH_PICKUP), expected);
    assert.equal(result.level === "위험", expected);
  });
}
