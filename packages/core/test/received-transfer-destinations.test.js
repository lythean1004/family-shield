import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_CREDENTIAL_DISCLOSURE, SIG_THIRD_PARTY_ACCOUNT } from "../src/signals.js";

describe("받은 안내에 적힌 일회용값의 별도 수령인", () => {
  const scope = [
    ["발신자가 지정한 실제 직원에게 값을 건네는 역할", "받은 안내에 적힌 절차입니다. 제 휴대전화에 도착한 일회용 확인 코드를 상담 담당자가 지정해 둔 다른 직원에게 넘기는 것이 제 몫이라고 기록했습니다."],
    ["수신자에게 발급된 값의 인계 대상을 지정", "받은 메시지에서 상담을 맡은 곳이라고 밝혔습니다. 제 기기에 도착한 일회용 인증값의 인계 대상은 그쪽이 정한 별도 접수원이라고 적혀 있었습니다."],
    ["다른 직원에게 인증값을 구두로 넘기는 다음 절차", "상대가 보낸 연락을 받았습니다. 제 화면에 표시된 일회용 인증코드를 지정 직원에게 구두로 전하는 게 다음 절차라고 했습니다. 실제 값은 기록하지 않았습니다."],
  ];
  for (const [name, text] of scope) {
    it(name, async () => {
      const result = await analyze({text});
      assert.ok(result.signals_code.includes(SIG_CREDENTIAL_DISCLOSURE));
      assert.ok(result.fired_rules.includes("R16"));
    });
  }

  const ordinary = [
    ["일반 접수번호의 인계", "받은 연락입니다. 창구에서 부여한 접수번호를 담당자가 지정한 다른 직원에게 전달하는 것이 민원 처리 순서라고 적혀 있습니다."],
    ["수신자 소유 기기에만 입력", "받은 안내에 따르면 제 휴대전화에 도착한 일회용 인증값은 제 기기에서만 입력합니다. 지정된 다른 직원에게 입력 방법을 문의하고 값은 알려 주지 않는다는 내용입니다."],
    ["값의 유형만 직원에게 전달", "받은 메시지에 제 기기에 도착한 일회용 인증값의 유형만 다른 직원에게 전달하는 것이 절차라고 적혔습니다. 값 자체는 알려 주지 않습니다."],
    ["일회용값의 전달 방법을 설명할 뿐", "상담 기록을 받았습니다. 제 휴대전화에 도착한 일회용 확인 코드의 형식과, 직원에게 전달하는 방법이 서로 다르다고 설명했습니다. 실제 코드 전달은 필요하지 않다고 안내했습니다."],
    ["휴대전화의 소유자는 발신자", "받은 회신은 상담 기록입니다. 내용에 동료의 휴대전화에 온 일회용 인증 코드를 다른 직원에게 전달하라는 인수인계 문장을 기록했습니다."],
    ["교육용 일회용값 사례", "피싱 예방 교육 자료를 받았습니다. 제 기기에 도착한 일회용 인증값의 인계 대상은 지정된 직원이라는 수업 사례였습니다."],
    ["발신자가 이전 요구를 철회", "받은 연락에는 제 기기에 도착한 일회용 인증 코드를 별도 직원에게 전달하는 것이 제 몫이라는 말이 있었으나 해당 요청은 취소됐습니다."],
  ];
  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({text});
      assert.ok(!result.signals_code.includes(SIG_CREDENTIAL_DISCLOSURE));
      assert.ok(!result.fired_rules.includes("R16"));
    });
  }
});

describe("계약 상대와 다른 명의가 실제 지급 대상으로 지정됨", () => {
  const scope = [
    ["실제 입금 대상으로 대비되는 다른 계좌", "대금 처리에 대해 상대에게 받은 연락입니다. 요청된 입금 대상으로 원래 계약 상대와 관계없는 제삼자의 개인 명의 계좌가 명시되어 있었습니다."],
    ["다른 입금 수취인을 명시한 답장", "대금 안내를 수신했습니다. 송금 수취인으로 지정된 쪽은 계약 업체가 아닌 거래와 무관한 제삼자이며 그 사람 명의 통장이 납부처라는 내용입니다."],
    ["납부할 계좌 명의의 계약과 무관함을 알림", "계약 답신을 받았습니다. 납부하라고 지정한 수취 계좌는 계약에 참여하지 않은 제삼자의 명의라고 적혀 있었습니다."],
  ];
  for (const [name, text] of scope) {
    it(name, async () => {
      const result = await analyze({text});
      assert.ok(result.signals_code.includes(SIG_THIRD_PARTY_ACCOUNT));
      assert.ok(result.fired_rules.includes("R9"));
    });
  }

  const ordinary = [
    ["합법적인 환급 계좌가 원래 입금처와 다름", "거래가 끝나고 환급 안내를 받았습니다. 구매자가 동의한 환급 수령처는 판매자의 원래 계좌와 다른 수령인 명의로 기록됐습니다."],
    ["입금처는 계약자 본인 계좌", "받은 연락에서 납부하라고 지정한 대상은 계약 상대 본인의 개인 명의 계좌라고 확인했습니다."],
    ["다른 명의가 거래와 별개의 예시", "받은 계약 답신에서 입금처를 확인했습니다. 그와 별개로 교육 자료에 거래에 참여하지 않은 제삼자 명의의 계좌를 입력하는 예시가 있다고 적혀 있었습니다."],
    ["승인된 정식 수납 대행처", "받은 안내에 요청된 입금 대상은 계약 업체와 다른 정식 수납 대행사 명의의 법인 계좌라고 적혀 있습니다."],
    ["새 입금 요청 없이 과거 계좌만 정정", "받은 답신에서 기존 납부 요청을 취소했습니다. 계약과 무관한 제삼자 명의 계좌는 예전에 표시된 값이라고 정정했습니다."],
  ];
  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({text});
      assert.ok(!result.signals_code.includes(SIG_THIRD_PARTY_ACCOUNT));
      assert.ok(!result.fired_rules.includes("R9"));
    });
  }
});