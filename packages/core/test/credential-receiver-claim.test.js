import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_CREDENTIAL_DISCLOSURE } from "../src/signals.js";

const checks = [
  ["문의에 응답한 사람이 수신자에게 발급된 값을 본인이 받아야 한다고 밝힘", true,
    "사용 문의에 답하던 사람이 제 기기에 표시된 일회용 확인값을 자신이 받아야 한다고 설명했습니다."],
  ["발신자의 명시적 수취 요구", true,
    "상대방이 저한테 온 일회용 번호를 자기가 전달받아야 한다고 말했습니다."],
  ["수신자가 아직 넘기지 않았어도 요구는 확인됨", true,
    "답장을 보내 준 사람이 수신자에게 발급된 일회용 암호를 자신이 받아야 한다고 했습니다. 저는 전달하지 않았습니다."],
  ["수신자가 자기 앱에서 직접 값을 확인", false,
    "답장을 보내 준 사람이 제게 발급된 일회용 값을 제가 제 기기에서 직접 확인해야 한다고 했습니다."],
  ["발신자 자신의 값", false,
    "상대방이 자기 기기에 온 일회용 번호를 자신이 받아야 한다고 말했습니다."],
  ["발신자가 받아야 하는 것은 서류", false,
    "문의에 답하던 사람이 제게 온 일회용 번호를 확인한 뒤 신청 서류를 자기가 받아야 한다고 말했습니다."],
  ["숫자의 길이를 확인할 뿐 값을 받지는 않음", false,
    "답장을 보내 준 사람이 제게 온 일회용 번호의 자리 수를 자신이 받아야 한다고 말했습니다."],
  ["상대가 내 주장을 전달한 경우", false,
    "제가 상대방이 제 기기에 표시된 일회용 확인값을 자기가 받아야 한다고 말했는지 물었습니다."],
  ["수신자에게 수취를 요구했다는 말이 부정됨", false,
    "상대방이 저한테 온 일회용 값을 자기가 받아야 한다고 말한 적은 없다고 설명했습니다."],
  ["다른 사람을 대상으로 한 가정", false,
    "연습용 문장을 읽었습니다. 상대방이 제게 온 일회용 값을 자기가 받아야 한다고 했습니다."],
  ["상대가 같은 요구를 철회", false,
    "답장을 보내 준 사람이 제게 온 일회용 값을 자신이 받아야 한다고 했습니다. 그 요청은 철회됐습니다."],
  ["같은 절에 다른 수취인이 명시됨", false,
    "문의에 답하던 사람이 제게 온 일회용 값을 담당자가 받아야 한다고 설명했습니다."],
];

for (const [name, expected, text] of checks) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.signals_code.includes(SIG_CREDENTIAL_DISCLOSURE), expected);
    assert.equal(result.fired_rules.includes("R16"), expected);
  });
}
