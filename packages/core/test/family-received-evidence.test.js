import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const appHeader = "접수 메모, 발신 표시는 수신인의 고모, 바뀐 연락처에서 수신";
const receivedApp = "설치를 지시받은 사람은 수신인 / 프로그램 주소는 적지 않았습니다";
const positive = [
  ["발신자의 자기표시와 설치를 요구받은 실제 수신자",
    appHeader + ", " + receivedApp + ".",
    "R14", ["SIG_NEW_NUMBER", "SIG_APP_INSTALL"]],
  ["별도 표기법에서도 미기재 URL을 만들지 않고 앱 대상만 확인",
    "기록: 보낸 사람 소개는 받은 쪽의 외삼촌, 다른 번호로 온 연락, 다운로드 요청받은 쪽은 수신자; 앱 이름은 옮겨 쓰지 않았습니다.",
    "R14", ["SIG_APP_INSTALL"]],
  ["관계를 표시한 사람이 금전 요청과 비밀 유지 요구를 함께 보냄",
    "받은 대화 기록입니다. 사위를 자처한 발신자의 송금 요청과 비밀 유지 요구가 동시에 접수됐습니다.",
    "R13", ["SIG_MONEY", "SIG_SECRECY"]],
  ["두 요구의 순서가 바뀐 같은 수신 요약",
    "식구를 가장한 쪽에서 비밀 유지 부탁과 현금 요구를 함께 받았다는 상담 요약입니다.",
    "R13", ["SIG_MONEY", "SIG_SECRECY"]],
];
const normal = [
  ["작성자 관계만 밝힌 프로그램 기록",
    "접수 메모, 작성자 소개는 수신인의 고모, 바뀐 연락처에서 수신, " + receivedApp + "."],
  ["원래 쓰던 동일한 번호",
    "접수 메모, 발신 표시는 수신인의 고모, 기존 번호는 그대로, " + receivedApp + "."],
  ["타인의 설치 지시",
    appHeader + ", 설치를 지시받은 사람은 시설 직원 / 프로그램 주소는 적지 않았습니다."],
  ["설치 요청을 받은 사람과 프로그램 안내의 출처가 별개",
    appHeader + ". 별도로 도서관에서 보낸 안내입니다. " + receivedApp + "."],
  ["프로그램 메모가 다른 앱을 가리킴",
    appHeader + ", 설치를 지시받은 사람은 수신인 / 프로그램 주소는 별개 예시입니다."],
  ["실제 설치 지시가 철회됨",
    appHeader + ", " + receivedApp + ". 그 설치 요청은 철회했습니다."],
  ["역할극 자료의 표시 예시",
    "역할극 자료입니다. " + appHeader + ", " + receivedApp + "."],
  ["계약의 비밀 유지 약관과 별개의 송금 요청",
    "사위를 자처하던 사람에게서 정산 연락을 받았습니다. 별도로 학교 계약서에는 비밀 유지 요구와 송금 요청이 적혔습니다."],
  ["두 요청의 주체가 다른 별개 접수",
    "친족을 자처한 사람이 송금 요청을 했습니다. 상담원이 별도로 비밀 유지 약정을 설명했습니다."],
  ["수신자가 스스로 별도의 비밀 유지 결정을 함",
    "가족이라고 밝힌 사람이 정산 부탁을 했습니다. 비밀 유지는 수신자가 스스로 결정한 사항입니다."],
  ["금전과 비밀 유지가 함께 나온 완료 거래 기록",
    "지난달 종결된 상담 기록입니다. 일가를 자처한 사람의 금전 요구와 비밀 유지 요구가 함께 접수됐던 상황을 정리했습니다."],
  ["본인확인 제안과 일정상의 일시적 통화 거절",
    "메시지 발신자가 작은아들이라고 소개했습니다. 제가 전화로 본인 확인을 제안했는데 상대는 근무 중이라 퇴근 후 다시 전화하자고 했습니다."],
];
for (const [label, text, rule, signals] of positive) test(label, async () => {
  const result = await analyze({ text, ai: null });
  assert.equal(result.level, "위험");
  assert.ok(result.fired_rules.includes(rule));
  for (const signal of signals) assert.ok(result.signals_code.includes(signal), signal);
  assert.ok(!result.signals_code.includes("SIG_LINK"));
});
for (const [label, text] of normal) test(label, async () => {
  assert.notEqual((await analyze({ text, ai: null })).level, "위험");
});
