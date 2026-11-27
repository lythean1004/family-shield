import test from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";

const call = "신고인: 지방 세무서 직원이라고 소개한 사람과 먼저 통화했습니다.";
const plainInstallSummary =
  "신고인: 뒤이어 받은 알림에는 발신자가 지정한 소프트웨어를 수신자 기기에 설치하도록 쓰여 있었습니다.";

test("신고인이 옮겨 적은 같은 연락의 지정 앱 설치는 R6으로 확인", async () => {
  const result = await analyze({ text: call + "\n" + plainInstallSummary });
  assert.equal(result.level, "위험");
  assert.deepEqual(result.fired_rules, ["R6"]);
  assert.deepEqual(result.signals_code, ["SIG_AGENCY_IMPERSONATION", "SIG_APP_INSTALL"]);
});

test("문서에 제시된 미확인 주소가 이용 요구의 목적지인 경우", async () => {
  const text = "공공기관의 민원 접수를 담당했다고 밝힌 발신자가 문자에 실린 https://receipt-check.invalid 링크로 접수 절차를 진행하라고 했다고 신고인이 적었습니다.";
  const result = await analyze({ text });
  assert.equal(result.level, "위험");
  assert.ok(result.fired_rules.includes("R6"));
  assert.ok(!result.fired_rules.includes("R2"));
  assert.deepEqual(result.domains, ["receipt-check.invalid"]);
  const markedAsCalledBefore = await analyze({ text, parentInputs: { called_before: true } });
  assert.ok(markedAsCalledBefore.fired_rules.includes("R2"));
});

for (const [label, text] of [
  ["다른 서술자", call + "\n" + plainInstallSummary.replace("신고인:", "기록자:")],
  ["별개 발신 건을 보고", call + "\n" + plainInstallSummary.replace("뒤이어 받은", "한편 별도로 받은")],
  ["설치 요건을 부정", call + "\n신고인: 뒤이어 받은 알림에는 발신자가 지정한 소프트웨어를 수신자 기기에 설치하라는 뜻은 아니었다고 기록했습니다."],
  ["설치 필요 여부만 질문", call + "\n신고인: 뒤이어 받은 알림을 보고 발신자가 지정한 소프트웨어를 수신자 기기에 설치해야 하는지 문의했습니다."],
  ["같은 서술자가 적은 명시적 요구 철회", call + "\n" + plainInstallSummary + "\n신고인: 해당 설치 요청은 이미 취소됐습니다."],
  ["뒤이은 알림에서 다른 발신자를 명시", call + "\n" + plainInstallSummary.replace("발신자가", "다른 발신자가")],
  ["과거 요구의 철회", call + "\n" + plainInstallSummary + "\n해당 설치 요청은 이미 취소됐습니다."],
  ["본문 외에 따로 제시한 기록용 주소", "공공기관의 민원 접수를 담당했다고 밝힌 발신자가 있습니다. 주소 https://receipt-check.invalid 은 제 메모에서 따로 참고합니다."],
  ["본문 주소 이용 요청을 부정", "공공기관의 민원 접수를 담당했다고 밝힌 발신자가 문자에 실린 https://receipt-check.invalid 링크로 접수 절차를 진행하라는 뜻은 아니었다고 밝혔습니다."],
]) {
  test("기관 사칭 신호를 더하지 않는 경우 - " + label, () => {
    assert.ok(!extractCodeSignals(text).signals.includes("SIG_AGENCY_IMPERSONATION"));
  });
}