// 2026-11-28: 프롬프트 v4로 놓침은 줄었지만 R6 오경보가 늘었다. 코드에서 거르는 두 장치를 확인한다.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groundAiSignals } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";
import { systemPromptFor } from "../src/ai-client.js";
import {
  SIG_CALL_THIS_NUMBER, SIG_AGENCY_IMPERSONATION, SIG_PERSONAL_INFO, SIG_LINK, SIG_OFFICIAL_LINK, SIG_APP_INSTALL,
} from "../src/signals.js";

describe("전화번호가 없는 문자에서는 AI의 ‘전화 유도’를 뺀다", () => {
  const ai = [SIG_AGENCY_IMPERSONATION, SIG_CALL_THIS_NUMBER];
  it("번호 없음 → 뺀다", () => {
    assert.deepEqual(groundAiSignals("공단 고객센터로 문의 바랍니다", ai), [SIG_AGENCY_IMPERSONATION]);
  });
  for (const text of ["문의 010-0000-0000", "대표번호 1599 0000 으로 전화", "02 000 0000 회신"]) {
    it(`번호 있음 → 둔다: ${text}`, () => assert.deepEqual(groundAiSignals(text, ai), ai));
  }
});

describe("R6는 D49대로 유지한다(공식 주소여도 AI 개인정보 요구는 위험)", () => {
  const code = [SIG_LINK, SIG_OFFICIAL_LINK];
  it("AI 개인정보 요구 + 공식 주소 → 위험(D49, 바꾸려면 운영자 결정 필요)", () => {
    const r = decide({ signals_final: [...code, SIG_AGENCY_IMPERSONATION, SIG_PERSONAL_INFO], signals_code: code });
    assert.equal(r.level, "위험");
  });
  it("코드가 찾은 앱 설치 요구는 그대로 위험이다", () => {
    const c = [...code, SIG_APP_INSTALL];
    const r = decide({ signals_final: [...c, SIG_AGENCY_IMPERSONATION], signals_code: c });
    assert.equal(r.level, "위험");
  });
  it("공식 주소가 아니면 기존처럼 AI 신호도 본다", () => {
    const r = decide({ signals_final: [SIG_LINK, SIG_AGENCY_IMPERSONATION], signals_code: [SIG_LINK] });
    assert.equal(r.level, "위험");
  });
});

it("프롬프트 v5 = v4 + 요구가 아닌 것", () => {
  assert.ok(systemPromptFor("v5").startsWith(systemPromptFor("v4")));
  assert.match(systemPromptFor("v5"), /하지 말라는 말은/);
});
