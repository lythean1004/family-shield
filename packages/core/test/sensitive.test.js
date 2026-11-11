import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasHealthInfo, maskHealth, shouldSkipAiForHealth } from "../src/sensitive.js";
import { analyze } from "../src/pipeline.js";

describe("건강 관련 표현 찾기 (작업 ⑦, 제23조)", () => {
  it("병원·검진·접종·약국·입원 안내를 찾는다", () => {
    for (const t of ["[OO내과] 내일 오전 10시 진료 예약입니다", "건강검진 결과가 나왔습니다", "독감 예방접종 안내",
      "처방전이 약국으로 전송되었습니다", "엄마 나 입원했어", "혈액검사 결과 확인 바랍니다"]) {
      assert.equal(hasHealthInfo(t), true, t);
    }
  });
  it("건강보험(보험료 안내)·암호·일반 문장은 건강정보로 보지 않는다", () => {
    for (const t of ["국민건강보험 보험료 납부 안내", "암호를 입력하세요", "택배 주소 확인 바랍니다", "내일 정신없이 바빠요"]) {
      assert.equal(hasHealthInfo(t), false, t);
    }
  });
});

describe("건강 단어 가리기", () => {
  it("진료과·검사·질환·처방 단어를 [건강정보]로", () => {
    const m = maskHealth("정형외과 MRI 결과 고혈압 약 처방전 확인");
    assert.ok(!/정형외과|MRI|고혈압|처방전/.test(m), m);
    assert.equal((m.match(/\[건강정보\]/g) ?? []).length, 4);
  });
  it("미끼 문맥(병원·입원·검진)은 남겨 AI가 사기 수법을 볼 수 있게", () => {
    assert.equal(maskHealth("엄마 나 입원했어 병원비 보내줘"), "엄마 나 입원했어 병원비 보내줘");
  });
});

describe("AI로 보내지 않을지 결정", () => {
  it("건강 표현 + 요구 신호 없음(진짜 병원 안내로 봄) → AI로 보내지 않음", () => {
    assert.equal(shouldSkipAiForHealth("내일 진료 예약 안내 https://x.invalid", ["SIG_LINK"]), true);
  });
  it("건강 표현 + 요구 신호(돈 등) → 사기 미끼로 보고 AI 사용", () => {
    assert.equal(shouldSkipAiForHealth("진료비 정산이 안 되었습니다", ["SIG_MONEY"]), false);
  });
  it("요구 신호를 코드가 못 찾아도 가족 호칭·금액·송금 같은 사기 미끼가 있으면 AI 사용(TEST-A005)", () => {
    assert.equal(shouldSkipAiForHealth("나 엄마이야. 기기 바꿨어. 새 번호 010-0000-1015. 병원비 90만원 급해.", []), false);
    assert.equal(shouldSkipAiForHealth("엄마 나 입원했어 병원비 보내줘", []), false);
  });
  it("평가 세트의 정상 병원·접종·약국 안내는 AI로 보내지 않는다", () => {
    for (const t of ["[○○병원] 11월 2일 오전 10시 내과 예약 확인됐습니다.", "[○○보건소] 독감 예방접종 안내. 11월 1일부터 예약 가능.",
      "[○○약국] 처방전 조제 완료. 오늘 중 수령 바랍니다.", "[건강보험공단] 건강검진 대상자 안내. 올해 안에 검진 받으세요."]) {
      assert.equal(shouldSkipAiForHealth(t, []), true, t);
    }
  });
  it("영장·체포·압류 같은 법적 위협이 있으면 기관 사칭 미끼로 보고 AI 사용(TEST-B065)", () => {
    assert.equal(shouldSkipAiForHealth("보건소 영장 발부 전 마지막 안내. 010-0000-1055", []), false);
  });
  it("CCTV·CTO 같은 단어 속 CT는 검사명이 아니다(TEST-D2175)", () => {
    assert.equal(hasHealthInfo("[○○경비] CCTV 점검. 내일 오전 10시~12시."), false);
    assert.equal(hasHealthInfo("CT 촬영 결과"), true);
    assert.equal(maskHealth("CCTV 점검, CT검사"), "CCTV 점검, [건강정보]검사");
  });
  it("건강 표현이 없으면 해당 없음", () => {
    assert.equal(shouldSkipAiForHealth("택배 주소 확인", []), false);
  });
});

describe("파이프라인 연결", () => {
  const fakeAi = (seen) => ({
    model: "fake", apiKey: "k", timeoutMs: 1000, promptVersion: "v1",
    fetchImpl: async (_u, opts) => {
      seen.body = JSON.parse(opts.body);
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({
        model: "fake", usage: { prompt_tokens: 1, completion_tokens: 1 },
        choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: { name: "report_signals", arguments: JSON.stringify({
          signals: [], impersonation_type: "none", impersonated_relation: null, evidence_card_ids: [], explanation_for_parent: ["설명"] }) } }] } }],
      }) };
    },
  });

  it("진짜 병원 안내는 AI를 부르지 않고 ai_skipped=health", async () => {
    const seen = {};
    const r = await analyze({ text: "[OO내과] 내일 오전 10시 진료 예약입니다", ai: fakeAi(seen) });
    assert.equal(seen.body, undefined, "AI 호출 없음");
    assert.equal(r.ai_skipped, "health");
    assert.equal(r.fallback_used, true);
  });

  it("요구 신호가 있으면 AI를 부르되 건강 단어는 가린 문장을 보낸다", async () => {
    const seen = {};
    const r = await analyze({ text: "정형외과 MRI 비용 50만원 지금 입금해 주세요", ai: fakeAi(seen) });
    const sent = JSON.stringify(seen.body);
    assert.ok(seen.body, "AI 호출함");
    assert.ok(!sent.includes("정형외과") && !sent.includes("MRI"), "건강 단어는 가림");
    assert.ok(sent.includes("[건강정보]"));
    assert.equal(r.ai_skipped, null);
  });
});
