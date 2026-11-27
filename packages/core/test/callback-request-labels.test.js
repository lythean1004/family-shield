import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { analyze } from "../src/pipeline.js";
import { SIG_CALL_THIS_NUMBER } from "../src/signals.js";

const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);
const official = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
  .flatMap(card => card.callback_contact?.numbers ?? []).filter(number => /^1\d{3}-\d{4}$/.test(number));
const regionNumbers = [
  "02-000-0000", "02 000 0000", "02.000.0000", "(02) 000-0000", "+82 2 000 0000", "02\t000  0000",
];
const privateRelay = "0504-0000-0000";

test("같은 공식 대표번호가 동일 행의 마침표 뒤 단독으로 이어짐", () => {
  assert.ok(official.length > 0);
  for (const number of official) {
    assert.ok(!hasCall("아래 번호로 연락해 주세요. " + number));
    assert.ok(!hasCall("아래 번호로 연락해 주세요. " + number.replace("-", ".")));
  }
});

test("다음 행 공식 번호의 운영시간 또는 대표번호 주석", () => {
  for (const number of official) {
    for (const note of [" (평일 09:00~18:00)", " (운영시간: 09:00~18:00)", "（대표번호）"]) {
      assert.ok(!hasCall("아래 번호로 연락해 주세요.\n" + number + note));
    }
  }
});

test("별개 역할 문장과 빈 문단의 번호를 앞 요청에 결속하지 않음", () => {
  const [number] = official;
  assert.ok(hasCall("아래 번호로 연락해 주세요. " + number + "는 도서관 행사 연락처입니다."));
  assert.ok(hasCall("아래 번호로 연락해 주세요.\n\n" + number + " (대표번호)"));
  assert.ok(hasCall("아래 번호로 연락해 주세요.\n" + number + " (별도 행사 접수)"));
});

test("문의 창구를 지정하는 현재의 부탁은 국내 표기와 무관", () => {
  for (const number of regionNumbers) {
    assert.ok(hasCall("시설 이용 안내. 문의는 " + number + "로 부탁드립니다."));
  }
  for (const number of regionNumbers.slice(2)) {
    assert.ok(!hasCall("시설 업무 일지에서 문의는 " + number + "로 부탁드렸습니다."));
  }
});

test("명시적 예시, 완료 일지, 옛 안내 인용은 현재 회신 요구가 아님", () => {
  for (const number of regionNumbers.slice(2)) {
    assert.ok(!hasCall("작성 예시: " + number + "로 문의해 주세요."));
    assert.ok(!hasCall(number + "로 문의해 주세요. 이 문구는 작성 예시입니다."));
    assert.ok(!hasCall("시설 예약 완료 일지입니다.\n" + number + "로 문의해 주세요."));
    assert.ok(!hasCall("지난 안내에서 옮긴 문구는 다음과 같습니다. “" + number + "로 문의해 주세요.”"));
  }
});

test("실제 받은 요청과 별개 현재 안내는 앞 예시를 계속 따르지 않음", () => {
  for (const number of regionNumbers.slice(2)) {
    assert.ok(hasCall("방금 받은 시설 안내에 “" + number + "로 문의해 주세요”라는 요청이 들어 있었습니다."));
    assert.ok(hasCall("시설 안내를 받았습니다. “문의는 " + number + "로 부탁드립니다”라고 요청했습니다."));
    assert.ok(hasCall("신청 양식 예시입니다.\n오늘 새로 받은 시설 안내에서는 " + number + "로 문의해 주세요."));
  }
});

test("050X를 지정한 통화 뒤 동일 절의 부탁과 지시", () => {
  assert.ok(hasCall("시설 이용 안내를 받았습니다. " + privateRelay + "로 전화해 가능 시간을 물어보라고 했습니다."));
  assert.ok(hasCall("받은 시설 안내에는 " + privateRelay + "로 전화해 접수 시각을 확인해 달라는 요청이 있었습니다."));
});

test("전화 뒤의 금지, 다른 사람의 요청, 완료된 일지를 결속하지 않음", () => {
  assert.ok(!hasCall("시설 업무 일지. " + privateRelay + "로 전화해 자료를 묻지 말라고 했습니다."));
  assert.ok(!hasCall("시설 업무 일지. " + privateRelay + "로 전화해 답을 받았고 다른 직원은 별도 자료를 요청하라고 했습니다."));
  assert.ok(!hasCall("담당자가 " + privateRelay + "로 전화해 운영 시각 확인을 끝냈습니다."));
});

test("새 표기 문의 라벨은 로컬 판정에 쓰이고 기존 건강 보류는 유지", async () => {
  let calls = 0;
  const text = "시설 진료 일정입니다. 문의는 02.000.0000으로 부탁드립니다.";
  const ai = {
    provider: "openai", model: "mock", apiKey: "local-test-key",
    fetchImpl: async () => { calls++; throw new Error("local mock only"); },
  };
  assert.ok(hasCall(text));
  const result = await analyze({ text, ai });
  assert.equal(result.ai_skipped, "health");
  assert.equal(calls, 0);
});
