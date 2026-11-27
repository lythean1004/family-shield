import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_PREPAYMENT } from "../src/signals.js";

describe("작업을 시작하기 전에 작업자에게 납부를 요구한 방향", () => {
  const active = [
    ["일감을 받을 작업자가 비용을 먼저 내야 함", "제게 일감을 맡긴 업체의 답장을 받았습니다. 업무가 배정되기 전에 작업자인 제가 별도 비용을 먼저 내야 한다고 적혀 있었습니다."],
    ["작업 시작을 비용 납부에 묶었으나 미납 상태", "작업을 의뢰한 쪽에서 온 문자에 작업 시작 전에 비용부터 제가 부담해 납부해야 한다고 했어요. 실제로 내지는 않았습니다."],
    ["발주자가 수행자의 선납을 작업 조건으로 정함", "발주처가 보낸 답신입니다. 수행자는 작업을 시작하기 전에 별도 착수비를 먼저 납부해야 한다는 조건입니다."],
  ];
  for (const [name, text] of active) {
    it(name, async () => {
      const result = await analyze({text});
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R9"));
      assert.ok(result.signals_code.includes(SIG_PREPAYMENT));
    });
  }

  const ordinary = [
    ["발주자가 작업자에게 선금을 주는 정상 계약", "제게 작업을 맡긴 업체의 답장을 받았습니다. 업무가 시작되기 전에 업체가 작업자인 제게 선금을 지급해야 한다고 계약서에 적혀 있었습니다."],
    ["가게가 재료비를 지급", "가게가 보낸 문자를 받았습니다. 작업 시작 전에 가게에서 재료비를 제게 건네준다는 내용입니다."],
    ["작업자가 자기 장비를 별도로 구매함", "발주처가 보낸 답신을 받았습니다. 자택 장비는 제가 스스로 준비하며 일을 시작하기 전에 구매 비용은 제가 부담하되 발주처에 납부할 비용은 없다고 했습니다."],
    ["공개 조건에 따른 수강료", "실습기관에서 보낸 답신을 받았습니다. 정규 작업 수업이 시작되기 전에 공개된 수강료 납부가 필요하다고 안내했습니다."],
    ["비용이 문서에서 예시로만 언급됨", "업체 업무 답신을 받았습니다. 작업 시작 전에 비용부터 내야 한다는 문장은 교재의 가상 거래 사례에만 적혀 있고 실제 요구는 없었습니다."],
    ["요구를 발신자가 철회함", "일감을 맡긴 업체의 답장을 받았습니다. 업무 시작 전에 작업자가 비용을 내야 한다던 이전 요청은 이미 철회됐다고 합니다."],
    ["일반적인 예산 안내", "발주처의 업무 안내를 받았습니다. 작업을 시작하기 전에 예상 비용이 어느 정도인지 예산에 적어 두라고 했습니다."],
  ];
  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({text});
      assert.notEqual(result.level, "위험");
      assert.ok(!result.fired_rules.includes("R9"));
    });
  }
});