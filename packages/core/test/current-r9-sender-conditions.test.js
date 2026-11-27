import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_ISOLATION, SIG_PREPAYMENT } from "../src/signals.js";

const fee = "대관 가능한 날짜를 확인한다는 답변을 받았습니다. 거래 상대는 예약 확정 전에 별도로 선납금을 요구했습니다.";
const isolation = "소개로 연결된 상대가 둘만 앉는 공간으로 이동하라고 했습니다. 동행자와 떨어져 있어야 나머지 설명을 해 준다고 했습니다.";

for (const [name, text, signal] of [
  ["예약 확정 전 별도의 선납을 거래 상대가 요구", fee, SIG_PREPAYMENT],
  ["거래 상대가 예약을 접수하기 앞서 추가 입금을 선행 조건으로 밝힘",
    "주말 수선 예약을 접수하기로 문의했습니다. 대화한 상대가 예약 접수에 앞서 따로 사전 납부를 요청했습니다.", SIG_PREPAYMENT],
  ["예약 처리 전에 먼저 별개 선입금을 요구한 수신 보고",
    "좌석 문의에 대한 답신을 받았습니다. 판매자는 예약 처리 전에 추가로 선입금부터 요구했다고 기록했습니다.", SIG_PREPAYMENT],
  ["발신자가 별도 선납 요구를 철회하지 않았다고 명시", fee + " 같은 상대가 그 선납 요구를 철회하지 않았습니다.", SIG_PREPAYMENT],
  ["발신자가 지목한 함께 있을 자리와 동행인의 분리 조건", isolation, SIG_ISOLATION],
  ["직접 발신자는 단둘이 남을 곳으로 이동을 요구하고 동행 분리를 진행에 연결",
    "발신자가 단둘이 머무는 방으로 가라고 말했습니다. 함께 온 사람과 떨어져 있어야 다음 상담을 진행한다고 설명했습니다.", SIG_ISOLATION],
  ["보낸 사람이 단독 조건을 철회하지 않았다고 명시", isolation + " 발신자가 그 조건을 철회하지 않았습니다.", SIG_ISOLATION],
  ["같은 상대만 남는 조건을 수신자가 따르지 않았음",
    "연락한 상대는 둘이서만 이야기하는 곳으로 옮기라고 요청했습니다. 동행인과 떨어져 있어야 다음 말을 한다고 했습니다. 저는 자리를 옮기지 않았습니다.", SIG_ISOLATION],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(result.signals_code.includes(signal));
    assert.equal(result.level, "위험");
    assert.ok(result.fired_rules.includes("R9"));
  });
}

for (const [name, text, unwanted] of [
  ["예약 자체의 공지된 보증금은 별도 선납 요구와 구별",
    "판매자는 예약 확정 전에 공개된 예약 조건에 따라 예약금을 요청했습니다. 공식 수납에서 처리된 예약금입니다.", SIG_PREPAYMENT],
  ["이미 공개된 예약금 항목과 같은 일반 사전 납부", "이미 공개된 예약금 항목을 안내받았습니다. 판매자는 예약 처리 전에 별도로 선입금을 먼저 요구했습니다.", SIG_PREPAYMENT],
  ["정식 수납과 선택한 유료 항목",
    "거래 상대는 예약 확정 뒤 제가 먼저 선택한 추가 항목의 공식 결제를 안내했습니다.", SIG_PREPAYMENT],
  ["발신자가 같은 선납 요구를 철회", fee + " 같은 상대가 그 선납 요구를 철회했습니다.", SIG_PREPAYMENT],
  ["예약과 별개 행동에서 사전 납부", "거래 상대와 예약 처리 전의 절차를 확인했습니다. 별도로 받은 답장에 선납을 요구했다는 기록이 있었어요.", SIG_PREPAYMENT],
  ["수신자가 자기 선납을 먼저 요청", "제가 먼저 예약 처리 전에 별도로 선납을 하겠다고 제안했습니다. 상대는 아직 받지 않겠다고 답했습니다.", SIG_PREPAYMENT],
  ["추가 요금 설명만 전달되고 현재 지급 요구를 부인",
    "판매자는 예약 접수 전에 별도로 선납을 요구한 적은 없다고 답했습니다.", SIG_PREPAYMENT],
  ["따로 보낸 답의 조건은 원래 발신자의 조건이 아님",
    "발신자가 단둘이 있는 공간으로 옮기라고 했습니다. 다른 발신자가 동행인과 떨어져 있어야 다음 상담을 한다고 적었습니다.", SIG_ISOLATION],
  ["자발적 단독 법률 면담과 상담에서 동행인 동석도 가능",
    "제가 먼저 비공개 면담을 신청했습니다. " + isolation + " 원하는 경우 가족과 같이 참여할 수 있다고 확인했습니다.", SIG_ISOLATION],
  ["수신자가 기존 의료 프로그램에서 단독 상담을 스스로 선택",
    "진료 예약에서 제가 먼저 단독 상담을 선택했습니다. " + isolation, SIG_ISOLATION],
  ["같은 발신자가 동행 분리 요구를 철회", isolation + " 발신자가 그 조건을 철회했습니다.", SIG_ISOLATION],
  ["이동과 물리적 분리만 기록됐고 단독 요구 없음",
    "소개로 연결된 사람이 복도 자리로 옮겨 달라고 했습니다. 동행인과 잠시 떨어졌지만 다음 상담을 하는 조건은 아니었습니다.", SIG_ISOLATION],
  ["본인 단독 응시를 스스로 선택한 정상 시험 안내",
    "제가 먼저 단독 시험을 신청했습니다. 기존 시험 안내에서 동행인은 다른 자리에서 기다리고 입실 뒤 확인을 진행한다고 설명했습니다.", SIG_ISOLATION],
  ["동행 분리 조건이 별개 수신 블록에 있음",
    "발신자가 단둘이 앉는 공간으로 가라고 했습니다.\n\n동행인과 떨어져 있어야 다음 설명을 해 준다고 했습니다.", SIG_ISOLATION],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(!result.signals_code.includes(unwanted));
    assert.ok(!result.fired_rules.includes("R9"));
  });
}
