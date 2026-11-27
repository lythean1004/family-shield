import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";
import {
  SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_LINK, SIG_PERSONAL_INFO, SIG_SB_UNSAFE_URL,
} from "../src/signals.js";

const claim = "검찰청 수사관을 자처한 사람에게 연락을 받았습니다.";
const request = "같은 발신자가 제 신분증 사본을 답장으로 제출하라고 요구했다는 수신 보고입니다.";
const current = claim + " " + request;
const personal = [SIG_AGENCY_IMPERSONATION, SIG_PERSONAL_INFO];
const separated = claim + " 그와 별개로 다른 발신자가 제 신분증 사본을 답장으로 제출하라고 요구했다는 수신 보고입니다.";
const otherRecipient = claim + " 발신자는 다른 참가자에게만 신분증 사본을 답장으로 제출하라고 요구했다는 수신 보고입니다.";
const withdrawn = current + " 발신자가 그 요구를 철회했습니다.";

for (const [name, text] of [
  ["기관 주장과 민감 정보 요구의 발신처가 별개", separated],
  ["발신자가 직전에 한 요구를 명시적으로 철회", withdrawn],
  ["기관 발신자가 다른 수신자 한 명만 지목", otherRecipient],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.deepEqual(result.signals_code, personal);
    assert.deepEqual(result.fired_rules, ["R7"]);
    assert.equal(result.level, "주의");
  });
}

for (const [name, text] of [
  ["같은 기관 발신자가 수신자에게 실제로 자료 요구", current],
  ["수신자의 미이행과 기존 요구", current + " 저는 그 요구를 아직 이행하지 않았습니다."],
  ["수신자가 거절해도 발신자는 요구 유지", current + " 제가 그 요구를 거절했습니다. 발신자가 같은 요구를 거듭했다고 기록했습니다."],
  ["발신자가 철회하지 않았다고 명시", current + " 발신자가 그 요구를 철회하지 않았습니다."],
  ["다른 사람은 집행담당자이고 요청 대상은 수신자", current + " 다른 사람은 같은 발신자의 요청을 기록했습니다."],
  ["별개 사건에도 기관 발신과 수신자 행동 요구가 모두 존재", separated + " 다른 발신자가 검찰청 수사관을 자처했습니다. " + request],
  ["별개 발신 뒤 처음 발신자가 수신자에게 요구", separated + " 처음 발신자가 제 신분증 사본을 제출하라고 요구했다는 수신 보고입니다."],
  ["별개 주제여도 같은 발신자임을 명시", claim + " 그와 별개로 같은 발신자가 제 신분증 사본을 제출하라고 요구했다는 수신 보고입니다."],
  ["같은 사건에서 다른 수신자에게만 한 요구 뒤 자신에게 한 요구도 존재", otherRecipient + " " + request],
  ["철회 뒤에 다시 수신자에게 같은 행동을 요구함", withdrawn + " " + request],
  ["다른 수신자도 포함했지만 그 사람만 지목하지 않음", claim + " 발신자는 다른 참가자에게도 신분증 사본을 답장으로 제출하라고 요구했다는 수신 보고입니다."],
  ["어느 선행 요청을 철회한 것인지 모호함", current + " " + request + " 발신자가 그 요구를 철회했습니다."],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.level, "위험");
    assert.ok(result.fired_rules.includes("R6"));
  });
}

test("R6 범위 제한은 R1과 R5의 별도 위험을 낮추지 않는다", async () => {
  const result = await analyze({ text: separated, parentInputs: { call_in_progress: true, family_denied: true } });
  assert.deepEqual(result.fired_rules, ["R1", "R5", "R7"]);
  assert.equal(result.level, "위험");
});

test("R6 범위 제한은 다른 출처의 평판 경고와 받은 전화 뒤 링크를 계속 평가한다", async () => {
  const text = claim + " 그와 별개로 다른 발신자에게서 합성 주소 case.invalid가 든 안내를 받았다고 기록했습니다.";
  const result = await analyze({ text, parentInputs: { called_before: true },
    urlReputation: async domains => ({ ok: true, malicious: domains, sources: { safe_browsing: domains } }),
  });
  assert.ok(result.signals_code.includes(SIG_LINK));
  assert.ok(result.signals_code.includes(SIG_SB_UNSAFE_URL));
  assert.deepEqual(result.fired_rules, ["R2", "R10", "R7"]);
  assert.equal(result.level, "위험");
});

test("기관의 공식 링크와 다른 발신자의 미등록 링크를 한 근거로 결합하지 않는다", async () => {
  const text = claim + " 같은 발신자가 공식 주소 https://www.hometax.go.kr 를 안내했다는 기록입니다. 다른 발신자가 합성 주소 case.invalid가 든 안내를 보냈다고 별도로 기록했습니다.";
  const result = await analyze({ text, ai: null });
  assert.ok(result.signals_code.includes(SIG_AGENCY_IMPERSONATION));
  assert.ok(result.signals_code.includes(SIG_LINK));
  assert.ok(!result.signals_code.includes("SIG_OFFICIAL_LINK"));
  assert.deepEqual(result.fired_rules, ["R7"]);
});

function fakeAi(signals) {
  return {
    model: "fixture", apiKey: "fixture",
    fetchImpl: async () => ({
      ok: true, status: 200, json: async () => ({
        choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: {
          name: "report_signals",
          arguments: JSON.stringify({ signals, impersonation_type: "agency",
            impersonated_relation: null, evidence_card_ids: [], explanation_for_parent: [] }),
        } }] } }],
      }),
    }),
  };
}

test("AI가 분리된 기존 행동을 반복하면 보류하고 새 행동을 찾으면 R6를 평가한다", async () => {
  const duplicate = await analyze({ text: separated, ai: fakeAi(personal) });
  assert.equal(duplicate.fallback_used, false);
  assert.deepEqual(duplicate.signals_ai, personal);
  assert.deepEqual(duplicate.fired_rules, ["R7"]);

  const extra = await analyze({ text: separated, ai: fakeAi([...personal, SIG_APP_INSTALL]) });
  assert.equal(extra.fallback_used, false);
  assert.ok(extra.signals_ai.includes(SIG_APP_INSTALL));
  assert.deepEqual(extra.fired_rules, ["R6", "R7"]);
  assert.equal(extra.level, "위험");
});

test("기존 결정 API와 잘린 입력은 범위 보류 근거가 없을 때 R6를 평가한다", () => {
  assert.deepEqual(decide({ signals_final: personal }).fired_rules, ["R6", "R7"]);
  const code = extractCodeSignals(separated, { inputComplete: false });
  assert.equal(code.unlinkedAgencyActions, undefined);
  assert.deepEqual(decide({ signals_final: code.signals, signals_code: code.signals }).fired_rules, ["R6", "R7"]);
});

test("일상적인 건강 안내는 분리된 수신 사건과 함께 있어도 설명을 보내지 않는다", async () => {
  const text = "병원에서 정기 검진 결과를 받았습니다. 그와 별개로 다른 발신자에게서 산책 시간 안내를 받았습니다.";
  let requests = 0;
  const result = await analyze({ text, ai: {
    model: "fixture", apiKey: "fixture", fetchImpl: async () => { requests++; throw Error("offline fixture"); },
  } });
  assert.equal(result.ai_skipped, "health");
  assert.equal(requests, 0);
});
