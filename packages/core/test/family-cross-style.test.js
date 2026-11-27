import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { receivedFieldLines } from "../src/received-message.js";

const header = "| 분류 항목 | 수신 경위 |\n| --- | --- |";
const sender = "| 관계 주장 | 자신을 이모라고 밝힌 메시지 |\n| 발신 경로 | 이전과 다른 번호로 온 연락 |";
const sendDocument = "| 요구 사항 | 신분증 사본이 담긴 자료를 달라고 한 기록 |";
const withTable = (...rows) => [header, ...rows].join("\n");
const originalContact = "제 형인 척하는 사람이 처음 쓰는 연락처로 메시지를 보냈다는 상담 요약입니다.";
const positive = [
  ["표에서 발신 관계와 번호 변경, 자료 요구 확인", withTable(sender, sendDocument), "SIG_PERSONAL_INFO"],
  ["가족인 양 행세한 상대가 수신자 기기에 설치를 유도", originalContact + " 수신자 기기에 앱을 설치하도록 유도했다는 분류 기록입니다.", "SIG_APP_INSTALL"],
  ["다른 번호를 쓰는 자칭 친족의 사역형 설치 기록", "내 고모인 양 행세하는 사람이 바뀐 연락처에서 메시지를 보냈습니다. 그 사람은 저에게 프로그램을 설치하게 했다는 수신 기록입니다.", "SIG_APP_INSTALL"],
];
const normal = [
  ["표에서 신분 서류 처리 여부만 조회", withTable(sender, "| 요구 사항 | 신분증 사본 발급 여부만 확인해 달라는 행정 기록 |")],
  ["줄을 띄운 두 표의 발신과 요구는 별개", withTable(sender) + "\n\n" + withTable(sendDocument)],
  ["연속한 두 표의 발신과 요구는 별개", withTable(sender) + "\n" + withTable(sendDocument)],
  ["같은 표에서 번호 변경이 취소됨", withTable("| 관계 주장 | 자신을 이모라고 밝힌 메시지 |", "| 발신 경로 | 기존 번호가 바뀌지 않았습니다 |", sendDocument)],
  ["보관 중인 교육 자료의 예시", "예방 교육 자료입니다.\n" + withTable(sender, sendDocument)],
  ["표의 요구가 이미 철회됨", withTable(sender, "| 요구 사항 | 신분증 사본이 담긴 자료를 달라는 요구는 철회했습니다 |")],
  ["수신자가 요구한 정보", withTable(sender, "| 요구 사항 | 제가 신분증 사본을 제출하라고 요청했습니다 |")],
  ["공연 직원의 전용 기기 설치", originalContact + " 발신자는 공연 직원에게 업무용 프로그램을 설치하도록 안내했다는 별도 기록입니다."],
  ["서술 속 설치 유도 부정", originalContact + " 수신자 기기에 앱을 설치하도록 유도한 적이 없다고 확인했습니다."],
  ["발신자가 자기 기기에 설치", originalContact + " 발신자는 자신의 기기에 정비용 앱을 설치하도록 유도했다는 업무 보고입니다."],
  ["발신자 주어 뒤 대상은 적혀 있지 않음", originalContact + " 그 사람은 프로그램을 설치하도록 했다는 수신 기록입니다."],
  ["관람객의 전시장 기기에 설치", originalContact + " 그 사람은 관람객에게 전시용 앱을 설치하도록 유도했다는 행사 보고입니다."],
  ["배우자 기기는 수신자 기기와 별개", originalContact + " 발신자는 배우자 기기에 앱을 설치하도록 유도했다는 생활 기록입니다."],
  ["수신자에게 전달된 지시는 자녀 기기용", originalContact + " 발신자는 수신자에게 자녀의 휴대폰에 교육용 앱을 설치하도록 안내했다는 기록입니다."],
  ["수신자 기기에도 관람객 대상 지시를 이식하지 않음", originalContact + " 발신자는 관람객에게 수신자 기기에 앱을 설치하도록 지시했다는 업무 요약입니다."],
  ["같은 요약에서 다른 발신자의 설치 설명은 별개", originalContact + " 한편 도서관 직원이 수신자 기기에 프로그램을 설치하도록 안내했다는 기록입니다."],
  ["일상 가족의 연락과 앱 업데이트", "이모가 지난주와 같은 번호로 통화했습니다. 도서관 앱은 제 기기에 직접 업데이트했습니다."],
  ["낭독극의 가족 배역", "낭독극에서 제 형인 척하는 사람이 처음 쓰는 연락처로 메시지를 보냈다는 배역 설명입니다. 수신자 기기에 앱을 설치하도록 유도했다는 대본 내용입니다."],
  ["건강 상담의 외부 전송 생략", "어머니와 병원에 갔습니다. 당뇨약 복용량은 의료진에게 진료실에서만 문의했습니다."],
];
for (const [name, text, signal] of positive) test(name, async () => {
  const result = await analyze({ text, ai: null });
  assert.equal(result.level, "위험");
  assert.ok(result.fired_rules.includes("R14"));
  assert.ok(result.signals_code.includes(signal), signal);
});
for (const [name, text] of normal) test(name, async () => {
  const result = await analyze({ text, ai: null });
  assert.notEqual(result.level, "위험");
  assert.ok(!result.fired_rules.includes("R14"));
});
test("공통 표 파서는 이어지는 헤더 앞에서 경계를 유지한다", () => {
  const fields = receivedFieldLines(withTable(sender) + "\n" + withTable(sendDocument));
  assert.equal(fields.filter(line => line === "").length, 2);
  assert.equal(fields[2], "");
});
test("건강 상담 정상 대조는 설명 외부 호출을 생략한다", async () => {
  let calls = 0;
  const result = await analyze({ text: normal.at(-1)[1], ai: {
    model: "offline", apiKey: "dummy", baseUrl: "urn:offline",
    fetchImpl: async () => { calls++; throw new Error("unwanted call"); },
  } });
  assert.equal(calls, 0);
  assert.equal(result.ai_skipped, "health");
});
