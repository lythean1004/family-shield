import test from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";

const reportsR14 = text => {
  const { signals } = extractCodeSignals(text);
  return decide({ signals_final: signals, signals_code: signals }).fired_rules.includes("R14");
};

const cases = [
  [true, "수신자 진술에 따르면 동생 명의로 도착한 첫 메시지에서 연락처를 바꿨다고 알렸으며, 이어진 채팅에서 신분증 사본을 요구했습니다."],
  [true, "딸 이름으로 온 문자에 새 연락처를 쓴다고 알렸습니다. 같은 문자에서 신분증 사진을 답장으로 보내라고 했습니다."],
  [true, "형 이름으로 온 메시지에서는 본인 번호를 바꿨다고 말했습니다. 그 메시지에서 여권 사본을 회신으로 첨부하라고 요청했습니다."],
  [false, "수신자 진술에 따르면 동생 명의로 도착한 첫 메시지에서 연락처를 바꿨다고 알렸으며, 다른 발신자가 신분증 사본을 요구했습니다."],
  [false, "동생 명의로 도착한 메시지에 연락처를 바꿨다고 알렸습니다. 단체 대화에서 한 참가자가 신분증 사본을 요구했습니다."],
  [false, "딸 이름으로 온 문자에 새 연락처를 쓴다고 알렸습니다. 같은 문자에서 신분증 사진을 요구했습니다. 기존 번호로 전화해서 본인임을 확인했습니다."],
  [false, "예방 교육 자료 — 딸 이름으로 온 문자에 새 연락처를 쓴다고 알렸습니다. 같은 문자에서 신분증 사진을 요청했습니다."],
  [false, "딸 이름으로 온 문자에 새 연락처를 쓴다고 알렸습니다. 같은 문자에서 신분증 사진을 요청했습니다. 발신자가 그 요청을 철회했습니다."],
  [false, "딸 이름으로 온 문자에 새 연락처를 쓴다고 알렸습니다. 같은 문자에서 수신자가 신분증 사진을 보내야 하는지 물었습니다."],
  [false, "딸 이름으로 온 문자에 수신자가 번호를 바꿨다고 적혀 있었습니다. 같은 문자에서 발신자가 신분증 사진을 요청했습니다."],
  [false, "딸 이름으로 온 문자에 새 연락처를 쓴다고 알렸습니다. 같은 문자에서 발신자가 자기 신분증 사진을 수신자에게 보냈습니다."],
  [false, "분류 표제에 친척 사칭이라고 적혀 있었다. 기록에는 새 대화 계정과 휴대전화 앱 추가가 언급돼 있다."],
];

for (const [index, [expected, summary]] of cases.entries()) {
  test("명의 연락에서 변경 발신자와 자료를 보내는 사람 " + (index + 1), () => {
    assert.equal(reportsR14(summary), expected);
  });
}
