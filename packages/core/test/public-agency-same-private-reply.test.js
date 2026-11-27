import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_PERSONAL_INFO } from "../src/signals.js";

const source = "공공기관을 자처한 발신자가 ";
const demand = "같은 메시지의 답장에 개인정보를 적으라고 했습니다.";
const cases = [
  [true, "개인정보를 본래 메시지의 답장에 기재", source + demand],
  [true, "수신문에 표시된 발신 역할과 회신 자료", "행정기관을 자칭한 문자에서 본인 확인을 위해 여권 사본을 그 문자에 회신으로 첨부하라고 했습니다."],
  [true, "보낸 사람의 표기와 수신자의 자료 전송", "복지 기관을 자처한 한 발신자가 수신자에게 해당 문자의 회신란에 신분증 사진을 첨부하라고 요청했습니다."],
  [false, "기관을 언급했으나 본인 소속이라고 주장하지 않음", "복지 기관을 내세운 한 발신자가 수신자에게 해당 문자의 회신란에 신분증 사진을 첨부하라고 요청했습니다."],
  [false, "개인정보 처리방침 확인", source + "같은 메시지의 답장에서 개인정보처리방침을 확인하라고 했습니다."],
  [false, "동의나 가림만 요청", source + "같은 메시지의 답장에 개인정보를 가리라고 했습니다."],
  [false, "개인정보 처리에 동의만 요청", source + "같은 메시지의 답장에서 개인정보 처리에 동의하라고 했습니다."],
  [false, "삭제를 요청", source + "같은 메시지의 답장에서 개인정보를 삭제하라고 했습니다."],
  [false, "제삼자만 받는 요청", source + "다른 수신자에게만 같은 메시지의 답장에 개인정보를 적으라고 했습니다."],
  [false, "다른 서류만 요청", source + "같은 메시지의 답장에 참석 확인서를 첨부하라고 했습니다."],
  [false, "공식 홈페이지에 자기 입력", source + "공식 홈페이지 https://www.hometax.go.kr/ 에서 개인정보를 제가 직접 입력하라고 했습니다."],
  [false, "수신자가 먼저 제안", "제가 먼저 개인정보를 답장에 쓰겠다고 제안했습니다. " + source + demand],
  [false, "요구 나중에 철회", source + demand + " 발신자가 그 회신 요구를 철회했습니다."],
  [false, "그런 요구를 한 적이 없음", source + "같은 메시지의 답장에 개인정보를 적으라고 한 적이 없다고 했습니다."],
  [false, "가상 예문", "가상 예문을 읽었습니다. " + source + demand],
  [false, "원래 화자와 다른 주체가 개인정보 회신을 요구", source + "다른 직원이 급여 확인을 이유로 같은 메시지의 답장에 개인정보를 적으라고 했습니다."],
  [false, "뒤 문장에서 앞서 옮긴 발신 역할을 부정", source + demand + " 그 발신자가 기관을 자처한 사실은 없다고 정정했습니다."],
  [false, "분리된 다른 메시지", source + "다른 메시지의 답장에 개인정보를 적으라고 했습니다."],
  [false, "기존 공공 역할 이외에는 새 회신 조건을 확장하지 않음", "지원금 지급 기관을 자처한 문자에서 " + demand],
  [false, "임의 기관 확대 없음", "일반 업체를 자처한 발신자가 " + demand],
];
for (const [expected, title, text] of cases) {
  test(title, async () => {
    const result = await analyze({ text });
    assert.equal(result.fired_rules.includes("R6"), expected);
    if (expected) assert.equal(result.signals_code.includes(SIG_PERSONAL_INFO), true);
  });
}

test("잘린 보고로 발신 명의와 응답 의무를 추론하지 않음", () => {
  const result = extractCodeSignals(source + demand, { inputComplete: false });
  assert.equal(result.signals.includes(SIG_PERSONAL_INFO), false);
});
