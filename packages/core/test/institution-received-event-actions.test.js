import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER, SIG_LINK, SIG_PERSONAL_INFO } from "../src/signals.js";

describe("같은 수신 연락에 속한 기관 역할과 행동", () => {
  const requests = [
    ["발신 역할과 뒤에 적은 같은 문자의 주소", SIG_LINK,
      "군청 민원 담당자라는 쪽에서 접수 안내를 보냈다고 상담에 옮겼습니다. 받은 문자에 적힌 주소는 https://claim-note.invalid/view 이었습니다."],
    ["민감 항목을 문자 답장으로 내라는 요구", SIG_PERSONAL_INFO,
      "세무서 민원 담당이라고 소개한 사람이 제게 연락했습니다. 신원 자료 중 주민등록번호를 문자로 답하라는 요구를 받았다고 기록했습니다."],
    ["조회 조건인 수신자 설치", SIG_APP_INSTALL,
      "시청 전산 담당자라며 신청 현황을 확인하라고 연락했어요. 신청 내역을 보려면 안내받은 프로그램을 설치해야 한다는 요구가 적혔습니다."],
    ["회신 요구를 먼저 기록하고 같은 절에서 발신자의 역할을 밝힘", SIG_PERSONAL_INFO,
      "받은 연락에서 주민등록번호를 문자로 답하라고 요청한 사람이 세무서 민원 담당자라고 밝혔습니다."],
    ["수신 문자와 숫자가 있는 콜백 명령", SIG_CALL_THIS_NUMBER,
      "공공기관 민원 업무 담당을 자처한 문자에 관한 수신 기록입니다. 본문에 적힌 000-0000-1234로 연락하라는 요구가 있었습니다."],
  ];
  for (const [name, signal, text] of requests) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(SIG_AGENCY_IMPERSONATION));
      assert.ok(result.signals_code.includes(signal));
      assert.ok(result.fired_rules.includes("R6"));
    });
  }

  const controls = [
    ["공식 주소의 일반 조회", "시청 담당자라는 쪽에서 접수 안내를 보냈다고 상담에 옮겼습니다. 문자에 적힌 주소는 https://www.gov.kr/ 이었습니다."],
    ["기관 문자와 별개인 모임의 주소", "시청 전산 담당이라며 접수 날짜를 알려 왔습니다. 그와 별개로 모임 담당자가 받은 링크는 https://claim-note.invalid/view 입니다."],
    ["제삼자를 기관 직원으로 소개한 문자", "이웃을 시청 전산 담당자라고 소개한 문자에 관한 수신 기록입니다. 문자에 적힌 주소는 https://claim-note.invalid/view 이었습니다."],
    ["기관 연락을 받았다는 사람의 별도 알림", "시청 직원에게 연락을 받았다는 지인이 자기 모임 알림에 일반 링크 https://claim-note.invalid/view 를 붙였습니다."],
    ["기관 명의와 일반 문의 번호", "공공기관 민원 업무 담당을 자처한 문자에 관한 수신 기록입니다. 문의할 경우 참고 번호 000-0000-1234를 적어 두었다는 내용입니다."],
    ["신분 확인은 창구에서 본인이 직접 함", "세무서 담당이라고 소개한 사람이 말을 남겼습니다. 문자로 주민등록번호를 답하지 말고 기존 창구에서 본인이 확인하라고 했습니다."],
    ["직원 기기의 설치", "시청 전산 담당자라며 안내를 보냈습니다. 안내를 진행하려면 담당 직원의 업무용 기기에 새 프로그램을 설치해야 한다는 메모를 받았습니다."],
    ["받았던 실제 요청이 철회됨", "세무서 담당이라고 소개한 사람이 연락했습니다. 주민등록번호를 문자로 답하라는 요구를 받았습니다. 그 요구는 철회됐습니다."],
    ["별개라는 말이 없어도 지인이 주체인 설치", "시청 전산 담당자라며 접수 날짜를 알려 주겠다고 연락했습니다. 지인이 자기 모임에 참여하려면 프로그램을 설치해야 한다는 요구를 받았다고 말했습니다."],
    ["수신자가 먼저 접수 연락을 요청함", "은행 담당자라는 쪽에서 연락을 받았습니다. 제가 먼저 전화 연결을 요청했고 000-0000-1234로 전화하라는 요구를 제 문장으로 옮겨 적었다고 설명했습니다."],
    ["독립된 새로운 연락은 같은 발신자가 아님", "세무서 담당자라는 쪽에서 연락이 왔습니다. 그와 별개로 다른 업체가 주민등록번호를 문자로 답하라고 명시했습니다."],
  ];
  for (const [name, text] of controls) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(!result.fired_rules.includes("R6"));
    });
  }

  it("현지 보고 신호와 건강정보 전송 판단을 구분", () => {
    const result = extractCodeSignals("시청 담당자라며 검진 일정을 안내한다고 연락했습니다. 받은 문자에서 주민등록번호를 문자로 답하라는 요구가 있었습니다.");
    assert.ok(result.signals.includes(SIG_AGENCY_IMPERSONATION));
    assert.ok(result.signals.includes(SIG_PERSONAL_INFO));
    assert.ok(result.healthRoutingSignals);
    assert.ok(!result.healthRoutingSignals.includes(SIG_AGENCY_IMPERSONATION));
    assert.ok(!result.healthRoutingSignals.includes(SIG_PERSONAL_INFO));
  });
});
