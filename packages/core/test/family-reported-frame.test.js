import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const positives=[
  ["받은 연락의 표시 관계와 동사형 물품 요청","받은 쪽지 기록입니다.\n표시 이름은 ‘고모’\n전해 달라는 물품은 ◇ 도서상품권이라는 요약입니다.","R13","SIG_GIFTCARD"],
  ["발신자 소개와 행위형 신원 서류 필드","받은 연락의 검토표입니다.\n보낸 사람 자기소개: 외삼촌\n발신자가 바꾼 번호로 연락했다고 적었습니다.\n전달 요청: 발신자에게 신분증 사본","R14","SIG_PERSONAL_INFO"],
  ["기록에 표시된 주장 뒤 실제 대금과 비공개 요구","수신 메시지 분류입니다.\n표시 이름은 ‘사촌’입니다.\n보낼 항목은 현금이라고 요청한 요약입니다.\n가족에게 알리지 말라는 별도 부탁이 있었습니다.","R13","SIG_MONEY"],
];
const normals=[
  ["같은 화면에서 가족이 받는 사람으로만 표시","받은 쪽지 기록입니다.\n수신자 소개: 고모\n전시 담당자가 안내용 종이 교환권을 전달해 달라고 했습니다."],
  ["보관 문서에서 옮긴 설치 기록 및 현재 요구 없음","연극 자료로 보관한 대화 기록입니다.\n표시 이름: 막내\n새 번호였는데 별도 앱 설치 요청은 이미 철회했습니다."],
  ["변경한 번호의 발신자 신원 서류와 발급 일정 구분", "받은 연락 검토표입니다.\n발신자 자기소개: 외삼촌\n전화번호 전환을 안내했습니다.\n회신 요청: 신분증 발급 일정"],
  ["앞선 가족 발신자와 별개인 후속 안내의 발신인 구분", "받은 연락입니다.\n발신자 자기소개: 외삼촌\n이 연락에서만 번호 교체 사실을 들었습니다.\n보낸 사람 소개: 문화센터 직원\n전송 요청: 신분증 사본"],
  ["표시 역할은 실제 가족이고 건강 관련 요청은 확인용","받은 쪽지 기록입니다.\n표시 이름은 ‘조카’입니다.\n기존 연락처로 통화해 본인임을 확인했고, 병원 검진은 기기에서 확인할 수 있다고 했습니다."],
];
for(const [name,text,rule,signal] of positives) test(name,async()=>{
  const r=await analyze({text,ai:null});
  assert.equal(r.level,"위험"); assert.ok(r.fired_rules.includes(rule),rule); assert.ok(r.signals_code.includes(signal),signal);
});
for(const [name,text] of normals)test(name,async()=>{
  let calls=0;
  const r=await analyze({text,ai:{model:"offline",apiKey:"dummy",fetchImpl:async()=>{calls++;throw Error("fake only");}}});
  assert.notEqual(r.level,"위험");
  if(name.includes("건강")) assert.deepEqual([r.ai_skipped,calls],["health",0]);
});