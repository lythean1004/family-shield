import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const changedClaim = "낯선 연락처로 본인은 제 고모이고 이제 이 연락처를 쓴다는 메시지가 왔습니다.";
const moneyClaim = "자신을 외삼촌이라고 밝힌 사람의 수신 기록에 송금 요청이 있었습니다.";
const giftClaim = "발신인 소개에 받은 사람의 이모라고 적혀 있습니다.";
const positives = [
  ["음성 확인 제안에 발신자가 문자만 강요한 수신 보고",
    changedClaim + " 통화로 본인 확인하자고 답했더니 상대는 문자로만 계속 이야기하라고 답했습니다.",
    "R4", "SIG_AVOID_VOICE"],
  ["수신자를 표시한 다른 보고체의 확인 제안과 채팅 요구",
    "받은 문자에 본인은 제 조카이고 다른 번호로 연락 중이라는 내용이 있었습니다. 제가 목소리로 본인인지 확인하자고 제안했더니 그쪽은 채팅으로만 대화하라고 했습니다.",
    "R4", "SIG_AVOID_VOICE"],
  ["금전 요구 직후 같은 발신자가 지연 불이익을 알린 보고",
    moneyClaim + " 지체하면 처리 과정에 불이익이 생긴다고 덧붙인 기록입니다.",
    "R13", "SIG_URGENCY"],
  ["가족으로 소개한 연락의 금전 요구와 지연 경고",
    "받은 쪽지에서 상대는 본인을 형이라고 밝히고 현금을 보내 달라고 요구했습니다. 미루면 큰일이 난다는 말을 함께 전했습니다.",
    "R13", "SIG_MONEY"],
  ["별도 수신 기록에 상품권 취득 행위의 직접 부탁",
    giftClaim + " 바뀐 연락처에서 받은 메시지에 상품권을 마련해 달라는 요구가 적혀 있습니다.",
    "R3", "SIG_GIFTCARD"],
  ["새 번호의 가족 자칭 발신자가 교환권 획득을 요구",
    "처음 보는 번호에서 고모라고 밝히고 교환권을 구해다 달라는 수신 기록입니다.",
    "R13", "SIG_GIFTCARD"],
];
const normal = [
  ["일상 통화 시간을 고르고 잠시 문자만 쓰자는 대화",
    changedClaim + " 목소리로 본인인지 확인하자고 답했더니 문자로만 이야기하자고 했고 내일 오전에 다시 통화하자고 제안했습니다."],
  ["이미 음성으로 본인 확인을 마침",
    changedClaim + " 통화로 본인을 확인하자고 답했더니 잠시 문자로만 대화하라고 했고 그 후 전화로 본인 확인을 마쳤습니다."],
  ["본인 확인 제안에 별개 안내 직원이 답한 경우",
    changedClaim + " 통화로 본인 확인하자고 답했더니 별도로 안내 데스크 직원은 문자로만 회신하라고 했습니다."],
  ["수신자가 자신의 일상 통화 일정만 변경",
    changedClaim + " 저는 저녁 약속에 늦지 않으려고 통화를 미뤘습니다."],
  ["응답이 실제 있었는지 묻는 질문",
    changedClaim + " 통화로 본인 확인하자고 답했더니 상대는 문자로만 계속 이야기하라고 답했나요?"],
  ["연극 교재에 표시된 역할과 문자 대사",
    "역할극 자료입니다. " + changedClaim + " 목소리를 확인하자고 답했더니 상대는 문자로만 대화하라고 했습니다."],
  ["금전 요청과 별개로 다른 사람의 일정 압박",
    moneyClaim + " 한편 담당자는 늦으면 큰일이 난다는 행사 시간 안내를 전달했습니다."],
  ["금전 요구 이후 철회 기록",
    moneyClaim + " 지체하면 불이익이 생긴다는 말이 뒤따랐으나 그 금전 요청은 철회했습니다."],
  ["금전 요청을 묻기만 한 다음 일정을 설명",
    "수신 메모에 외삼촌이라고 소개한 문장만 있습니다. 송금 요청이 있었을까요? 늦으면 큰일이 난다는 말은 독서 모임 시간을 말했습니다."],
  ["요청 목적어가 상품권 품목의 보관이었던 경우",
    giftClaim + " 바뀐 연락처에서 받은 기록에 상품권을 보관해 달라는 요청이 적혀 있습니다."],
  ["다른 발신자가 상품권을 마련해 달라고 함",
    giftClaim + " 별도로 행사 담당자가 상품권을 마련해 달라고 요청했습니다."],
  ["상품권을 마련해 달라는 요청 자체가 철회됨",
    giftClaim + " 바뀐 연락처의 상품권을 마련해 달라는 요청은 취소했습니다."],
  ["민감정보의 필요성을 말했지만 회신·제출 요구는 없음",
    "아들이라고 소개된 연락에서 연락처를 정리하는 방법과 생년월일이 본인 업무에 필요하다고 했습니다. 상대가 제게 생년월일을 물은 일은 없습니다."],
];
for (const [name, text, rule, signal] of positives) test(name, async () => {
  const result=await analyze({ text, ai: null });
  assert.equal(result.level,"위험");
  assert.ok(result.fired_rules.includes(rule), rule);
  assert.ok(result.signals_code.includes(signal), signal);
  assert.ok(!result.signals_code.includes("SIG_LINK"));
});
for (const [name, text] of normal) test(name, async () => {
  assert.notEqual((await analyze({text,ai:null})).level,"위험");
});
