import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_FAMILY_IMPERSONATION, SIG_GIFTCARD } from "../src/signals.js";

describe("친족 발신 주장과 교환권 전달 목적어", () => {
  const active = [
    ["교환권의 기존 사용 코드를 알려 달라고 함", "받은 문자에서 발신자는 자신을 제 아들이라고 밝혔습니다. 요구 대상은 이미 가진 모바일 교환권의 사용 코드였고, 그 번호를 본인에게 알려 달라고 한 상황입니다."],
    ["사용값 전달을 현재 요구하고 수신자는 아직 미실행", "수신한 쪽지에서 발신자는 자신을 제 딸이라고 밝혔습니다. 충전권의 PIN을 그쪽으로 전달해 달라는 요구였지만 저는 따르지 않았습니다."],
    ["거래가 필요한 권종의 코드를 보내 달라는 보고", "받은 연락에서 발신자는 자신을 제 동생이라고 밝혔습니다. 이용권 전체가 아닌 금액권의 교환 코드만 자기에게 전송해 달라고 했다는 요약입니다."],
  ];
  for (const [name, text] of active) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R13"));
      assert.ok(result.signals_code.includes(SIG_GIFTCARD));
      assert.ok(result.signals_code.includes(SIG_FAMILY_IMPERSONATION));
    });
  }

  const ordinary = [
    ["권종 안내 및 사진을 찍은 사실", "받은 쪽지에서 발신자는 자신을 제 동생이라고 밝혔습니다. 모바일 교환권 사용 안내만 소개했고 이용 사진은 이미 기록해 두었다고 합니다."],
    ["금액권 번호의 전달 금지", "받은 연락에서 발신자는 자신을 제 아들이라고 밝혔습니다. 금액권 교환 코드를 전달하거나 알려 주면 안 된다는 안내였습니다."],
    ["소품 번호 보관", "받은 연락에서 발신자는 자신을 제 딸이라고 밝혔습니다. 전시 소품인 모형 충전권의 번호를 자료에 기록하라는 내용입니다."],
    ["사용 코드를 요구한 사람과 친족을 자처한 발신자가 다름", "받은 문자에서 발신자는 자신을 제 동생이라고 밝혔습니다. 그와 별개로 행사 운영자는 금액권 교환 코드를 별도로 전송해 달라고 했습니다."],
    ["상품권 안내와 예약 확인 번호가 별개", "손자입니다. 안내문에 모바일 교환권 항목이 있었어요. 예약 번호만 공식 접수 창구에 알려 줘도 됩니다."],
    ["확인 번호를 과거에 전달한 기록", "아들입니다. 남은 교환권도 구경했어요. 예약 번호를 보내 준 적이 있다는 메모를 읽었습니다."],
    ["이전 거래에 대한 기록", "받은 문자에서 발신자는 자신을 제 아들이라고 밝혔습니다. 지난번 교환권 번호 문의는 이미 끝났고, 이번에는 내역만 보관합니다."],
  ];
  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(!result.fired_rules.includes("R13"));
      assert.notEqual(result.level, "위험");
    });
  }
});