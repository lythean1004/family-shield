import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_AGENCY_IMPERSONATION, SIG_PERSONAL_INFO } from "../src/signals.js";

const form = "https://intake.invalid/sample";
const agency = "군청 민원 담당자를 자처하는 쪽에서";
const issuer = "발신처는 공공기관을 자처함.";
const details = "접수를 계속하려면 제 성명과 출생일을 제공해야 한다는 설명이 있었습니다.";

for (const [name, text, signal] of [
  ["자칭한 접수 부서가 보낸 한 개의 양식 주소", agency + " 신청 양식 " + form + " 을 전달했습니다.", SIG_AGENCY_IMPERSONATION],
  ["사업 담당을 명시한 발신자와 접수 주소", "시청 복지 사업 담당자라고 소개한 사람이 접수 주소 " + form + " 를 보냈습니다.", SIG_AGENCY_IMPERSONATION],
  ["수신자를 명시한 양식 전송", "금융기관 상담 직원을 자칭한 곳에서 제게 제출 서식 " + form + " 을 전송했습니다.", SIG_AGENCY_IMPERSONATION],
  ["접수 요약에서 당사자가 요구한 두 인적 사항", issuer + " " + details, SIG_PERSONAL_INFO],
  ["수신자를 명시하고 출생 일자가 먼저 오는 경우", "발신자는 행정기관을 자칭함. 상담을 진행하려면 수신자의 생년월일과 이름을 제출해야 한다는 내용이었습니다.", SIG_PERSONAL_INFO],
  ["다른 공공 역할과 제출 동사", "문자 발신자는 관공서를 자처했음. 등록을 위해서는 내 이름과 생년월일을 전달해야 한다는 안내였습니다.", SIG_PERSONAL_INFO],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(result.fired_rules.includes("R6"));
    assert.ok(result.signals_code.includes(signal));
  });
}

for (const [name, text] of [
  ["보낸 방향이 반대인 상담", agency + " 회신을 기다렸고 내가 접수 양식 " + form + " 을 전달했습니다."],
  ["검토자가 따로 붙인 참고 주소", agency + " 상담을 안내했습니다. 이 기록의 참고 주소는 " + form + " 입니다."],
  ["다른 발신자의 주소", agency + " 상담 일정을 물었습니다. 다른 모임에서 접수 주소 " + form + " 를 보냈습니다."],
  ["신청서를 상대에게 보냈다는 질문", agency + " 신청 양식 " + form + " 을 보냈을까요?"],
  ["교육 자료 안의 발신 보고", "예방 교육 자료. " + agency + " 신청 양식 " + form + " 을 전달했습니다."],
  ["평소 사용하는 단체 접수", "동호회 모임 담당자가 접수 주소 " + form + " 를 보냈습니다."],
  ["신원 자료가 필요한지는 문의 중", issuer + " 접수를 계속하려면 제 성명과 출생일을 제공해야 하는지 제가 문의했습니다."],
  ["본인 기기에서만 작성", issuer + " 상담을 진행하려면 본인 기기에서만 제 성명과 출생일을 제공해야 한다는 설명이 있었습니다."],
  ["다른 사람의 정보가 필요한 경우", issuer + " 접수를 계속하려면 담당 직원의 성명과 출생일을 제공해야 한다는 설명이 있었습니다."],
  ["의료기관 현장 방문 지참", issuer + " 대면 방문 창구에서 접수하려면 제 성명과 출생일을 제공해야 한다는 설명이 있었습니다."],
  ["요청을 취소한 다음 문장", issuer + " " + details + " 그 요구는 이미 철회됐습니다."],
  ["다른 보고에서 가져온 요청", issuer + "\n\n" + details],
  ["일반 수업의 출석 확인", "발신처는 지역 공부방 운영자. " + details],
  ["문자 발신자와 공식 기관을 비교", "발신처는 공공기관을 자처한 적이 없음. " + details],
]) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.fired_rules.includes("R6"), false);
  });
}
