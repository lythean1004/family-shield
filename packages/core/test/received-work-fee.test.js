import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";
import { SIG_PREPAYMENT } from "../src/signals.js";

const offer = "용역 의뢰를 받고 조건을 물었더니 ";
const fee = "과업을 배정받기 전에 등록비를 먼저 납부하라는 요구";
const cases = [
  ["업무를 제안받은 사람이 착수 전에 내야 하는 보증금", "업무를 제안받아 조건을 확인하던 중, 업무 착수 전에 보증금을 미리 내라는 요청이 있었다는 기록이다.", true],
  ["조건을 묻자 발주 쪽에서 나온 등록비 요구", offer + fee + "가 들어왔다는 상담 기록이다.", true],
  ["배정받은 작업에 앞서 받은 수수료 요구", "작업을 배정받고 작업을 시작하기 전에 수수료를 우선 보내라는 지시를 받았다고 기록했다.", true],
  ["발주자가 작업자에게 주는 착수금", "작업을 의뢰하고 작업을 시작하기 전에 작업자에게 착수금을 먼저 보냈다는 지급 기록이다.", false],
  ["선납 요구 여부를 알 수 없는 경우", offer + fee + "가 있었는지는 알 수 없었다.", false],
  ["요구가 없었다고 명시", offer + fee + "가 없었다고 설명했다.", false],
  ["내가 먼저 수납 방식을 제안", "작업을 배정받고 제가 먼저 작업 전에 보증금을 예치하겠다고 제안했다.", false],
  ["다른 단체가 별개로 안내한 일정", "작업 의뢰를 받고 모임 안내도 읽었다. 별도 교육의 참가비를 미리 내라는 요청이 있었다.", false],
  ["이미 접수한 교육의 통상 비용", "용역 의뢰를 받고 별도 수업을 신청했다. 수업 시작 전에 참가비를 내라는 요청을 받았다.", false],
  ["뒤이어 같은 요구가 철회됨", offer + fee + "가 있었다. 해당 납부 요구는 철회됐다.", false],
  ["연습 자료에 인용한 기록", "교육 자료. " + offer + fee + "가 있었다.", false],
  ["실제로 지불하지 않아도 앞선 요구는 남음", offer + fee + "가 있었다. 저는 실제로 등록비를 납부하지 않았습니다.", true],
  ["같은 비용의 실제 납부자가 발주자", offer + fee + "가 있었다. 그 등록비는 발주 측이 내며 작업자에게 청구하지 않는다.", false],
  ["수행자에게 주기로 한 돈", "의뢰인이 수행자에게 보증금을 주는 계약이다. " + offer + fee + "가 있었다.", false],
  ["비용 조건이 사라졌다는 정정", offer + fee + "가 있었다. 담당자는 일을 받는 데 등록비가 필요 없다고 정정했다.", false],
];
for (const [title, text, expected] of cases) {
  test(title, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.signals_code.includes(SIG_PREPAYMENT), expected);
    assert.equal(result.fired_rules.includes("R9"), expected);
  });
}

test("일부만 들어온 보고에서 생략된 납부 주체를 추정하지 않음", () => {
  const signals = extractCodeSignals(offer + fee + "가 있었다.", { inputComplete: false }).signals;
  assert.equal(signals.includes(SIG_PREPAYMENT), false);
});
