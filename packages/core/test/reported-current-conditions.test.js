import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_DELETE_APP, SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

describe("수신자가 옮겨 적은 강제 조건", () => {
  const requests = [
    ["연락을 끊은 뒤 혼자 응대하라는 요구", SIG_ISOLATION, "받은 쪽지의 내용에 따르면 주변과의 연락을 끊고 혼자서만 답하라는 요구가 이어졌습니다."],
    ["수신자의 미실행과 발신자의 단절 요구를 구별", SIG_ISOLATION, "답장에 주변 사람과의 의논을 끊고 혼자 처리하라는 내용이 있었지만 저는 따르지 않았습니다."],
    ["기기를 보호하는 기능을 먼저 없애라는 요구", SIG_DELETE_APP, "답신에 휴대폰을 보호해 주는 앱부터 지워야 상담을 이어 간다고 적혀 있었습니다."],
    ["삭제가 요청이며 사용자는 실행하지 않음", SIG_DELETE_APP, "받은 회신에는 제 기기를 보호하는 앱부터 삭제하라는 요구가 담겨 있었지만 저는 실행하지 않았습니다."],
    ["예약 가능 여부를 알려주기 전의 별도 비용", SIG_PREPAYMENT, "별도 보증금을 입금하고 나서야 물건의 예약 가능 여부를 알려준다는 안내를 받았습니다."],
    ["거래 당사자와 별개인 직원의 계좌로 수취", SIG_THIRD_PARTY_ACCOUNT, "제가 거래하는 상대와 별개인 곳이 수납을 맡았다는 답변입니다. 그쪽 직원 명의 계좌로 받겠다고 적혀 있었습니다."],
  ];

  for (const [name, signal, text] of requests) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R9"));
      assert.ok(result.signals_code.includes(signal));
    });
  }

  const ordinary = [
    ["수신자 스스로 결정한 차단", "연락을 끊겠다는 요청은 제가 먼저 보냈습니다. 상대에게 그 뜻만 전달했습니다."],
    ["일시적인 연락 중단과 업무 기록", "퇴근 때 가까운 동료와 연락을 끊고 혼자서 기록을 정리했다고 업무 일지에 적었습니다."],
    ["가해자만 차단", "상담 안내에서는 지인 전체와의 연락이 아니라 가해자 번호만 차단하는 방법을 설명했습니다."],
    ["예방 교육에서 소개한 요구", "사기 예방 교육 자료에 주변과의 연락을 끊고 혼자 답하라는 유형의 피해를 소개했습니다."],
    ["보호 앱을 삭제한 기록의 보관", "보호 앱부터 삭제한 기록을 보관하라는 전산실 메시지를 받았어요."],
    ["업무용 기기의 교체", "업무용 기기 정기 교체 안내가 왔습니다. 백신 앱부터 삭제하라는 내부 전산 작업 안내입니다."],
    ["대여 단말기 반납 조건", "대여 기기 반납 절차 안내를 받았습니다. 임대 관리 프로그램을 지운 뒤 담당자가 반납을 처리합니다."],
    ["앱 삭제 요구 철회", "보호 앱부터 삭제하라는 요구는 취소됐다는 회신을 받았고 보안 설정은 그대로입니다."],
    ["확정된 예약과 영수증", "이미 확정된 예약의 요금을 납부하고 나서 영수증만 열람할 수 있다는 안내를 받았습니다."],
    ["이미 마친 정산의 기록", "거래는 이미 끝났습니다. 당시 수수료를 따로 지불하고 나서 환급 내역을 확인했다는 메모만 보관합니다."],
    ["선택한 항목의 공식 입금처", "신청 가능 여부를 확인했고, 제가 택한 수강 과정의 접수비는 등록된 수납 대행사를 통해 납부한다고 안내받았습니다."],
    ["환불 받을 계좌와 결제 계좌 구별", "거래처의 공식 결제 계좌와 환불받을 제 명의 계좌는 다르다고 안내받았습니다."],
    ["정식 중개에 등록된 수납 주체", "거래 당사자와 별개인 업체가 공인 수납을 맡았다는 답변입니다. 그쪽 직원 명의 계좌로 받겠다는 말은 실제로 없었습니다."],
  ];

  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.notEqual(result.level, "위험");
      assert.ok(!result.fired_rules.includes("R9"));
    });
  }
});