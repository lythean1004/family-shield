import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";
import { SIG_CALL_THIS_NUMBER } from "../src/signals.js";

const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);
const privateRelay = "0504-0000-0000";
const formats = ["02-000-0000", "02.000.0000", "(02) 000-0000", "+82 2 000 0000"];

test("050X의 실제 통화 지시를 문서에 기록한 간접명령", () => {
  assert.ok(hasCall("시설 안내를 받았습니다. " + privateRelay
    + "로 전화해 운영 시각을 확인해 달라고 수신 기록에 적혔습니다."));
  assert.ok(hasCall("받은 시설 안내에는 " + privateRelay
    + "로 전화해 다음 점검 시각을 물어보라고 회신 문서에서 명시돼 있었습니다."));
  assert.ok(hasCall("받은 시설 안내에는 " + privateRelay
    + "로 전화해 회의 시간을 알려 달라고 상담 기록에 쓰여 있습니다."));
});

test("수신한 회신 부탁은 정상 전화번호 표기에 관계없이 연결", () => {
  for (const number of [...formats, "0504.0000.0000"]) {
    assert.ok(hasCall("시설 예약 안내가 왔습니다. " + number + "로 연락해 달라는 요청을 받았습니다."));
  }
});

test("실제 수신자가 아닌 사람의 질문, 부정, 처리 완료 기록", () => {
  assert.ok(!hasCall("검토자가 " + privateRelay
    + "로 전화해 운영 시각을 확인해 달라고 적혀 있는지 물었습니다."));
  assert.ok(!hasCall("받은 안내에는 " + privateRelay
    + "로 전화해 운영 시각을 묻지 말라고 문서에 적혔습니다."));
  assert.ok(!hasCall("받은 안내에는 " + privateRelay
    + "로 전화해 운영 시각을 알려 달라는 내용이 아니라고 수신 기록에 적혔습니다."));
  assert.ok(!hasCall("담당자가 " + privateRelay
    + "로 전화해 문의가 끝났고 다른 직원이 후속 자료를 확인하라고 기록에 적혔습니다."));
});

test("번호와 같은 범위의 양식 견본과 폐기된 문서를 두 경로 모두에서 제외", () => {
  for (const number of formats) {
    assert.ok(!hasCall("시설 접수 양식의 견본입니다. 문의는 " + number + "로 부탁드립니다."));
    assert.ok(!hasCall("폐기된 안내에 “" + number + "로 문의해 주세요”라는 문구가 있었습니다."));
    assert.ok(!hasCall("시설 접수 양식의 예시입니다. 아래 번호로 연락해 주세요.\n" + number));
  }
});

test("같은 번호의 예시와 별개 문단의 새로운 실제 요구를 구분", () => {
  for (const number of formats) {
    const example = "시설 신청 양식의 예시입니다. 문의는 " + number + "로 부탁드립니다.";
    const current = "오늘 받은 시설 안내에는 " + number + "로 연락해 달라는 요청이 있었습니다.";
    assert.ok(!hasCall(example + "\n\n시설 게시물의 문의 기록은 끝났습니다."));
    assert.ok(hasCall(example + "\n\n" + current));
  }
});

test("해당 번호의 회신 지시가 이어지는 문장에서 철회됨", () => {
  assert.ok(!hasCall("시설 담당자로부터 " + privateRelay
    + "로 전화해 운영 시각을 확인해 달라고 수신 기록에 적혔습니다. 그 요청을 철회했습니다."));
  assert.ok(!hasCall("시설 예약 안내에서 02.000.0000으로 연락해 달라는 요청을 받았습니다. 그 요청이 취소됐습니다."));
});

test("새 표기에서 실제 보고를 읽어도 건강정보를 AI에 보내지 않음", async () => {
  let calls = 0;
  const text = "시설 진료 안내가 도착했습니다. 02.000.0000으로 연락해 달라는 요청을 받았습니다.";
  const ai = {
    provider: "openai", model: "mock", apiKey: "local-test-key",
    fetchImpl: async () => { calls++; throw new Error("local mock only"); },
  };
  assert.ok(hasCall(text));
  const result = await analyze({ text, ai });
  assert.equal(result.ai_skipped, "health");
  assert.equal(calls, 0);
});
