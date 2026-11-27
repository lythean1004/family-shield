import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";
import { SIG_CALL_THIS_NUMBER } from "../src/signals.js";

const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);
const testNumber = "0504-0000-0000";

test("050X 전체 번호를 예약 회신 요청과 연결", () => {
  assert.ok(hasCall("시설 예약 변경 안내. " + testNumber + " 전화해 주세요."));
});

test("050X 전체 번호를 업무 담당자의 번호 사용 요청과 연결", () => {
  assert.ok(hasCall("시설 접수 담당자 번호: " + testNumber + " 사용해 주세요."));
});

test("끝난 업무 통화에 등장한 접속 어미는 회신 지시가 아님", () => {
  assert.ok(!hasCall("시설 예약 일지. 담당자가 " + testNumber + " 전화해 일정을 확인했습니다."));
  assert.ok(!hasCall("시설 예약 일지. 담당자가 0504.0000.0000으로 전화해 일정을 확인했습니다."));
});

test("다른 숫자열 안에 있는 050X처럼 생긴 부분 번호는 복구하지 않음", () => {
  assert.ok(!hasCall("시설 장비 분류 92" + testNumber + " 전화해 주세요."));
  assert.ok(!hasCall("시설 장비 분류 " + testNumber + "-12 전화해 주세요."));
});

test("새로운 050X 표기의 로컬 검출로 건강 관련 AI 보류를 해제하지 않음", async () => {
  let calls = 0;
  const text = "시설 진료 일정입니다. 0504.0000.0000으로 문의해 주세요.";
  const ai = {
    provider: "openai", model: "mock", apiKey: "local-test-key",
    fetchImpl: async () => { calls++; throw new Error("local mock only"); },
  };
  assert.ok(hasCall(text));
  const result = await analyze({ text, ai });
  assert.equal(result.ai_skipped, "health");
  assert.equal(calls, 0);
});
