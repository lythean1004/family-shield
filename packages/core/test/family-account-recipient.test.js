import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const positives=[
  ["인척이라고 소개한 발신자가 새 계정에서 문서 전송을 요구","새 메신저 계정으로 며느리라고 소개한 사람이 연락했습니다. 자기 전화가 바뀌었다고 설명했습니다. 제 신분증 사본을 전송해 달라고 했습니다."],
  ["바뀐 계정으로 연락한 발신자가 수신자 사진의 제출 요구","처음 보는 계정에서 이모라고 말한 상대가 메시지를 보냈습니다. 제 신분증을 찍은 자료를 제출해 달라고 했습니다."],
];
for (const [name,text] of positives) test(name, async()=>{
  const result=await analyze({text,ai:null});
  assert.equal(result.level,"위험");
  assert.ok(result.fired_rules.includes("R14"));
  assert.ok(result.signals_code.includes("SIG_FAMILY_IMPERSONATION"));
  assert.ok(result.signals_code.includes("SIG_NEW_NUMBER"));
  assert.ok(result.signals_code.includes("SIG_PERSONAL_INFO"));
});

const controls=[
  ["친족은 발신자가 아니라 수신자","새 계정에서 며느리라는 사람이 수신자로 표시됐습니다. 제 신분증 사본을 전송해 달라는 요구가 기록됐습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["수신자가 친족에게 직접 연락","새 계정에서 며느리라는 사람에게 제가 연락했습니다. 제 신분증 사본을 전송해 달라는 요구를 기록해 뒀습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["친족은 별개 인물의 설명","새 채팅 계정에서 지인의 사위에 대해 설명한 사람이 연락했습니다. 제 신분증 사본을 전송해 달라고 했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["계정 사용자의 기기와 수신자 기기 변경을 혼합하지 않음","새 메신저 계정으로 며느리라고 소개한 사람이 연락했습니다. 제가 휴대전화를 바꿨다고 설명했습니다. 제 신분증 사본을 전송해 달라는 요구가 이어졌습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["별개 사람의 기기 변경과 문서 요구","새 계정으로 며느리라고 소개한 사람이 연락했습니다. 보호자가 휴대전화를 바꿨다고 설명했습니다. 제 신분증 사본을 전송해 달라는 요구가 이어졌습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["계정 변경의 철회","새 계정으로 며느리라고 소개한 사람이 연락했습니다. 계정은 그대로였습니다. 제 신분증 사본을 전송해 달라고 했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["수신자가 자기 대신 발신자에게 문서를 요청","새 계정으로 며느리라고 소개한 사람이 연락했습니다. 제가 발신자에게 제 신분증 사본을 전송해 달라고 요청했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["제출 요구가 철회된 기록","새 메신저 계정으로 며느리라고 소개한 사람이 연락했습니다. 제 신분증 사본을 전송해 달라고 했습니다. 요청은 철회했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["예방 안내 속 접수 문구","예방 교육 자료입니다. 새 계정으로 며느리라고 소개한 사람이 연락했습니다. 제 신분증 사본을 전송해 달라고 했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["친족 확인이 완료된 신고 요약","새 계정으로 며느리라고 소개한 사람이 연락했습니다. 제 신분증 사본을 전송해 달라고 했습니다. 기존 연락처로 통화해 본인임을 확인했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
  ["정상 행사 명단의 발급 일정만 확인","새 계정에서 며느리라고 소개한 사람이 연락했습니다. 제 신분증 발급 예정일만 확인해 달라고 했습니다.","확인필요",[],["R8"]],
  ["문서 소유자가 제삼자","새 계정으로 며느리라고 소개한 사람이 연락했습니다. 제삼자의 신분증 사본을 전송해 달라는 요구라고 기록했습니다.","주의",["SIG_PERSONAL_INFO"],["R7"]],
];
for (const [name,text,level,signals,rules] of controls) test(name, async()=>{
  const result=await analyze({text,ai:null});
  assert.equal(result.level,level);
  assert.deepEqual(result.signals_code,signals);
  assert.deepEqual(result.fired_rules,rules);
});
