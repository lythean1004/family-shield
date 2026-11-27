import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import {
  SIG_AGENCY_IMPERSONATION, SIG_CALL_THIS_NUMBER, SIG_CASH_HANDOVER,
  SIG_FOREIGN_PAYMENT_CALLBACK, SIG_LOAN_CASH_PICKUP, SIG_OFFICIAL_LINK,
} from "../src/signals.js";

const invalidPage = "https://reading.example.invalid";
const knownOfficial = "https://www.hometax.go.kr";
const syntheticNumber = "000-0000-0000";
const knownOfficialNumber = "126";
const utilityNotice = "공공 서비스 관리 부서를 자처한 곳에서 처리 결과 안내가 왔습니다.";
const telecomNotice = "통신업체의 상담 직원을 자처한 메시지를 받았습니다.";
const financeNotice = "대출을 맡은 은행 담당자 명의로 안내가 왔습니다.";
const investigator = "수사기관을 자칭하는 상대가";
const callback = number => "메시지 본문에 표시된 연락처 " + number + "로만 응답해야 한다는 안내가 있었습니다.";
const background = "피해 사실을 전달한 상담 기록입니다.";

function evaluate(text) {
  return analyze({text, ai: null, urlReputation: null, domainAge: null});
}

for (const [name, text, signal, rule] of [
  ["an actually included, unknown body address from the asserted notice origin",
    utilityNotice + " 본문에 실린 주소는 " + invalidPage + " 였다고 옮겨 적었습니다.", SIG_AGENCY_IMPERSONATION, "R6"],
  ["an actual printed number with a mandatory exclusive reply destination",
    telecomNotice + " " + callback(syntheticNumber), SIG_CALL_THIS_NUMBER, "R6"],
  ["a report explicitly directing physical delivery through an appointed person",
    background + " " + investigator + " 현찰을 준비해 정해 준 방문자에게 직접 전달하는 방식으로 근거 확인에 협조하라고 지시했다고 진술했습니다.",
    SIG_CASH_HANDOVER, "R15"],
  ["the recipient of the cash can precede the cash as a sentence constituent",
    investigator + " 지정한 방문자에게 현금을 직접 전달하는 방식으로 참여하라고 요구한 사실이 기록됐습니다.",
    SIG_CASH_HANDOVER, "R15"],
  ["cash comes after the employee's visit in an outstanding loan repayment report",
    "금융 기관 직원이라고 한 사람이 남은 융자금은 직원이 자택으로 찾아와서 현찰로 회수하는 방식이라고 알렸습니다.",
    SIG_LOAN_CASH_PICKUP, "R18"],
  ["the employee appears before the loan repayment object in one report",
    "은행 직원이라고 한 사람이 담당자가 방문해 대출 상환금을 현금으로 수거하는 방식이라고 알렸습니다.",
    SIG_LOAN_CASH_PICKUP, "R18"],
  ["the cash condition precedes the visiting employee in a connected loan report",
    financeNotice + " 상환액을 현찰로 준비하면 담당 직원이 댁에 방문하여 받아 간다는 내용입니다.",
    SIG_LOAN_CASH_PICKUP, "R18"],
]) {
  test(name, async () => {
    const result = await evaluate(text);
    assert.equal(result.level, "위험");
    assert.ok(result.signals_code.includes(signal));
    assert.ok(result.fired_rules.includes(rule));
  });
}

for (const [name, text, without, expected] of [
  ["ordinary lookup in an existing public institution's domain is not escalated",
    "도서관 자료 안내입니다. 본문에 실린 주소는 " + invalidPage + " 입니다.", SIG_AGENCY_IMPERSONATION, "주의"],
  ["an officially verified host stays distinct from an unknown supplied link",
    utilityNotice + " 본문에 기재된 주소는 " + knownOfficial + " 였다고 적었습니다.", SIG_AGENCY_IMPERSONATION, "확인필요"],
  ["an own reference address is not treated as supplied by the sender",
    utilityNotice + " 안내 내용을 대조하려고 참고용 주소 " + invalidPage + " 를 덧붙였습니다.", SIG_AGENCY_IMPERSONATION, "주의"],
  ["an address described as a sample in the body is still a sample",
    utilityNotice + " 본문에 적힌 페이지는 " + invalidPage + " 였고 예시용이라고 적혀 있었습니다.", SIG_AGENCY_IMPERSONATION, "주의"],
  ["the sender role does not cross an empty line",
    utilityNotice + "\n\n본문에 기재된 주소는 " + invalidPage + " 였습니다.", SIG_AGENCY_IMPERSONATION, "주의"],
  ["an unprinted telephone number is never supplied from context",
    telecomNotice + " 안내에는 본문에 표시된 번호로만 회신하라는 내용이 있었습니다.", SIG_CALL_THIS_NUMBER, "확인필요"],
  ["a short official service number remains outside this rule",
    telecomNotice + " " + callback(knownOfficialNumber), SIG_CALL_THIS_NUMBER, "확인필요"],
  ["the callback is explicitly not a requirement",
    telecomNotice + " 본문에 표시된 번호 " + syntheticNumber + "로만 회신해야 하는 조건은 아니라고 했습니다.", SIG_CALL_THIS_NUMBER, "확인필요"],
  ["an unavailable response route is not an exclusive requirement",
    telecomNotice + " 본문에 표시된 연락처 " + syntheticNumber + "로만 회신할 수 없다는 설명을 덧붙였습니다.", SIG_CALL_THIS_NUMBER, "확인필요"],
  ["a different organization's phone direction stays independent",
    telecomNotice + " 이와 별개로 다른 단체 문자입니다. " + callback(syntheticNumber), SIG_AGENCY_IMPERSONATION, null],
  ["an ordinary contact listing is not an exclusive directive",
    telecomNotice + " 문자에 표시된 번호 " + syntheticNumber + "는 문의처로 적혀 있을 뿐입니다.", SIG_CALL_THIS_NUMBER, "확인필요"],
  ["a closed request is excluded",
    telecomNotice + " " + callback(syntheticNumber) + " 해당 요청은 이미 철회됐습니다.", SIG_CALL_THIS_NUMBER, "확인필요"],
  ["an overseas transaction report omitting the cancellation telephone number",
    "수신 기록에 해외에서 온 승인 통보가 있었음. 본인 결제가 아니면 문자에 쓰인 취소 연락처로 문의하라는 설명만 옮김.",
    SIG_FOREIGN_PAYMENT_CALLBACK, "확인필요"],
  ["an explanation of a cash handover without a current demand remains unclassified",
    investigator + " 현금을 지정한 사람에게 직접 넘기는 방식의 안내문을 참고로 소개했습니다.", SIG_CASH_HANDOVER, "확인필요"],
  ["return of lost property does not become an investigative cash demand",
    investigator + " 분실물 반환 기록에서 현금을 지정한 사람에게 직접 넘기는 방법이 있었다고 말했습니다.", SIG_CASH_HANDOVER, "확인필요"],
  ["the certificate, not a client's loan cash, was collected",
    financeNotice + " 상환금 상담에서 직원이 자택에 방문해 영수증만 받아 간다는 내용입니다.", SIG_LOAN_CASH_PICKUP, "확인필요"],
  ["an ordinary settlement at the branch is outside the visiting employee rule",
    financeNotice + " 대출 상환 문서는 영업점에 제출하고 현금은 금융기관 창구에서 확인한다고 안내했습니다.", SIG_LOAN_CASH_PICKUP, "확인필요"],
  ["cash was only mentioned about a different matter",
    financeNotice + " 상환금 일정이 안내됐습니다. 이와 별개로 다른 행사에서 직원이 현금을 받을 예정이었다고 기록했습니다.", SIG_LOAN_CASH_PICKUP, "확인필요"],
]) {
  test(name, async () => {
    const result = await evaluate(text);
    assert.notEqual(result.level, "위험");
    assert.ok(!result.signals_code.includes(without));
    if (expected) assert.equal(result.level, expected);
    if (text.includes(knownOfficial)) assert.ok(result.signals_code.includes(SIG_OFFICIAL_LINK));
  });
}
