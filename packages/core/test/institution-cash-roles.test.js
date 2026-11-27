import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_CASH_HANDOVER, SIG_LOAN_CASH_PICKUP } from "../src/signals.js";

describe("수신 보고의 대면 현금 전달과 대출금 방문 수거", () => {
  const requests = [
    ["현금을 가지고 발신 측을 먼저 만나야 한다는 요구", "R15", SIG_CASH_HANDOVER,
      "본인을 수사기관의 확인 담당자라고 한 상대가 수신자에게 현찰을 지참한 뒤 대면해서 넘겨야 사건 확인을 진행한다고 전했습니다."],
    ["대면 조건 설명 뒤 현금 인계 대상을 명시", "R15", SIG_CASH_HANDOVER,
      "저에게 온 연락에서 조사 담당 경찰이라고 밝힌 발신자는 절차를 진행하려면 직접 만나는 자리에서 수신자의 현금을 담당자에게 전달해야 한다고 적었습니다."],
    ["먼저 대출 담당을 밝혔고 이어서 방문 수취를 설명", "R18", SIG_LOAN_CASH_PICKUP,
      "대출 업무를 맡았다는 금융사 직원이라는 상대에게 연락이 왔습니다. 제가 갚아야 할 금액을 현금으로 준비하면 담당자가 방문해 수거하겠다고 알렸습니다."],
    ["같은 보고에 상환금과 금융사 직원의 방문 수취를 적음", "R18", SIG_LOAN_CASH_PICKUP,
      "금융사 직원이라고 밝힌 사람이 제게 보낸 안내에는 담당자가 찾아와 대출 상환금을 현찰로 수령하겠다는 내용이 담겼습니다."],
  ];
  for (const [name, rule, signal, text] of requests) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(signal));
      assert.ok(result.fired_rules.includes(rule));
      assert.equal(result.level, "위험");
    });
  }

  const controls = [
    ["수신자가 돈을 받는 방향", "수사기관 직원이라고 한 사람이 연락을 했습니다. 보관을 맡은 현금을 직접 만나 저에게 건네겠다고 말했습니다."],
    ["대면 면담과 별개의 송금 계약", "수사기관 담당자라는 사람이 대면 면담 시간을 확인해 달라며 연락했습니다. 그와 별개로 환급받은 현금은 가족에게 전달할 예정입니다."],
    ["기관 사칭 없이 배송 문의", "배송 상자를 가지고 방문한 가게 직원이 현금으로 계산할지 문의했다는 기록을 남겼습니다."],
    ["이미 있었던 상황의 참고 자료", "교육 자료에는 수사기관을 자칭한 사람이 현금을 직접 만나 건네야 한다고 말했다는 예시가 실렸습니다."],
    ["대출 상환금은 창구에서 납부", "대출을 담당하는 금융사 직원이라고 한 사람에게 연락이 왔습니다. 상환금은 영업점에서 내면 되고 직원은 집에서 서류만 수거하겠다고 했습니다."],
    ["별개 발신자가 언급한 수거", "대출 담당 금융사 직원이라는 사람에게 연락이 왔습니다. 그와 별개로 다른 기관 직원이 방문해 현금으로 받을 수 있다고 설명했습니다."],
    ["대출 관계가 나오지 않음", "금융사 직원이라고 밝힌 사람이 현금을 준비하면 담당자가 찾아와 받아 간다고 설명했지만 돈의 목적은 표시되지 않았습니다."],
    ["금융회사 역할 없이 상환금 언급", "대출 상환금에 대한 개인 일정 기록입니다. 대리인이 현금을 가지러 올 수 있다는 대목만 적혀 있었습니다."],
    ["보낸 사람이 수거 요구를 취소", "금융사 직원이라고 한 사람이 대출 상환금을 현금으로 준비하면 담당자가 방문해 수거하겠다고 연락했습니다. 해당 요구가 취소됐습니다."],
    ["신청자가 도움말로 문의", "대출 담당 금융사 직원에게 문의한 기록입니다. 제가 현금으로 낼 수 있는지 먼저 물었고 담당자는 방문 여부를 모른다고 답했습니다."],
  ];
  for (const [name, text] of controls) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(!result.fired_rules.includes("R15"));
      assert.ok(!result.fired_rules.includes("R18"));
    });
  }
});
