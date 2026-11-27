import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_CREDENTIAL_DISCLOSURE, SIG_DOCUMENT_BUNDLE } from "../src/signals.js";

describe("수신자가 받은 값의 발신인 회신과 양식의 제출 대상", () => {
  const risks = [
    ["지시자가 일회용 확인값을 다시 받는다고 표시", SIG_CREDENTIAL_DISCLOSURE, "받은 안내를 정리했습니다. 발신인은 일회용 확인 코드를 수신자가 자기에게 전달하라고 요구한 상태입니다."],
    ["상담 상대가 실제 일회용값을 자신에게 넘기라 요구", SIG_CREDENTIAL_DISCLOSURE, "상담 뒤 남긴 수신 기록입니다. 상대가 제 일회용 인증 코드를 자신에게 구두로 전달하라는 요구를 했습니다. 수신자는 값을 기록하지 않았습니다."],
    ["발신인과 값을 받을 다른 사람을 분리", SIG_CREDENTIAL_DISCLOSURE, "전달받은 안내의 요약입니다. 발신인이 제 일회용 확인번호를 자신이 지정한 접수 직원에게 전달하라고 요구했습니다."],
    ["실제 접수 양식의 제출 요구와 두 서류를 결속", SIG_DOCUMENT_BUNDLE, "지원금 상담 기록에 신청 확인 양식 주소 https://application-record.invalid/form 이 있습니다. 그 양식의 제출 요구는 신분 확인 사진과 통장 사본이라고 적혔습니다."],
    ["주소와 서류 항목을 줄 안에서 이어 적은 수신 기록", SIG_DOCUMENT_BUNDLE, "부업 문의 중 제공받은 접수 양식은 https://records-only.invalid/intake / 그 양식의 제출 요구 항목: 주민등록증 사본 및 통장 사본이었다고 기록했습니다."],
    ["업무 신청 양식 한 곳의 두 필수 항목", SIG_DOCUMENT_BUNDLE, "재택 일자리 상담에서 신청 양식 링크 https://workflow.invalid/receive 를 안내했습니다. 그 양식에서 제출하라고 한 것은 신분 확인 자료와 계좌를 확인하는 통장 사본입니다."],
  ];
  for (const [name, signal, text] of risks) {
    it(name, async () => {
      const result=await analyze({text});
      assert.ok(result.signals_code.includes(signal));
      assert.equal(result.level,"위험");
    });
  }

  const ordinary = [
    ["발신자의 인증값을 발신자 기기에만 입력", SIG_CREDENTIAL_DISCLOSURE, "받은 안내를 정리했습니다. 발신인은 자기 휴대전화에 온 일회용 인증 코드를 본인 기기에 입력했다고 기록했으며 수신자가 보낼 값은 없다고 했습니다."],
    ["인증값 유형만 회신", SIG_CREDENTIAL_DISCLOSURE, "상담 상대가 일회용 확인 코드의 형식만 자신에게 전달하라는 의견이었다고 확인했습니다. 코드 값은 보내지 않는 것이 안내의 요지입니다."],
    ["수신 안내가 아닌 예시에서 값 전달 구절", SIG_CREDENTIAL_DISCLOSURE, "보안 교육 자료에서 발신인이 수신자의 일회용 확인 코드를 자신에게 전달하라고 요구하는 사례를 분석했습니다."],
    ["신청 양식과 주소가 별개", SIG_DOCUMENT_BUNDLE, "부업 신청 확인 양식에 신분 확인 사진과 통장 사본을 제출하라는 글을 읽었습니다. 그와 별개로 행사 시간표 주소는 https://calendar.invalid/times 입니다."],
    ["양식에는 서류 이름을 예시로만 기재", SIG_DOCUMENT_BUNDLE, "지원금 신청 확인 양식 주소 https://public-form.invalid/overview 를 받았습니다. 그 양식에서 신분 확인 사진과 통장 사본은 제출 예시로만 소개했고 실제 제출은 요구하지 않습니다."],
    ["주소 원문은 확인할 수 없음", SIG_DOCUMENT_BUNDLE, "재택 신청 접수 기록을 정리했습니다. 부업 확인 양식에 신분 확인 사진과 통장 사본을 제출하라는 내용이었지만 접수처 주소는 기록에 없습니다."],
    ["주소와 서류 용도를 한정하지 않은 일상 안내", SIG_DOCUMENT_BUNDLE, "채용 박람회 일정 링크는 https://dates.invalid/ 입니다. 신청 서류인 신분 확인 자료와 통장 사본은 별도 공지에서 확인할 수 있습니다."],
  ];
  for (const [name, signal, text] of ordinary) {
    it(name, async () => {
      const result=await analyze({text});
      assert.ok(!result.signals_code.includes(signal));
    });
  }
});