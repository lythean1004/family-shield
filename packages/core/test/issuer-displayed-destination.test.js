import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { extractCodeSignals } from "../src/extract.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { SIG_AGENCY_IMPERSONATION } from "../src/signals.js";

const unverified = "https://receipt-check.invalid/copy";
const number = "000-0000-8300";
const official = OFFICIAL_DOMAIN_CARDS.filter(card => card.status === "source_checked")
  .flatMap(card => card.callback_contact?.numbers ?? []).find(value => value.replace(/\D/g, "").length >= 8);
const viewing = "건강보험 기관을 자칭한 알림이 검진 결과를 확인하라는 주소를 전달했다는 수신 기록입니다.";
const issuer = "보험사 보상 상담팀이라고 밝힌 메시지입니다.";

async function expectR6(text, expected) {
  const result = await analyze({ text });
  assert.equal(result.fired_rules.includes("R6"), expected);
}

describe("수신 자료의 발신 역할과 지정 목적지", () => {
  it("미개봉 상태인 열람 요구의 별도 주소 표기", () =>
    expectR6(`${viewing} 화면에 표시된 주소는 ${unverified} 였고 열람하지 않았습니다.`, true));
  it("발신 역할이 적힌 메시지의 재연락 요구", () =>
    expectR6(`${issuer} 본문에 적힌 ${number}로 다시 연락하라는 요구를 상담에 기록했습니다.`, true));
  it("주소 지시와 기관 역할이 한 절에 기록됨", () =>
    expectR6(`건강보험 기관을 자처한 안내문이 검진 내역을 보라는 주소 ${unverified} 를 전달했다고 기록했습니다.`, true));
  it("새로 보강한 근거는 기존 건강 AI 요청 신호에 들어가지 않음", () => {
    const extracted = extractCodeSignals(`${viewing} 화면에 표시된 주소는 ${unverified} 였고 열람하지 않았습니다.`);
    assert.ok(extracted.signals.includes(SIG_AGENCY_IMPERSONATION));
    assert.ok(!extracted.healthRoutingSignals.includes(SIG_AGENCY_IMPERSONATION));
  });

  const controls = [
    ["번호를 참고만 하라는 안내", `${issuer} 본문에는 참고용 번호 ${number}가 적혔습니다.`],
    ["공식 회신 번호", `${issuer} 본문에 적힌 ${official}로 다시 연락하라는 요구를 기록했습니다.`],
    ["공식 목적지만 표시", `${viewing} 표시된 주소는 https://www.gov.kr/ 였습니다.`],
    ["두 주소 중 요구 대상을 확인할 수 없음", `${viewing} 표시된 주소는 ${unverified} 와 https://www.gov.kr/ 였습니다.`],
    ["다른 기록의 주소", `${viewing} 그와 별개로 모임에 표시된 주소는 ${unverified} 였습니다.`],
    ["부정된 은행 소속", "은행 아닌 도서관 안내팀이라고 밝힌 메시지입니다. 본문에 기재된 " + number + "로 다시 연락하라는 기록입니다."],
    ["수신자가 의무 여부만 질문", issuer + " 본문에 적힌 " + number + "로 다시 연락하라는 건지 상담에 문의했습니다."],
    ["자료 안 제삼자의 역할", `동료를 보험사 보상 상담팀이라고 밝힌 메시지입니다. 본문에 적힌 ${number}로 다시 연락하라는 내용이 있었습니다.`],
    ["수신자가 먼저 부탁한 회신", `${issuer} 제가 먼저 본문에 적힌 ${number}로 다시 연락하라는 말을 전했다고 기록했습니다.`],
    ["연락 요구를 받은 뒤 철회됨", `${issuer} 본문에 적힌 ${number}로 다시 연락하라는 내용이 있었습니다. 그 요구는 철회됐습니다.`],
    ["훈련 문구에서 읽은 번호", `교육 자료로 읽은 보험사 보상 상담팀이라고 밝힌 메시지입니다. 본문에 적힌 ${number}로 다시 연락하라는 예시입니다.`],
    ["전화 이후 온 별개 문자에서 직원 업무용 기기의 설치", "구청 전산 부서라고 전화가 왔습니다. 뒤이어 온 별도 문자에는 직원의 업무용 기기에 프로그램을 설치하라고 기록돼 있습니다."],
  ];
  for (const [name, text] of controls) it(name, () => expectR6(text, false));
});
