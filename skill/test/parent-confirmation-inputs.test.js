import assert from "node:assert/strict";
import test from "node:test";
import { readRequest } from "../src/kakao.js";
import { handleAnalyze, handleRequest } from "../src/handler.js";

const text = "독서 모임 시간을 확인했어요.";
const cfg = { ai: null };

for (const [label, utterance, params, inCall] of [
  ["한 글자 선택", "네", { call_in_progress: true }, true],
  ["본문 생략", undefined, { call_in_progress: "true" }, true],
  ["공백 본문", "  ", { call_in_progress: { value: true } }, true],
  ["현재 통화 아니요", "네", { call_in_progress: "false" }, false],
  ["이전 통화만 확인", "", { called_before: true }, false],
  ["통화 응답 없음", " ", {}, false],
]) {
  test(`짧은 카카오 응답에서 현재 통화 여부를 먼저 확인한다 · ${label}`, async () => {
    const request = readRequest({ userRequest: { utterance, params } });
    const records = [];
    const response = await handleRequest({ utterance: request.text, parentInputs: request.parentInputs }, {
      ...cfg, signalMetrics: { record: item => records.push(item) },
    });
    const message = response.body.template.outputs[0].simpleText.text;
    if (inCall) {
      assert.ok(message.startsWith("지금 바로 전화를 끊으세요."));
      assert.ok(message.includes("참고용"));
      assert.deepEqual(records.map(item => item.status), ["fast_path"]);
    } else {
      assert.equal(message, "판별할 문자 내용을 붙여 넣어 주세요.");
      assert.equal(records.length, 0);
    }
  });
}

for (const [name, rule] of [["call_in_progress", "R1"], ["called_before", "R2"], ["family_denied", "R5"]]) {
  test(`카카오 확인 입력 ${name}은 감싼 불리언과 문자열을 같이 읽는다`, async () => {
    const utterance = name === "called_before" ? "도서관 일정 library.invalid" : text;
    for (const [value, expected] of [[true, true], ["true", true], [false, false], ["false", false]]) {
      const request = readRequest({ userRequest: { utterance, params: { [name]: { value } } } });
      assert.equal(request.parentInputs[name], expected);
      const records = [];
      const response = await handleRequest({ utterance: request.text, parentInputs: request.parentInputs }, {
        ...cfg, signalMetrics: { record: measurement => records.push(measurement) },
      });
      assert.equal(response.status, 200);
      assert.equal(records.length, 1);
      assert.equal(records[0].rules.includes(rule), expected);
    }
  });
}

test("부모 확인 없이 들어온 발화 추출값은 확인 규칙에 쓰지 않는다", () => {
  const request = readRequest({
    userRequest: { utterance: text },
    action: { params: { called_before: "true" }, detailParams: { family_denied: { value: "true" } } },
  });
  assert.deepEqual(request.parentInputs, {});
});

test("카카오 빠른 응답과 웹 최초 판정에서 문자열 false를 아니요로 처리한다", async () => {
  const kakao = await handleRequest({ utterance: text, parentInputs: { call_in_progress: "false" } }, cfg);
  assert.equal(kakao.status, 200);
  assert.ok(!kakao.body.template.outputs[0].simpleText.text.startsWith("지금 바로 전화를 끊으세요."));
  const web = await handleAnalyze({ text, parentInputs: { family_denied: "false" } }, cfg);
  assert.equal(web.status, 200);
  assert.ok(!web.body.result.fired_rules.includes("R5"));
});
