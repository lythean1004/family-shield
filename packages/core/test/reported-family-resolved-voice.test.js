import { strict as assert } from "node:assert";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { addReportedFamilySignals } from "../src/reported-family.js";
import { SIG_AVOID_VOICE, SIG_FAMILY_IMPERSONATION, SIG_MONEY, SIG_NEW_NUMBER } from "../src/signals.js";

const initial = "발신인은 제 이모라고 소개하며 신원 확인을 위한 전화를 거절했습니다.";
const resolved = "그 발신인이 앞선 거절을 철회하고 직접 통화에 응해 제가 목소리로 신원 확인을 마쳤어요.";

const reports = [
  [false, "같은 대화에서 발신자가 실제 통화에 응하고 확인까지 완료",
    "아들이라고 밝힌 상대가 목소리 확인을 거절했어요. 같은 대화에서 그 거절을 철회하고 전화 통화에 응해서 저는 들은 목소리로 확인을 마쳤습니다."],
  [false, "발신자를 다시 주어로 명시하고 전화에서 확인 완료", initial + " " + resolved],
  [false, "해소 뒤에도 새 번호의 금전 요구는 별도로 남음",
    "새 연락처로 온 문자에서 조카라고 밝혔습니다. 발신자가 통화로 신원 확인을 거절했어요. 같은 발신자가 거절을 철회하고 직접 통화에 응했고 저는 목소리로 확인을 마쳤습니다. 발신자가 돈을 요구했다고 기록했습니다.",
    ["R3"], [SIG_MONEY, SIG_NEW_NUMBER]],
  [false, "해소 뒤 제3의 연락이 가리키는 보호 신호 보존",
    initial + " " + resolved + " 별도로 중고 거래 건으로 문의했습니다. 판매자가 제 기기에서 쓰던 뱅킹 앱을 삭제하라고 요구했습니다.",
    ["R9"]],
  [true, "철회 이후 미래 통화를 제안했을 뿐 완료되지 않음",
    initial + " 그 발신인이 거절을 철회하고 내일 직접 음성 통화에 응하겠다고 했어요."],
  [true, "발신자가 철회했지만 음성 통화는 다른 사람이 받음",
    initial + " 그 발신인이 거절을 철회했고 보호자가 직접 통화에 응해 제가 목소리로 확인을 마쳤어요."],
  [true, "발신자가 철회했지만 목소리 확인은 미완료",
    initial + " 그 발신인이 거절을 철회하고 통화에 응했으나 제가 목소리로 확인을 마치지 못했습니다."],
  [true, "완료 후 동일 발신자의 새 음성 확인 거절",
    initial + " " + resolved + " 발신자가 음성으로 신원을 확인하는 절차를 거부했습니다."],
  [true, "완료 후 동일 발신자의 확인 시도 거절과 문자만 요구",
    initial + " " + resolved + " 제가 통화를 걸어 봤습니다. 상대가 통화하지 말라고 하고 채팅으로만 대화하자고 했습니다."],
  [true, "수신자의 철회 및 다른 사람의 실제 통화는 발신자의 거절을 남김",
    initial + " 제가 거절을 철회하고 목소리로 확인을 마쳤어요."],
];

for (const [activeRefusal, name, text, preservedRules = [], preservedSignals = []] of reports) {
  test(name, async () => {
    const source = new Set();
    addReportedFamilySignals(text, source);
    const result = await analyze({ text, ai: null });
    assert.equal(source.has(SIG_AVOID_VOICE), activeRefusal);
    assert.equal(result.fired_rules.includes("R4"), activeRefusal);
    assert.ok(result.signals_code.includes(SIG_FAMILY_IMPERSONATION));
    for (const rule of preservedRules) assert.ok(result.fired_rules.includes(rule), rule);
    for (const signal of preservedSignals) assert.ok(result.signals_code.includes(signal), signal);
    assert.equal(result.level === "위험", activeRefusal || preservedRules.length > 0);
  });
}
