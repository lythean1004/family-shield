import { it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_PERSONAL_INFO } from "../src/signals.js";

const cases = [
  [SIG_PERSONAL_INFO, "요금 담당 발신 역할과 전체 신원정보의 답장 요구",
    "수신 기록 요약: 발신자는 상하수도 요금 담당 팀을 자칭함. 납부와는 관계없이 주민등록번호 전부를 회신에 적으라는 요구가 적혔다고 기록했습니다."],
  [SIG_PERSONAL_INFO, "공공서비스 기관 발신자로 자신을 소개하고 같은 메시지에 회신 요구",
    "신고 메모: 발신자는 공공서비스 상담 담당 부서를 자처함. 안내에 주민등록번호 전체를 답장에 적으라는 요구가 실렸습니다."],
  [SIG_APP_INSTALL, "수신 확인 자료에 명시된 외부 설치 요청",
    "건강보험 접수 부서라고 기재된 알림에는 별도의 외부 프로그램 설치 지시가 있었다고 기록했습니다."],
  [SIG_APP_INSTALL, "공적인 역할을 발신 표시로 사용한 문자와 선택한 새 프로그램 요구",
    "시청 민원 담당이라고 적힌 안내문에 새로운 전용 프로그램 설치 요구가 있었다고 상담에 남겼습니다."],
  [null, "신원 자료가 아닌 발급 여부만 회신",
    "수신 기록: 발신자는 상하수도 요금 담당 팀을 자칭함. 신분증의 발급 여부만 답장에 적으라는 안내가 있었습니다."],
  [null, "다른 연락에서 전달을 요구",
    "수신 기록: 발신자는 상하수도 요금 담당 팀을 자칭함. 그와 별개로 다른 사람이 주민등록번호 전체를 답장에 적으라고 요구했습니다."],
  [null, "수신자가 회신을 요구하는 방향",
    "신고 메모: 발신자는 공공서비스 상담 담당 부서를 자처함. 제가 먼저 상대에게 주민등록번호 전체를 답장에 적으라고 요구했습니다."],
  [null, "공식 사이트에 본인이 정보 확인",
    "수신 기록 요약: 발신자는 상하수도 요금 담당 팀을 자칭함. 공식 사이트에서 본인이 직접 확인하라는 안내가 있었습니다."],
  [null, "새 프로그램이 직원 업무용 기기 대상",
    "건강보험 접수 부서라고 기재된 알림에는 직원 업무용 기기에 새 전용 프로그램을 설치하라는 공지가 적혔습니다."],
  [null, "외부 소프트웨어 설치가 있는지 문의",
    "시청 민원 담당이라고 적힌 안내문에 새 전용 프로그램 설치 요구가 있는지 제가 물었다고 신고에 기록했습니다."],
  [null, "권고 또는 선택",
    "시청 민원 담당이라고 적힌 안내문에서 전용 앱 설치는 선택 사항이라고 적었습니다."],
  [null, "설치 요구가 철회됨",
    "시청 민원 담당이라고 적힌 안내문에 새 전용 프로그램 설치 요구가 있었다고 기록했습니다. 그 요구는 철회됐습니다."],
  [null, "예방 사례에 담긴 설치 문구",
    "예방 교육 자료에서 시청 민원 담당이라고 적힌 안내문의 새 전용 프로그램 설치 요구 예시를 읽었습니다."],
];
for (const [signal,name,text] of cases) it(name, async () => {
  const checked = await analyze({text});
  assert.equal(checked.fired_rules.includes("R6"),Boolean(signal));
  if(signal) assert.ok(checked.signals_code.includes(signal));
});

it("로컬 설치 신호로 기존 건강정보 처리 경로가 바뀌지 않음", () => {
  const text = "건강보험 검진 담당이라고 적힌 안내문에 새 전용 프로그램 설치 요구가 있었다고 신고했습니다.";
  const result = extractCodeSignals(text);
  assert.ok(result.signals.includes(SIG_AGENCY_IMPERSONATION));
  assert.ok(!result.healthRoutingSignals?.includes(SIG_AGENCY_IMPERSONATION));
});
