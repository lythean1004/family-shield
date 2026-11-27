import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_DELETE_APP, SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

for (const [name, text] of [
  ["approval precedes the charge", "시설 접수 안내를 받았습니다. 대여 가능 여부 확인 전에는 비용을 받지 않고, 승인 다음에만 납부할 예정이라고 적혔습니다."],
  ["the company account is the actual payment route", "업체 안내문에 개인 계좌와 법인 계좌는 수취인이 다르다고 적혀 있고 이 계약의 대금은 회사가 쓰는 법인 계좌로 납부한다고 안내받았어요."],
  ["another recipient belongs to a previous transaction", "가게에서 답장을 받았어요. 다른 예금주는 지난 계약의 참고 기록이고 현재 계약 물품값을 받는 사람은 서류에 적힌 판매자 본인이라고 안내했어요."],
  ["the individual seller receives payment through their own account", "거래 상대가 속한 회사 계좌와 개인 판매자 본인의 계좌는 예금주가 다르다는 설명을 받았어요. 이번 개인 판매 대금은 물건을 직접 판매한 사람 본인에게 납부한다고 안내했습니다."],
  ["the individual account belongs to the same contract party", "계약서에 적힌 거래 상대와 전시 운영 업체는 별개이고 대금은 계약자 본인의 개인 명의 계좌로 받는다고 회신받았습니다."],
  ["the other person's name labels a contact list", "계약 회사가 회신을 보냈어요. 수취인과 다른 이름은 방문 담당자 연락표에만 쓰이며 입금처는 계약 업체 명의 계좌라고 적혔습니다."],
  ["a deletion operation appears only as a comparison", "동호회 안내를 받았습니다. 보안 앱을 삭제하고 다음으로 가는 예시는 비교 설명일 뿐이고 그대로 쓰라는 안내가 적혔어요."],
]) {
  test(name, async () => assert.notEqual((await analyze({ text, ai: null })).level, "위험"));
}

for (const [name, signal, text] of [
  ["reported payment before receiving settlement", SIG_PREPAYMENT, "정산금을 돌려받는 조건으로 다른 비용을 먼저 납부해야 한다는 답변을 받았다고 메모했습니다."],
  ["reported third-party account is the outgoing destination", SIG_THIRD_PARTY_ACCOUNT, "정산 안내를 기록합니다. 계약 업체와 관계없는 제삼자의 개인 계좌가 대금 입금처라고 안내받았습니다."],
  ["reported family isolation is required for consultation", SIG_ISOLATION, "상담 안내를 받은 뒤 요지를 적습니다. 가족과 연락을 끊고 혼자 상담을 진행하라는 요구가 적혀 있었습니다."],
  ["reported deletion is a condition of continued consultation", SIG_DELETE_APP, "메시지를 받고 검토용 메모만 작성했습니다. 제 기기의 보안 프로그램을 삭제하고 나서야 상담을 계속 진행하라는 내용이었습니다."],
]) {
  test(name, async () => {
    const verdict = await analyze({ text, ai: null });
    assert.ok(verdict.fired_rules.includes("R9"));
    assert.ok(verdict.signals_code.includes(signal));
  });
}
