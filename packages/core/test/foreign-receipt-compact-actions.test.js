import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { SIG_FOREIGN_PAYMENT_CALLBACK } from "../src/signals.js";

describe("해외 결제 수신 기록의 짧은 항목 연결", () => {
  const requests = [
    ["쉼표로 분리된 해외 발신·승인·취소 창구", "수신 기록 발췌. 해외 발신 표기, 거래 승인 완료 기록, 내 거래가 아니라면 000-0000-1234로 거래 취소 문의를 하라는 안내."],
    ["항목 순서가 바뀌고 제목과 본문이 한 줄임", "받은 알림 요약: 카드 결제가 이미 완료됐다는 기록, 국제 발신 표시, 본인 거래가 아닐 경우 000-0000-5678에 취소 접수를 해야 한다는 항목."],
    ["취소 연락처 역할과 번호 뒤의 행동이 명시됨", "수신 내역 메모. 국외 발송으로 표시됨; 승인됐다는 결제 통지; 수신자의 거래가 아니라면 취소 문의처: 000-0000-1234로 취소 문의하라는 내용."],
  ];
  for (const [name, text] of requests) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK));
      assert.ok(result.fired_rules.includes("R19"));
    });
  }

  const known = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
    .flatMap(card => card.callback_contact?.numbers ?? []).find(number => number.replace(/\D/g, "").length >= 8);
  assert.ok(known);
  const controls = [
    ["카드에서 확인된 번호", `수신 기록 발췌. 해외 발신 표시, 거래 승인 완료 기록, 내 거래가 아니라면 ${known}로 취소 문의를 하라는 안내.`],
    ["거래 두 건의 항목을 이어 붙이지 않음", "수신 내역 발췌. 해외 발신 표기, 별개 거래 승인 완료 기록, 내 거래가 아니라면 000-0000-1234로 취소 문의를 하라는 안내."],
    ["하나의 번호는 승인 내역 참고, 다른 번호는 일반 문의", "수신 알림 요약. 해외 발신 표시, 거래 승인 완료 기록, 본인 거래가 아니면 참고 번호 000-0000-1234로 보관, 그와 별개로 000-0000-5678로 배송 문의를 하라는 안내."],
    ["해외 발신에 결제 예정만 기록", "수신 기록 발췌. 해외 발신 표시, 거래 승인 예정 기록, 본인 거래가 아니면 000-0000-1234로 취소 문의를 하라는 안내."],
    ["현재 요구가 취소됨", "수신 기록 발췌. 해외 발신 표시, 거래 승인 완료 기록, 본인 거래가 아니라면 000-0000-1234로 취소 문의를 하라는 안내. 해당 취소 요청은 철회됐습니다."],
    ["숫자열을 알 수 없음", "수신 내역 요약. 해외 발신 표시, 거래 승인 완료 기록, 내 거래가 아니라면 번호가 생략된 창구로 취소 연락을 하라는 안내."],
    ["해외 발신 표기 누락", "수신 기록 발췌. 국내 발신 표시, 거래 승인 완료 기록, 내 거래가 아니라면 000-0000-1234로 취소 문의를 하라는 안내."],
    ["수신자가 문의한 가정", "수신 기록 발췌. 국제 발신 표시, 거래 승인 완료 기록, 본인 거래가 아니면 000-0000-1234로 취소 문의를 해야 하는지 제가 물었습니다."],
    ["수신 기록과 별도의 교육자료", "수신 기록 발췌. 피해 예방 교육 자료의 예시에는 해외 발신 표시, 거래 승인 완료 기록, 본인 거래가 아니면 000-0000-1234로 취소 문의를 하라는 안내가 들어 있었습니다."],
  ];
  for (const [name, text] of controls) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(!result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK));
      assert.ok(!result.fired_rules.includes("R19"));
    });
  }
});
