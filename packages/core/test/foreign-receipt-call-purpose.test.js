import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { SIG_FOREIGN_PAYMENT_CALLBACK } from "../src/signals.js";

describe("해외 발신 승인 알림에서 상대가 지정한 전화의 목적", () => {
  const stub = "010-0000-8300";
  const official = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
    .flatMap(card => card.callback_contact?.numbers ?? []).find(number => number.replace(/\D/g, "").length >= 8);
  assert.ok(official);
  const settled = "받은 알림은 국외 발신이었고 카드 결제가 이미 완료됐다는 내용이었습니다.";
  const fileByPhone = number => `본인의 거래가 아니면 ${number}로 연락한 뒤 결제 취소를 신청하라는 안내를 받았다고 기록했습니다.`;
  const requests = [
    `${settled} ${fileByPhone(stub)}`,
    `국제 발신으로 표시된 문자를 받았습니다. 거래가 끝났다는 통지였습니다. 내 거래가 아니라면 ${stub}에 전화해서 취소를 접수하라는 요구가 있었다고 기록했습니다.`,
    `받은 문자는 해외 발신이었으며 거래가 승인됐다는 안내였습니다. 수신자의 거래가 아닐 때 본문에 적힌 ${stub}로 전화한 다음 취소 신청을 해야 한다는 설명이었다고 기록했습니다.`,
  ];
  for (const text of requests) {
    it(text, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK));
      assert.ok(result.fired_rules.includes("R19"));
    });
  }

  const controls = [
    `${settled} ${fileByPhone(official)}`,
    `받은 알림에 해외 여행에서 쓴 카드 결제가 이미 완료됐다는 내용이 있었습니다. ${fileByPhone(stub)}`,
    `받은 알림은 국외 발신이었고 카드 결제가 아직 승인 대기라는 내용이었습니다. ${fileByPhone(stub)}`,
    `받은 알림은 국외 발신이었습니다. 별개 거래가 끝났다는 통지였습니다. ${fileByPhone(stub)}`,
    `${settled} 본인의 거래가 아니면 ${stub}로 연락한 뒤 취소를 신청하라는 뜻은 아니었다고 기록했습니다.`,
    `${settled} 본인의 거래가 아니면 ${stub}로 전화한 뒤 영수증을 확인하라는 설명이었다고 기록했습니다.`,
    `${settled} ${fileByPhone(stub)} 해당 취소 요청은 철회됐습니다.`,
    `${settled} 본인의 거래가 아니면 전화하라는 번호는 없었습니다. 상담용으로 보관한 번호는 ${stub}였습니다.`,
  ];
  for (const text of controls) {
    it(text, async () => {
      const result = await analyze({ text });
      assert.ok(!result.signals_code.includes(SIG_FOREIGN_PAYMENT_CALLBACK));
      assert.ok(!result.fired_rules.includes("R19"));
    });
  }
});
