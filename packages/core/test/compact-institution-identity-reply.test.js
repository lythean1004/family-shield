import assert from "node:assert/strict";
import { it } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_AGENCY_IMPERSONATION, SIG_PERSONAL_INFO } from "../src/signals.js";

const controls = [
  [true, "발신 기관 표제와 수신자의 두 식별자료가 같은 답장 대상으로 명시됨",
    "[수사기관] 제출 자료 확인: 현재 주소와 주민등록번호 일부 답장 바람."],
  [true, "서로 연결된 두 식별 항목의 회신 요구",
    "국세청 자료 보완: 본인의 주민등록번호 뒷자리 및 현재 주소를 회신해 주십시오."],
  [true, "등록 이름을 쓴 줄바꿈 표제와 다른 순서의 회신 항목",
    "경찰서 신청 서류 확인:\n성명과 주민등록번호 앞자리를 답장 요망."],
  [false, "민감 항목 없이 일반 문의",
    "보건소 서류 확인: 접수 시기를 문의했습니다."],
  [false, "부분 식별번호 한 항목",
    "국세청 자료 보완: 주민등록번호 뒷자리만 답장 바람."],
  [false, "배송 주소만 확인",
    "국세청 서류 확인: 배송 주소 확인만 요청한 기록입니다."],
  [false, "두 항목 중 하나는 발급 여부만 문의",
    "경찰서 자료 확인: 주소 및 주민등록번호 재발급 여부를 회신 바람."],
  [false, "팀이나 민원 문의를 표시한 이름이 승인 역할이 아님",
    "행사팀 자료 보완: 주민등록번호 일부와 주소를 답장해 주십시오."],
  [false, "수신자의 자발적 답장",
    "국세청 자료 보완: 제가 필요하다고 판단해 주소와 주민등록번호 일부를 회신했습니다."],
  [false, "사칭 예방에 예시로만 표기된 요청",
    "사칭 예방 자료에 경찰서 자료 보완: 성명과 주민등록번호 일부 답장 바람. 이라는 사례가 소개됐습니다."],
  [false, "답장이 아니라 창구 확인",
    "국세청 서류 확인: 주민등록번호 일부와 주소는 공식 창구에서 본인이 직접 확인하십시오."],
  [false, "앞선 내용을 교육용 예로 정정함",
    "경찰서 자료 확인: 현재 주소와 주민등록번호 일부 회신 요망. 앞 문장은 교육용 예시였습니다."],
  [false, "알려진 기관명으로 끝나는 미등록 표제",
    "가상검찰청 자료 확인: 성명과 주민등록번호 일부 회신 바람."],
  [true, "수신자가 자료를 보내지 않았어도 요구 사실이 명시됨",
    "국세청 제출 자료 확인: 성명과 주민등록번호 일부 답장 요망. 답장하지 않고 경위를 기록했습니다."],
  [false, "직전 회신 요구의 철회",
    "경찰서 자료 확인: 주소와 주민등록번호 일부 회신 바람. 그 요청은 취소됐습니다."],
  [false, "서로 다른 기록의 표제와 응답",
    "국세청 자료 확인:\n\n주소와 주민등록번호 일부 답장 요망."],
  [false, "기존 공식 접수처에 자발적으로 제출",
    "경찰서 서류 확인: 주소와 주민등록번호를 원래 접수처에서 직접 검사했다고 기록했습니다."],
];
for(const [expected, name, text] of controls) it(name, async() => {
  const verdict = await analyze({text});
  assert.equal(verdict.fired_rules.includes("R6"), expected);
  if(expected){
    assert.ok(verdict.signals_code.includes(SIG_AGENCY_IMPERSONATION));
    assert.ok(verdict.signals_code.includes(SIG_PERSONAL_INFO));
  }
});
