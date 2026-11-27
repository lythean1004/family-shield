import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { applyParentContext, decide } from "../src/rule-engine.js";

const timetable = "독서 모임 시간표 안내입니다.";
const withLink = "독서 모임 시간표 library.invalid";

const answers = [
  [true, true], ["true", true],
  [false, false], ["false", false], ["미응답", false], [null, false],
  [1, false], [{ value: false }, false],
];

for (const [answer, yes] of answers) {
  test(`부모 확인 응답 ${JSON.stringify(answer)}의 첫 판정과 후속 판정`, async () => {
    const current = await analyze({ text: timetable, parentInputs: { call_in_progress: answer }, ai: null });
    assert.equal(current.fired_rules.includes("R1"), yes);
    assert.equal(decide({ family_denied: answer }).fired_rules.includes("R5"), yes);
    const priorCall = await analyze({ text: withLink, parentInputs: { called_before: answer }, ai: null });
    assert.equal(priorCall.fired_rules.includes("R2"), yes);
    const unconfirmed = { level: "주의", fired_rules: ["R7"], signals_final: ["SIG_LINK"] };
    const followup = applyParentContext(unconfirmed, { called_before: answer, family_denied: answer });
    assert.deepEqual(followup.fired_rules, yes ? ["R7", "R2", "R5"] : ["R7"]);
    if (!yes) assert.equal(followup, unconfirmed);
  });
}
