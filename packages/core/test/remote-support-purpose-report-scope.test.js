import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, MAX_INPUT_CHARS } from "../src/pipeline.js";
import { SIG_CREDENTIAL_DISCLOSURE } from "../src/signals.js";

const relay = "원격 지원을 제안한 메시지에서 제 화면에 표시된 원격 접속용 일회성 코드를 발신자에게 전송하라는 지시가 있었습니다.";
const existingRelay = "상담원이 원격 지원 화면에 표시된 일회용 연결 코드를 자신에게 채팅으로 전달하라고 요구했습니다.";

export const purposeReportControls = [
  { label: "발급된 값의 용도와 전달 상대가 묶인 보고", text: relay, expected: true },
  { label: "명시적으로 같은 값의 미전달을 덧붙인 보고",
    text: relay + " 저는 그 코드를 보내지 않았습니다.", expected: true },
  { label: "수신자가 보내지 못한 개인 결과만 명시",
    text: relay + "\n저는 그 번호를 전달하지 못했습니다.", expected: true },
  { label: "허구의 발화라고 앞에서 출처를 한정",
    text: "낭독회에서 읽은 창작물의 한 장면입니다. " + relay, expected: false },
  { label: "수신 당사자와 다른 사람이 옮긴 기록",
    text: "제가 받은 것이 아니라 이웃의 기록을 옮겼습니다. " + relay, expected: false },
  { label: "발신자의 후속 상태인 요청 철회",
    text: relay + " 같은 상담 담당자가 지시를 거두었습니다.", expected: false },
  { label: "다른 발신자와 나눈 별개 연락",
    text: relay + " 별도 직원에게서는 점검 일정을 받았습니다.", expected: false },
  { label: "미전달 한 문장으로 뒤의 정정이 가려지지 않음",
    text: relay + " 저는 값을 전하지 않았습니다. 나중에 전체 상황이 예행연습이었다고 정정했습니다.", expected: false },
  { label: "후속 요청 부재와 수신자 미전달은 다름",
    text: relay + " 제가 전달 요구를 받은 것은 아니었습니다.", expected: false },
  { label: "요청 본문이 들어 있어도 뒷부분을 잃은 입력",
    text: relay.padEnd(MAX_INPUT_CHARS, " ") + "그 지시가 실제 있었는지는 알 수 없었습니다.", expected: false, truncated: true },
  { label: "발급이 아직 가정인 안내",
    text: "원격 지원을 제안한 메시지에서 제 화면에 오는 일회용 원격지원용 값을 발신자에게 보내라는 지시가 있었습니다.", expected: false },
  { label: "먼저 신청했던 수리는 기존 연결 코드 전달 판정까지 없애지 않음",
    text: "제가 자료 검토용 장비의 원격 수리를 미리 신청했습니다. " + existingRelay, expected: true },
  { label: "기존 표시 연결 코드 전달은 여러 절의 기존 근거로 유지",
    text: "받은 연락을 기록했습니다. " + existingRelay, expected: true },
  { label: "새 문형이 보류되어도 다른 절의 기존 전달 근거는 유지",
    text: relay + " " + existingRelay, expected: true },
];

for (const { label, text, expected, truncated } of purposeReportControls) test(label, async () => {
  const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
  assert.equal(result.fired_rules.includes("R16"), expected);
  assert.equal(result.signals_code.includes(SIG_CREDENTIAL_DISCLOSURE), expected);
  if (expected) assert.equal(result.level, "위험");
  if (truncated) assert.equal(result.truncated, true);
});
