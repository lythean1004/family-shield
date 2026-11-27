import test from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";

const paperwork =
  "법정 복지업무를 맡은 구청 창구 담당이라고 소개한 발신자가 있었습니다. " +
  "수신자가 적은 기록에는 신분증이 담긴 자료를 상대가 정해 준 별도 회신 채널에 제출하라고 요구한 내용이 남았습니다.";
const heading = "받은 안내 상담 기록";
const table = ["| 항목 | 상담 내용 |", "| --- | --- |"];
const claimant = "| 발신자가 내세운 소속 | 수사기관 직원 |";
const transfer = "| 받은 요청 | 현찰을 준비해서 직접 만나 전달하도록 적혀 있었음 |";
const receivedCash = [heading, ...table, claimant, transfer].join("\n");

test("같은 발신자가 지정한 회신처로 신분증 자료를 보내라는 요구", async () => {
  const result = await analyze({ text: paperwork });
  assert.equal(result.level, "위험");
  assert.ok(result.signals_code.includes("SIG_PERSONAL_INFO"));
  assert.ok(result.fired_rules.includes("R6"));
});

test("같은 두 열 수신 표의 소속 주장과 현금 대면 인계 요구", async () => {
  const result = await analyze({ text: receivedCash });
  assert.equal(result.level, "위험");
  assert.ok(result.signals_code.includes("SIG_CASH_HANDOVER"));
  assert.ok(result.fired_rules.includes("R15"));
});

for (const [label, text, prohibited] of [
  ["용도를 설명하고 개인정보가 가려진 자료를 요청", paperwork.replace("신분증이 담긴 자료", "신분증 번호를 완전히 가린 자료"), "SIG_PERSONAL_INFO"],
  ["별개 발신자가 정한 회신처", paperwork.replace("상대가 정해 준", "다른 담당자가 정해 준"), "SIG_PERSONAL_INFO"],
  ["개인정보 제출 요구가 없었다는 기록", paperwork.replace("제출하라고 요구한 내용이 남았습니다", "제출하라는 뜻은 아니라고 밝혔습니다"), "SIG_PERSONAL_INFO"],
  ["표가 다르면 서로 결합하지 않음", [heading, ...table, claimant, "", ...table, transfer].join("\n"), "SIG_CASH_HANDOVER"],
  ["미완성 Markdown 행과 뒤쪽 별도 기록", [heading, ...table, claimant, "| 메모 |", "받은 요청: 현찰을 준비해서 직접 만나 전달하도록 적혀 있었음"].join("\n"), "SIG_CASH_HANDOVER"],
  ["현금을 이미 인수한 뒤 분실물 돌려준 사실", receivedCash.replace("현찰을 준비해서 직접 만나 전달하도록 적혀 있었음", "이미 발견한 물건을 직접 만나 돌려받았음"), "SIG_CASH_HANDOVER"],
  ["같은 인계 요청이 철회됐다는 상태 행", receivedCash + "\n| 처리 상태 | 해당 요청은 이미 철회됐습니다 |", "SIG_CASH_HANDOVER"],
  ["교육 자료에 실린 표", receivedCash.replace(heading, "피해 예방 교육에서 사용한 받은 안내 상담 예시 자료"), "SIG_CASH_HANDOVER"],
]) {
  test(label, () => {
    assert.ok(!extractCodeSignals(text).signals.includes(prohibited));
  });
}