import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCallback } from "../src/callback-number.js";
import { extractCodeSignals } from "../src/extract.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { mask } from "../src/masking.js";
import { analyze } from "../src/pipeline.js";
import { SIG_AGENCY_IMPERSONATION, SIG_CALL_THIS_NUMBER } from "../src/signals.js";

const checkedCards = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked");
const contacts = checkedCards.flatMap(card => card.callback_contact?.numbers ?? []);
const representatives = contacts.filter(number => /^1\d{3}-\d{4}$/.test(number));
const card = checkedCards.find(card => card.id === "EV-DOM-EPOST");
const hasCall = text => extractCodeSignals(text).signals.includes(SIG_CALL_THIS_NUMBER);
const callFor = number => classifyCallback("상담원 연결: " + number, []).directed;
const renderings = [
  "02-000-0000", "02.000.0000", "02\t000  0000", "(02) 000-0000",
  "+82 2 000 0000", "+82 (0) 2 000 0000", "82-2-000-0000",
];

test("근거 카드의 대표번호는 점과 수평 공백을 사용해도 동일한 번호", () => {
  assert.ok(representatives.length > 0);
  for (const number of representatives) {
    for (const delimiter of ["-", ".", " ", "\t", "  "]) {
      assert.ok(!hasCall("아래 번호로 연락해 주세요: " + number.replace("-", delimiter)));
    }
  }
});

test("공식 단축번호와 원번호를 생략하거나 가린 기존 판독", () => {
  for (const number of contacts.filter(value => /^1\d{2,3}$/.test(value))) {
    assert.ok(!hasCall("아래 번호로 연락해 주세요: " + number));
  }
  assert.ok(hasCall("아래 번호로 연락해 주세요: [번호]"));
  assert.ok(hasCall("아래 번호로 연락해 주세요."));
  assert.ok(!callFor("[번호]"));
});

test("국내 구조가 맞는 상담 번호는 전체 표기와 조사 뒤의 요청이 모두 읽힘", () => {
  for (const formatted of renderings) {
    assert.ok(callFor(formatted));
    assert.ok(classifyCallback(formatted + "으로 문의해 주세요.", []).directed);
    assert.ok(hasCall(formatted + "으로 문의해 주세요."));
  }
});

test("번호 범위를 벗어나는 다른 숫자열과 국제·괄호 표기", () => {
  const unrelated = [
    "12.02.000.0000", "02.000.0000.99",
    "02. 000. 0000", "02\n000\n0000", "02-000\n0000", "02\v000\v0000",
    "02-000-0000-1", "+82 099 000 0000", "(099) 000-0000", "+82 15XX 0000",
  ];
  for (const number of unrelated) {
    assert.ok(!callFor(number));
    assert.ok(!hasCall("문의: " + number));
  }
});

test("명시된 050X와 번호 양옆의 숫자 셀", async () => {
  assert.ok(callFor("0504-0000-0000"));
  assert.ok(callFor("0504.0000.0000"));
  assert.ok(callFor("0504 0000 0000"));
  assert.ok(classifyCallback("17 02.000.0000으로 문의해 주세요.", []).directed);
  assert.ok(callFor("02.000.0000 17"));
  const { CALLBACK_NUMBER_SOURCE } = await import("../src/phone-number.js");
  const fields = "7 02.000.0000 2026 0504 0000 0000 21";
  assert.deepEqual([...fields.matchAll(new RegExp(CALLBACK_NUMBER_SOURCE, "gu"))].map(match => match[0]),
    ["02.000.0000", "0504 0000 0000"]);
});

test("다른 사람의 통화 완료 일지가 새 현재 회신 요구가 되지 않음", () => {
  for (const contact of ["02.000.0000", "(02) 000-0000", "+82 2 000 0000", "0504.0000.0000"]) {
    assert.ok(!hasCall("시설 운영 일지. 담당자가 " + contact + "으로 전화해 예약 여부를 확인했습니다."));
  }
});

test("새 형식도 지시의 다음 행과 별개 문단을 구분", () => {
  assert.ok(classifyCallback("상담원 연결:\n02.000.0000", []).directed);
  assert.ok(!classifyCallback("상담원 연결:\n\n02.000.0000", []).directed);
  assert.ok(!classifyCallback("02.000.0000\n\n으로 문의해 주세요.", []).directed);
});

test("공식 번호를 같은 안내의 다음 줄에 묶되 별개 문단과 문장은 합치지 않음", () => {
  const [number] = representatives;
  const dotted = number.replace("-", ".");
  assert.ok(!hasCall("아래 번호로 연락해 주세요.\n" + dotted));
  assert.ok(hasCall("아래 번호로 연락해 주세요.\n\n" + dotted));
  assert.ok(hasCall("아래 번호로 연락해 주세요. " + dotted + "는 행사 연락처입니다."));
  assert.ok(!hasCall("아래 번호로 연락해 주세요. ☎ " + dotted));
});

test("국제형·괄호·구분자가 달라도 국내 번호 마스킹과 HMAC 일치", () => {
  const opts = { hmacKey: "local-test-key" };
  const normal = mask(renderings[0], opts);
  for (const number of renderings) assert.deepEqual(mask(number, opts), normal);
  assert.equal(mask("02\n000\n0000").masked, "[번호]");
  assert.equal(mask("0504-0000-0000").masked, "[번호]");
});

test("등록 발신자 귀속을 로컬에서 검출해도 건강 안내의 AI 보류를 풀지 않음", async () => {
  const name = card.sender_names?.[0] ?? card.name;
  const topic = card.callback_contact.topics?.[0] ?? "";
  const make = formatted => "[" + name + "] 시설 시험용 진료 안내. " + topic + " 상담원 연결: " + formatted;
  let calls = 0;
  const ai = {
    provider: "openai", model: "mock", apiKey: "local-test-key",
    fetchImpl: async () => { calls++; throw new Error("local mock only"); },
  };
  for (const number of renderings.slice(1)) {
    const text = make(number);
    const { signals, healthRoutingSignals } = extractCodeSignals(text);
    for (const signal of [SIG_CALL_THIS_NUMBER, SIG_AGENCY_IMPERSONATION]) {
      assert.ok(signals.includes(signal));
      assert.ok(!healthRoutingSignals.includes(signal));
    }
    const result = await analyze({ text, ai });
    assert.equal(result.ai_skipped, "health");
    assert.ok(result.fired_rules.includes("R6"));
  }
  assert.equal(calls, 0);
  const original = await analyze({ text: make(renderings[0]), ai });
  assert.equal(original.ai_skipped, null);
  assert.equal(calls, 1);
});
