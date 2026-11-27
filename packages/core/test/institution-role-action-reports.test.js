import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_PERSONAL_INFO } from "../src/signals.js";

describe("수신 보고의 기관 역할과 설치·회신 대상", () => {
  const requests = [
    ["기관 업무를 자칭한 발신자와 신분 서류를 보내는 답장", SIG_PERSONAL_INFO,
      "공공기관 업무를 담당하는 부서라고 자신을 소개했습니다. 메시지 답변에 수신자의 주민등록증 사본을 첨부해 달라고 요청했다고 기록했습니다."],
    ["역할 소개와 문자 답장에 신분증을 첨부하라는 요구", SIG_PERSONAL_INFO,
      "건강 보험 업무 담당 기관이라고 자신들을 설명했고 문자 답변에 제 신분증 사본을 보내 달라고 요구했습니다."],
    ["공식 서비스 담당 표기와 수신자 기기의 설치 의무", SIG_APP_INSTALL,
      "교통범칙금 담당 팀에서 통지했다고 기록했습니다. 조회 전 발신자가 지정한 프로그램을 수신자의 기기에 먼저 설치해야 한다고 요구했습니다."],
    ["담당 부서가 내세운 가입 앱과 개인 기기", SIG_APP_INSTALL,
      "교통 범칙금 처리 담당 부서에서 연락했다고 설명했습니다. 이용 전에 상대가 알려 준 앱을 제 휴대폰에 설치하도록 안내받았습니다."],
  ];
  for (const [name, signal, text] of requests) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(SIG_AGENCY_IMPERSONATION));
      assert.ok(result.signals_code.includes(signal));
      assert.ok(result.fired_rules.includes("R6"));
    });
  }

  const ordinary = [
    ["건강보험은 문의 주제만", "지역 모임의 안내라고 했습니다. 건강보험 관련 문의를 받은 기록에서 문자 답변으로 자료를 보내야 하는지 물었다고만 적었습니다."],
    ["개인 기기에서 직접 본인 확인", "공공기관 업무를 담당하는 부서라고 자신을 소개했습니다. 본인 기기의 공식 앱에서 신분증 정보가 맞는지만 직접 확인하라고 설명했습니다."],
    ["공식 신청 창구의 대면 지참", "건강보험 업무를 담당하는 부서라고 안내했습니다. 신분증 사본은 기존 창구에 방문할 때 지참하라는 확인 사항이었습니다."],
    ["대신 회신하는 것이 다른 자료", "공공기관 업무를 담당하는 부서라고 자신을 소개했습니다. 신분증을 확인한 뒤 문자 답변에 행사 시간표만 붙여 달라는 요청을 받았습니다."],
    ["별개의 발신자가 문자 회신을 요구함", "공공기관 업무를 담당하는 부서라고 자신을 소개했습니다. 그와 별개로 다른 발신자가 문자 답변에 신분증 사본을 붙여 달라고 요청했습니다."],
    ["직원 기기에만 설치", "교통범칙금 담당 부서에서 통지했다고 했습니다. 해당 팀이 소개한 프로그램은 직원용 기기에만 설치하도록 요청했습니다."],
    ["수신자가 공식 앱을 자발적으로 사용", "교통범칙금 담당 팀에서 알렸다고 기록했습니다. 평소 제 휴대폰에서 쓰던 공식 앱의 조회 화면을 소개할 뿐 추가 설치는 필요 없다고 했습니다."],
    ["설치가 문의 사항에 불과함", "교통범칙금 담당 부서에서 연락했다고 했습니다. 발신자가 소개한 앱을 제 휴대전화에 설치해야 하는지 제가 먼저 문의했습니다."],
    ["다른 발신자의 앱 설치 내용", "교통범칙금 담당 팀에서 통지했다고 했습니다. 그와 별개로 다른 발신자가 본인이 소개한 앱을 수신자의 휴대전화에 설치해야 한다고 말했습니다."],
  ];
  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(!result.fired_rules.includes("R6"));
    });
  }
});
