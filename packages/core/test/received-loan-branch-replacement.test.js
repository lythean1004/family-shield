import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_LOAN_CASH_PICKUP } from "../src/signals.js";

const lender = "대출을 받은 곳의 상환 담당자라고 밝히면서 ";
const pickup = "남은 상환금을 영업점에서 받지 않고, 직원이 방문해서 현찰로 수거하겠다는 답신을 보냈습니다.";

for (const [name, text] of [
  ["기존 대출처의 담당 주장을 같은 직원 방문 수거와 결합", lender + pickup],
  ["해당 지점 직원이 창구 납부를 대체해 대출금을 방문 수령",
    "제가 대출을 받은 기관의 상환 담당 직원이라고 소개하면서 잔여 상환금을 지점에서 납부하는 대신 해당 지점 직원이 집에 찾아와 현금으로 받아 간다고 알렸습니다."],
  ["자사 직원이 현금으로 거둬 간다는 현재 보고",
    "대출을 받은 업체의 담당자라고 알리면서 대출 상환금을 지점에서 받지 않고, 우리 회사 직원이 직접 찾아와 현금으로 거둬 간다고 적었습니다."],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(result.signals_code.includes(SIG_LOAN_CASH_PICKUP));
    assert.ok(result.fired_rules.includes("R18"));
    assert.equal(result.level, "위험");
  });
}

for (const [name, text] of [
  ["금융회사 이름과 직원 방문만 나오고 대표 주장이 없음",
    "대출 상환에 관한 수신 보고입니다. 상대는 금융회사 이름을 대고 직원이 찾아와 상환금을 현찰로 받아 간다고 설명했습니다."],
  ["같은 발신자의 지점 언급과 반대 방향 반환", lender +
    "남은 상환금을 영업점에서 받지 않고, 직원이 방문해서 제게 현금으로 돌려준다고 밝혔습니다."],
  ["지인의 사적 대여금 회수",
    "지인에게 개인적으로 빌린 돈입니다. 빌려준 상대라면서 근처 가게 지점 대신 자기가 찾아와 그 돈을 현금으로 받겠다고 했습니다."],
  ["사적 대여에는 지점과 직원 수거가 언급돼도 적용하지 않음",
    "이 거래는 지인에게 빌린 사적인 대여였습니다. " + lender + pickup],
  ["지점에서 납부하고 직원은 날짜만 확인", lender +
    "상환금은 해당 지점에서 납부하고 직원이 와서 약속 날짜만 확인한다고 알렸습니다."],
  ["다른 회사 직원이 방문하는 별도 행동", lender +
    "남은 상환금을 지점에서 받지 않고, 다른 회사 직원이 찾아와 현금으로 받아 간다고 적었습니다."],
  ["같은 회사의 지점과 방문 인력의 소속이 다름", lender +
    "남은 상환금을 지점에서 받지 않고, 별개의 수거업체 직원이 찾아와 현금으로 받아 간다고 적었습니다."],
  ["예방 교육 자료의 인용", "예방 교육 자료에 적힌 내용입니다. " + lender + pickup],
  ["같은 상환금이 이미 완납됐다고 명시", lender + pickup +
    " 그 상환금은 이미 다 갚은 금액이라고 밝혔습니다."],
  ["같은 수거 계획이 취소", lender + pickup +
    " 그 수거 계획은 철회됐습니다."],
  ["소속이 나온 직원은 방문하지만 다른 직원이 돈을 받음", lender +
    "남은 상환금을 지점에서 받지 않고, 해당 지점 직원이 방문한 뒤 다른 직원이 현금으로 받아 간다고 알렸습니다."],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(!result.signals_code.includes(SIG_LOAN_CASH_PICKUP));
    assert.ok(!result.fired_rules.includes("R18"));
  });
}
