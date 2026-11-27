import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const examples = [
  ["예약 내역 열람이 조건인 수신문", "도착한 답신에는 예약 내역을 열람하려면 별도 앱을 설치하라는 지시가 들어 있었습니다."],
  ["요청 대상이 수신자의 기기인 경우", "받은 통지문에는 접수 기록을 확인하려면 제가 제 기기에 프로그램을 설치하라는 요청이 담겨 있었습니다."],
  ["요구를 이행하지 않았다고 뒤에 적은 경우", "수신한 쪽지에는 처리 결과를 보려면 소프트웨어를 설치하라는 요구가 있었습니다. 저는 설치하지 않았어요."],
];

for (const [title, text] of examples) {
  test(title, async () => {
    const received = await analyze({ text, parentInputs: { called_before: true } });
    assert.ok(received.signals_code.includes("SIG_APP_INSTALL"));
    assert.ok(received.fired_rules.includes("R2"));
    const unanswered = await analyze({ text });
    assert.ok(!unanswered.fired_rules.includes("R2"));
  });
}

const controls = [
  ["내용 열람 방법만 알려 준 문서", "수신한 안내문에는 처리 결과를 보려면 열람 메뉴를 확인하라는 안내가 있었습니다."],
  ["장비 관리자가 자기 업무 기기에 설치", "받은 쪽지에는 직원이 접수 기록을 확인하려면 업무용 기기에 프로그램을 설치하라는 지시가 있었습니다."],
  ["다른 사람이 받은 요청", "제 동료가 받은 회신에는 예약 내역을 열람하려면 별도 프로그램을 설치하라는 지시가 있었습니다."],
  ["설치 필요 여부를 질문한 기록", "도착한 메시지에는 문의 내용을 보려면 앱을 설치하라는 지시가 있었는지 묻는 질문이 있었습니다."],
  ["발신자가 명시적으로 철회", examples[0][1] + " 발신자가 그 설치 지시를 철회했습니다."],
  ["예방 교육의 문서 열람 예시", "예방 교육 자료 속에서 받은 통지문에는 신청 내용을 보려면 앱을 설치하라는 지시가 있었습니다."],
];

for (const [title, text] of controls) {
  test(title, async () => {
    const result = await analyze({ text, parentInputs: { called_before: true } });
    assert.ok(!result.signals_code.includes("SIG_APP_INSTALL"));
    assert.ok(!result.fired_rules.includes("R2"));
  });
}

test("문자 발신자는 이전에 통화한 기관과 별도로 확인한다", async () => {
  const text = "시청 민원팀이라고 자신을 소개한 사람과 통화했습니다. " + examples[0][1];
  const result = await analyze({ text, parentInputs: { called_before: true } });
  assert.ok(result.fired_rules.includes("R2"));
  assert.ok(!result.fired_rules.includes("R6"));
});

test("잘린 기록에서는 새 열람 조건을 적용하지 않는다", async () => {
  const text = examples[1][1] + " " + "일정 기록 ".repeat(420) + "발신자가 그 설치 지시를 철회했습니다.";
  const result = await analyze({ text, parentInputs: { called_before: true } });
  assert.ok(result.truncated);
  assert.ok(!result.fired_rules.includes("R2"));
});
