import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_FAMILY_IMPERSONATION, SIG_MONEY, SIG_NEW_NUMBER } from "../src/signals.js";

const mismatch = {
  parentInputs: { sender_last4: "1357" },
  registeredLast4: "2468",
};

describe("등록한 가족 연락처와 다른 발신의 금액 요청", () => {
  const active = [
    ["금액을 직접 목적어로 둔 부탁", "받은 쪽지에서 발신자는 자신을 제 아들이라고 밝혔습니다. 필요한 재료비 2만 원만 부탁했다는 내용입니다."],
    ["별도 통화 요구 없이 비용의 대납을 부탁함", "받은 문자에서 발신자는 자신을 제 딸이라고 밝혔습니다. 시설 사용료 3만 원만 대신 내 달라고 부탁한 내용입니다."],
    ["과거 문서 뒤에 별도로 전한 현재 금액 부탁", "아들이에요. 이전 결산표의 문구는 보관했다고 합니다. 이번 연락의 새 부탁은 현재 시설비 3만 원만 대신 내 달라는 내용입니다."],
    ["현재 부탁을 받은 상태이고 수신자는 아직 실행하지 않음", "받은 연락에서 발신자는 자신을 제 동생이라고 밝혔습니다. 비용은 4만 원만 부탁했다고 적혀 있었지만 저는 따르지 않았습니다."],
  ];

  for (const [name, text] of active) {
    it(name, async () => {
      const result = await analyze({ text, ...mismatch });
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R3"));
      for (const signal of [SIG_NEW_NUMBER, SIG_MONEY, SIG_FAMILY_IMPERSONATION]) {
        assert.ok(result.signals_code.includes(signal));
      }
    });
  }

  const ordinary = [
    ["보관용 결산표에 실린 과거 부과 항목", "언니예요. 소풍 결산표에는 점심값 2만 원만 부탁했다는 줄이 있어. 그 표는 집에 보관만 해."],
    ["회의에서 거절되어 효력이 없는 의견", "아들이에요. 모임에서 3만 원을 보내 달라는 의견은 이미 거절됐어요. 오늘 회의에는 회비가 없어요."],
    ["전시 장부의 과거 문형을 설명", "조카예요. 전시한 옛날 장부에서 결제 요청 문형을 옮겼어요. 신청비 4만 원을 입금해 달라는 표시였어요."],
    ["기록에 있는 금액의 오기 확인", "받은 문자에서 발신자는 자신을 제 딸이라고 밝혔습니다. 사용료 3만 원은 견적에 있는 금액이고, 부탁은 금액 오기를 확인하는 일이었습니다."],
    ["받은 연락에 포함된 거래 완료 내용", "받은 연락에서 발신자는 자신을 제 동생이라고 밝혔습니다. 이미 정산한 비용 4만 원과 내역을 기록해 달라는 내용입니다."],
    ["친족 관계를 묻는 말은 자기소개가 아님", "아들이에요? 모임 회비로 3만 원만 부탁했다는 내용만 전달합니다."],
    ["두 번째 발신자의 부탁", "받은 쪽지에서 발신자는 자신을 제 아들이라고 밝혔습니다. 그와 별개로 친구가 보낸 다른 문자에 필요한 재료비 2만 원만 부탁했다는 내용이 있습니다."],
    ["발신자가 이미 금액 요청을 철회", "받은 문자에서 발신자는 자신을 제 딸이라고 밝혔습니다. 재료비 3만 원만 부탁했다는 기존 요청은 철회됐다고 합니다."],
    ["네 번째 절을 넘긴 다른 발신의 요청", "아들입니다. 오늘 일정 잘 끝났어요. 나중에 인사드릴게요. 따뜻하게 입으세요. 따로 친구가 남긴 기록에는 재료비 2만 원을 대신 내 달라는 부탁이 있었습니다."],
    ["교육 자료에서 등장한 금액 요청", "피싱 예방 자료에서는 자신을 제 아들이라고 밝힌 가상 발신자가 재료비 2만 원만 부탁했던 예를 소개했습니다."],
  ];

  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({ text, ...mismatch });
      assert.ok(!result.fired_rules.includes("R3"));
      assert.notEqual(result.level, "위험");
    });
  }

  it("수신자가 입력한 끝자리가 비교할 번호와 같으면 R3를 발동하지 않음", async () => {
    const { fired_rules } = await analyze({
      text: active[0][1],
      parentInputs: {sender_last4: mismatch.registeredLast4},
      registeredLast4: mismatch.registeredLast4,
    });
    assert.ok(!fired_rules.includes("R3"));
  });
});