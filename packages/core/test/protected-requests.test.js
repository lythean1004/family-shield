import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";
import { AI_ALLOWED_SIGNALS, codeOnlyFrom } from "../src/signals.js";

const secret = "SIG_CREDENTIAL_DISCLOSURE";
const external = "https://form.invalid/";
describe("D53 남에게 인증값 전달 또는 미확인 양식에 금융 비밀 입력", () => {
  for (const text of [
    "분류 연습 / 결제 인증번호만 나한테 보내 줘.",
    "문법 연습 / 원격지원 코드를 담당자에게 알려 주세요.",
    "모의 휴대폰 개통 / 본인확인 문자가 도착할 거야. 숫자 오면 바로 나한테 보내 줘.",
    "연습 항목 / 인증번호가 발송됐어. 여섯 자리 숫자가 갔을 거야. 그거 그대로 알려 줘.",
    "양식 견본 / 지갑 복구 문구(열두 단어) 입력 후 등록 " + external,
    "양식 견본 / 보안카드 번호 전체 입력하면 확인됩니다. " + external,
  ]) it(text, async () => {
    const r = await analyze({ text });
    assert.equal(r.level, "위험");
    assert.ok(r.signals_code.includes(secret) && r.fired_rules.includes("R16"));
    assert.match(r.summary, /인증|비밀/);
  });
  for (const text of [
    "본인 기기의 공식 앱에서 일회용 인증번호를 직접 입력하세요.",
    "타인에게 결제 인증번호를 보내 주지 마세요.",
    "인증번호를 입력했어. 이따가 사진을 보내 줘.",
    "인증번호가 도착했어. 저녁 식사 사진이 있지? 그거 그대로 보내 줘.",
    "본인확인 문자를 직접 입력했어. 전시 입장권은 따로 왔지? 그 번호를 알려 줘.",
    "택배 보관함 번호가 도착했어. 숫자 오면 나한테 보내 줘.",
    "보안 교육 / ‘원격지원 코드를 알려 주세요’라는 말을 들으면 통화를 끊으세요.",
    "연습 / 지갑 복구 문구는 종이에 보관하세요. 교육 자료 " + external,
    "지갑 복구 문구 입력 후 등록 https://www.gov.kr/ . 전시 안내 " + external,
    "지갑 복구 문구를 입력하지 마세요. " + external,
  ]) it(text, async () => assert.ok(!(await analyze({ text })).fired_rules.includes("R16")));
  it("AI가 단독으로 제시할 수 없는 신호로 영수증에 남긴다", () => {
    assert.ok(!AI_ALLOWED_SIGNALS.has(secret));
    assert.deepEqual(codeOnlyFrom([secret]), [secret]);
    assert.ok(!decide({ signals_final: [secret], signals_code: [] }).fired_rules.includes("R16"));
  });
});
