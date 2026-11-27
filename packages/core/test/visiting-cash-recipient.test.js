import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_CASH_HANDOVER } from "../src/signals.js";

describe("방문 수령인에게 현금을 건네라는 수사기관 발신 주장", () => {
  const demands = [
    "수사기관 소속이라고 한 사람이 준비해 둔 현찰을 방문하는 담당자에게 건네야 한다고 알렸다는 수신 기록입니다.",
    "검찰이라고 밝힌 상대가 수신자의 현금을 찾아올 직원한테 직접 전달하도록 했다고 기록됐습니다.",
    "경찰 수사팀이라고 한 발신인이 보관 중인 현금을 방문할 대리인에게 인계해 달라는 뜻을 전했다는 상담 기록입니다.",
  ];
  for (const text of demands) {
    it(text, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(SIG_CASH_HANDOVER));
      assert.ok(result.fired_rules.includes("R15"));
      assert.equal(result.level, "위험");
    });
  }

  const controls = [
    "경찰이라고 한 발신인이 현금을 찾아오는 담당자가 수신자에게 직접 건네겠다고 설명했다는 기록입니다.",
    "검찰이라고 밝힌 사람이 현금을 보관하고 방문할 직원에게 영수증을 전달하도록 했다는 메모입니다.",
    "도서관에서 책을 가져다줄 담당자가 방문할 예정이라는 알림이 왔습니다. 수신자는 현금 결제가 되는지 물었습니다.",
    "경찰이라고 한 사람이 현금을 방문하는 직원에게 직접 전달하라는 뜻은 아니었다고 설명했다는 기록입니다.",
    "수사기관이라고 한 상대가 현금 인계 여부를 물었고 방문할 직원은 확인만 한다고 설명했다는 기록입니다.",
    "예방 자료에는 검찰이라고 한 사람이 현금을 방문할 직원에게 직접 건네야 한다고 말한 예시가 실렸습니다.",
  ];
  for (const text of controls) {
    it(text, async () => {
      const result = await analyze({ text });
      assert.ok(!result.signals_code.includes(SIG_CASH_HANDOVER));
      assert.ok(!result.fired_rules.includes("R15"));
    });
  }
});
