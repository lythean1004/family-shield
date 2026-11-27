import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";

const reportedRefusals = [
  "조카라고 주장한 사람이 통화로 자기 신원을 확인하는 절차를 거부했습니다.",
  "상대는 내 동생이라고 소개했습니다. 전화로 본인인지 확인하는 것을 거부했어요.",
  "자신을 손녀라고 밝힌 쪽이 음성으로 본인을 확인하는 절차를 거듭 거부했다.",
];

for (const text of reportedRefusals) {
  test(`가족이라고 주장한 상대의 음성 본인확인 거부를 인식한다 · ${text}`, async () => {
    const result = await analyze({ text });
    assert.ok(result.fired_rules.includes("R4"));
    assert.equal(result.level, "위험");
  });
}

const otherSituations = [
  "조카라고 주장한 사람이 있었고 제가 통화로 본인인지 확인하는 절차를 거부했습니다.",
  "조카라고 주장한 사람이 있었는데 동행한 사람이 통화로 자기 신원을 확인하는 절차를 거부했습니다.",
  "상대는 제 동생이라고 했습니다. 다른 쪽이 전화로 본인인지 확인하는 것을 거부했어요.",
  "상대는 동생이라고 소개했습니다. 이번에는 보호자가 전화로 본인인지 확인하는 것을 거부했어요.",
  "조카라고 주장한 사람이 목소리로 본인인지 확인했습니다. 사진 공개를 거부했습니다.",
  "조카라고 주장한 사람이 통화로 자기 신원을 확인하는 절차를 거부한 적은 없었습니다.",
  "상대는 동생이라고 소개했습니다. 전화로 본인인지 확인하는 것을 거부했는지 물었습니다.",
  "조카라고 주장한 사람이 전화로 다른 사람의 신원을 확인하는 절차를 거부했습니다.",
  "상대는 손녀라고 밝혔습니다. 청각 장애로 전화로 본인인지 확인하는 것을 거부했어요.",
  "사기 예방 수업에서 누군가 조카라고 주장하고 목소리로 본인을 확인하는 절차를 거부했다는 장면을 읽었습니다.",
  "직접 통화로 신원을 확인하는 절차를 거부한 사람에 대해 문의가 들어왔습니다.",
  "조카라고 주장한 사람이 통화로 자기 신원을 확인하는 절차를 거부했습니다. 나중에 원래 번호로 전화해서 직접 확인했습니다.",
];

for (const text of otherSituations) {
  test(`누가 어떤 확인을 거부했는지 분명한 경우만 R4를 적용한다 · ${text}`, async () => {
    const result = await analyze({ text });
    assert.ok(!result.fired_rules.includes("R4"), JSON.stringify(result.fired_rules));
  });
}
