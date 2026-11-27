import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const paymentReport = "수신 경위 기록입니다. 쪽지를 보낸 사람이 저희 이모라고 말했습니다. 새 메신저 경로를 사용한다고 적었고 수강료를 제가 대신 치러 줄 수 있는지 문의한 내용입니다.";
const giftReport = "채팅 상대가 고모라고 스스로를 소개했습니다. 수신자에게 교환권을 구입해 달라는 요청이 있었다고 기록했습니다.";
const identityReport = "자신을 사촌이라고 밝힌 발신자가 새 채팅 계정을 알려 줬습니다. 이어 제 신분증 사본이 필요하다는 말을 남겼습니다.";

for (const [label, text, rule, required] of [
  ["간접 질문에서 비용의 납부자가 수신자", paymentReport, "R3", ["SIG_NEW_NUMBER", "SIG_MONEY"]],
  ["재귀대명사가 뒤따르는 자칭과 물품 요청", giftReport, "R13", ["SIG_GIFTCARD"]],
  ["재귀대명사가 앞서며 새 경로와 같은 발신자의 요구", identityReport, "R14", ["SIG_NEW_NUMBER", "SIG_PERSONAL_INFO"]],
  ["새 경로와 요구의 어순이 바뀐 수신 보고", "보낸 사람은 자신이 조카라고 주장했습니다. 제 신분증 사본이 필요하다는 말을 남겼고 새 메신저 경로를 적었습니다.", "R14", ["SIG_NEW_NUMBER", "SIG_PERSONAL_INFO"]],
  ["연락 경로 표시에 점이 있어도 같은 보고", "받은 메시지의 발신자는 자신이 삼촌이라고 주장했습니다. 새 채팅 계정을 https://placeholder.invalid/route 로 표시했습니다. 제 신분증 사본이 필요하다고 했다고 기록했습니다.", "R14", ["SIG_NEW_NUMBER", "SIG_PERSONAL_INFO"]],
  ["발신 역할과 본인 확인 제안에 대한 응답", "메시지를 보낸 이는 자신이 고모라고 주장했습니다. 제가 통화로 본인 확인을 하자고 제안했더니 발신자는 채팅으로만 계속 하라고 했습니다.", "R4", ["SIG_AVOID_VOICE"]],
  ["새 경로와 현금 요구를 분리해서 기록", "문자를 보낸 사람은 제 오빠라고 자신을 소개했습니다. 새 채팅 경로를 표시했습니다. 등록비를 수신자가 대신 내 줄 수 없겠느냐고 발신자가 문의한 내용입니다.", "R3", ["SIG_NEW_NUMBER", "SIG_MONEY"]],
]) {
  test(label, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.level, "위험");
    assert.ok(result.fired_rules.includes(rule), rule);
    for (const name of ["SIG_FAMILY_IMPERSONATION", ...required]) assert.ok(result.signals_code.includes(name), name);
  });
}

for (const [label, text] of [
  ["가족은 발신자에게서 연락을 받은 사람", "쪽지를 보낸 사람이 우리 이모에게 보냈다고 말했습니다. 새 메신저 경로를 사용한다고 적었고 수강료를 제가 대신 치러 줄 수 있는지 문의한 내용입니다."],
  ["발신자는 인용한 가족을 자기라고 말하지 않음", "채팅 상대가 고모라고 다른 사람을 소개했습니다. 수신자에게 교환권을 구입해 달라는 요청이 있었다고 기록했습니다."],
  ["받은 연락이 아니라 명의 예시를 옮긴 경우", "예방 교육 자료입니다. " + giftReport],
  ["인용된 사람이 보여 준 별개의 요구", "채팅 상대가 고모라고 스스로를 소개했습니다. 별도로 시설 직원이 교환권을 구입해 달라는 사무용 요청이 있었다고 기록했습니다."],
  ["수신자 본인이 다른 사람에게 문의", "쪽지를 보낸 사람이 저희 이모라고 말했습니다. 새 메신저 경로를 적었습니다. 수강료를 대신 내 줄 수 있는지 제가 다른 사람에게 물었습니다."],
  ["변경된 발신 경로가 아닌 일상적인 접수 경로", "쪽지를 보낸 사람이 저희 이모라고 말했습니다. 교육기관 자료에 새 상담 채팅 계정이 적혀 있었습니다. 수강료를 대신 낼 수 있는지 시설에 문의한 기록입니다."],
  ["발신자가 자기 신분증 자료만 언급", "자신을 사촌이라고 밝힌 발신자가 새 채팅 계정을 알려 줬습니다. 이어 자기 신분증 사본이 필요하다는 말을 남겼습니다."],
  ["신분 자료의 용도만 묻고 자료는 요구하지 않음", "자신을 사촌이라고 밝힌 발신자가 새 채팅 계정을 알려 줬습니다. 제 신분증 사본이 필요하다는 말은 아니며 자료를 요청한 적이 없다고 덧붙였습니다."],
  ["기존 채널에서 접수해 보관한 기록", "지난달 종료된 보관 내역입니다. " + identityReport],
  ["직접 가지고 있을 자료를 설명하는 행정 안내", "자신을 사촌이라고 밝힌 발신자가 새 채팅 계정을 알려 줬습니다. 제 신분증 원본이 필요하다는 설명이었지만 직접 지참할 서류 목록일 뿐입니다."],
  ["자료 발급 날짜에 관한 문의", "자신을 사촌이라고 밝힌 발신자가 새 채팅 계정을 알려 줬습니다. 제 신분증 사본 발급 일정이 필요하다는 보고만 있습니다."],
  ["뒤에 같은 요청을 철회", identityReport + " 해당 요청은 취소됐습니다."],
  ["가족은 소개했지만 통화는 잠깐 미룸", "메시지를 보낸 이는 자신이 고모라고 주장했습니다. 제가 통화로 본인 확인을 하자고 제안했더니 발신자는 근무 중이라 끝난 뒤 다시 전화하겠다고 했습니다."],
]) {
  test(label, async () => {
    const result = await analyze({ text, ai: null });
    assert.notEqual(result.level, "위험");
    for (const rule of ["R3", "R4", "R13", "R14"]) assert.ok(!result.fired_rules.includes(rule), rule);
  });
}
