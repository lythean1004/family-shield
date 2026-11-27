import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

describe("수신 보고에 있는 현재 거래 및 접촉 조건", () => {
  const required = [
    ["가까운 조력자를 자리에서 떼어 놓고 혼자 이어갈 것을 요구", SIG_ISOLATION, "받은 연락은 상담할 때 곁에 있던 사람을 자리에서 보내고 혼자서만 상담을 이어 가도록 요구한 내용이었습니다."],
    ["절차가 끝날 때까지 가까운 사람과의 상의를 미루라는 요구", SIG_ISOLATION, "상대가 보낸 답신을 받았습니다. 절차가 끝날 때까지 가족이나 평소 도움을 주던 사람과의 상의를 뒤로 미루라는 내용이었습니다."],
    ["확정 전 물품 상태의 공개를 선납에 묶음", SIG_PREPAYMENT, "상대에게 받은 쪽지는 거래 전 물품의 상태는 보여 주지 않고, 상대에게 별도 비용을 내야 비로소 실물을 보여 준다는 내용이었습니다."],
    ["기초 조건 설명을 비용 처리 이후로 제한", SIG_PREPAYMENT, "안내를 받았습니다. 약정의 세부 조건 설명은 미리 알 수 없고, 별도 수수료를 보내고 나서야 설명을 들을 수 있다는 내용이었습니다."],
    ["입금 목적지와 계약자 차이가 뒤의 회신에서 확인됨", SIG_THIRD_PARTY_ACCOUNT, "계약 관련 답신을 받았습니다. 수신자에게 비용을 납부하라는 요청이 있었습니다. 비용을 받을 계좌는 계약 업체와 관계없는 사람 명의로 표시되어 있었습니다."],
    ["입금 지시 뒤 거래 당사자와 무관하다는 설명", SIG_THIRD_PARTY_ACCOUNT, "새 답신을 받았습니다. 비용을 제삼자의 개인 명의 계좌로 입금하라는 요구가 있었습니다. 그 예금주는 계약 상대와 무관한 사람이라고 표시됐습니다."],
  ];
  for (const [name, signal, text] of required) {
    it(name, async () => {
      const result = await analyze({text});
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R9"));
      assert.ok(result.signals_code.includes(signal));
    });
  }

  const ordinary = [
    ["상담 공간의 조용한 자리 안내", "상담 안내문을 받았어요. 곁에 있던 사람과도 함께할 수 있고 소리가 작은 자리에서 통화를 이어 가면 됩니다."],
    ["시간이 맞지 않아 스스로 상의를 미룸", "배송 답신을 받은 뒤 제가 먼저 정했습니다. 가족과의 상의는 회의가 끝난 뒤로 미루기로 했어요."],
    ["접근 허용 여부를 먼저 알려준 뒤 대관 예납", "대관 안내가 왔습니다. 사용 가능 여부와 취소 조건을 먼저 설명했고, 확정된 예약의 대관료 일부를 예납합니다."],
    ["납부 뒤 영수증만 공개", "거래의 정식 규정과 물품 상태는 이미 확인했습니다. 대금을 납부하고 나서 영수증을 열람할 수 있다고 안내받았어요."],
    ["계약자 본인 계좌", "계약과 납부 안내를 받았어요. 비용을 납부할 계좌는 계약자 본인의 개인 명의 계좌로 표시되어 있었습니다."],
    ["제삼자 계좌는 설명의 예시", "계약 답신에서 비용을 납부한 사례를 읽었습니다. 별도로 제삼자 개인 계좌의 표기 방식을 예시 자료로 안내했어요."],
    ["업체의 정식 수납 대행사", "업체에 대금 지급 방법을 문의했습니다. 업체와 다른 정식 수납 대행사에 접수한다는 안내가 왔습니다."],
    ["원래 예약 비용을 이미 정산함", "예약 대금의 정산은 이미 마쳤습니다. 납부 뒤 설명을 보여 주는 항목은 그때 기록을 확인한 것뿐입니다."],
    ["비용 없는 문의 절차", "안내를 받았습니다. 물품 상태 확인 전에는 비용을 납부하지 말라는 절차입니다."],
  ];
  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({text});
      assert.notEqual(result.level, "위험");
      assert.ok(!result.fired_rules.includes("R9"));
    });
  }
});