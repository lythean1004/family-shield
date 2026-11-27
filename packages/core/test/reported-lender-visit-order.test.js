import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_LOAN_CASH_PICKUP } from "../src/signals.js";

const lender = "금융회사 상환 직원으로 본인을 소개한 연락 상대가 ";
const pickup = "제 대출 상환액을 현찰로 거둬 가겠다며 댁 방문을 알렸다는 보고를 남겼습니다.";

for (const [label, text] of [
  ["회수 의사 뒤에 같은 발신자의 방문 예고", lender + pickup],
  ["방문 계획을 취소했는지 수신자가 아직 모른다는 경우", lender + pickup + " 발신자가 그 방문 계획을 취소했는지는 아직 모릅니다."],
  ["직원이 현금 인수 의사와 자택 방문을 같은 발화에 밝힘",
    "은행 상환 담당으로 자신을 밝힌 발신자가 융자 상환금을 현금으로 받겠다며 직접 자택에 방문할 계획이라고 설명했습니다."],
  ["방문을 먼저 말하고 기존 상환액의 현금 수령을 밝힘",
    "금융기관 직원으로 자신을 소개한 사람이 제 집으로 찾아와 기존 대출 상환금을 현찰로 수령하겠다고 알려 왔습니다."],
]) {
  test(label, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(result.signals_code.includes(SIG_LOAN_CASH_PICKUP));
    assert.ok(result.fired_rules.includes("R18"));
    assert.equal(result.level, "위험");
  });
}

for (const [label, text] of [
  ["금융기관 언급만 있고 자신이 직원이라고 말하지 않음",
    "연락 상대가 한 금융회사 이름을 언급하면서 " + pickup],
  ["발신자가 아니라 동행인을 직원으로 소개",
    "상대는 다른 사람을 금융회사 직원으로 소개했고 " + pickup],
  ["대출 상환인이 지점에 가는 반대 방향",
    lender + "상환금은 제가 지점에 방문해 현금으로 낼 수 있다고 안내했습니다."],
  ["수거 의사 뒤에 다른 직원의 별도 방문",
    lender + "대출 상환금을 현찰로 받겠다며 다른 직원의 자택 방문을 별도로 알렸습니다."],
  ["자택 방문을 예고하지만 현금 수령 대신 반환",
    lender + "제 대출 상환액을 현찰로 돌려주겠다며 댁 방문을 알렸습니다."],
  ["대출 상환금이 아닌 서류 방문 수거",
    lender + "대출 상환액을 이미 확인했고 서류만 받아 가겠다며 댁 방문을 알렸습니다."],
  ["사적인 채권과 금융기관을 구별",
    "사적으로 돈을 빌려준 지인이 제가 갚을 돈을 현찰로 받아 가겠다며 댁 방문을 알렸습니다."],
  ["택배 직원의 일반 대금 수납",
    "배송 기사는 물건값을 현금으로 받겠다며 방문할 시간을 알려 주었습니다."],
  ["예방 교육에서 예시로 옮긴 상황",
    "예방 교육 자료에 나온 예시입니다. " + lender + pickup],
  ["방문을 예고한 사실을 부인", lender + "대출 상환금을 현찰로 받겠다며 댁 방문을 예고한 적은 없다고 정정했습니다."],
  ["방문 계획에 관해 말했다는 사실을 부인", lender + "대출 상환금을 현찰로 받겠다며 댁에 방문할 계획이라고 말한 적은 없다고 답했습니다."],
  ["발신자가 같은 방문 계획을 직접 철회", lender + pickup + " 발신자가 그 방문 계획을 철회했습니다."],
  ["같은 발신자가 수거 계획을 취소함",
    lender + pickup + " 그 방문 계획은 취소됐습니다."],
  ["같은 방문 일정의 취소 처리 완료",
    lender + pickup + " 그 방문 일정은 취소 처리되었습니다."],
]) {
  test(label, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(!result.signals_code.includes(SIG_LOAN_CASH_PICKUP));
    assert.ok(!result.fired_rules.includes("R18"));
  });
}

test("별도 진료 기록은 예고된 현금 수거 판정과 함께 있어도 AI로 보내지 않는다", async () => {
  let requests = 0;
  const result = await analyze({
    text: lender + pickup + "\n\n병원에서 내과 진료 예약을 확인했습니다.",
    ai: { model: "fixture", apiKey: "fixture", fetchImpl: async () => { requests++; throw Error("local fixture"); } },
  });
  assert.ok(result.fired_rules.includes("R18"));
  assert.equal(result.ai_skipped, "health");
  assert.equal(requests, 0);
});
