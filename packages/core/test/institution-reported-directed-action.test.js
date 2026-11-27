import assert from "node:assert/strict";
import test from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import {
  SIG_AGENCY_IMPERSONATION, SIG_CALL_THIS_NUMBER, SIG_CASH_HANDOVER, SIG_FOREIGN_PAYMENT_CALLBACK,
  SIG_LOAN_CASH_PICKUP, SIG_OFFICIAL_LINK,
} from "../src/signals.js";

const exampleAddress = "https://reading.example.invalid";
const knownOfficialAddress = "https://www.hometax.go.kr";
const publicReader = "공공 통지 담당자라고 밝힌 발신자가";
const telecomSender = "메시지 보낸 이가 통신사 가입 담당자라고 밝혔습니다.";
const repliesWithDocument = "신분증 사본을 같은 메시지 답장으로 첨부하라는 내용이 있었습니다.";
const investigativeSender = "수사기관을 자처한 상대가";
const financialSender = "금융 회사 상담 직원이라는 사람이";
const loanSummary = "대출금 상환액을 현찰로 준비해서 방문 담당자에게 전달";
const reportHeading = "기록 유형: 메시지 상담";
const displayedLoanRole = "발신자 소속: 금융 회사 대출 담당자";
const documentedRequest = "요청 내용: " + loanSummary;

function evaluate(text) {
  const { signals } = extractCodeSignals(text);
  const decision = decide({ signals_final: signals, signals_code: signals });
  return { signals, ...decision };
}

for (const [name, input, signal, rule] of [
  ["a reported direction to the exact unverified address for a notice document",
    publicReader + " 서류 내용은 " + exampleAddress + " 에서 열람하라는 설명을 했습니다.", SIG_AGENCY_IMPERSONATION, "R6"],
  ["an explicitly identified sender's request for a specific private document in the same written reply",
    telecomSender + " " + repliesWithDocument, SIG_AGENCY_IMPERSONATION, "R6"],
  ["a report of face-to-face cash delivery explicitly assigned to the recipient",
    investigativeSender + " 확인 절차의 일부로 받은 사람이 담당자를 만나 현찰을 건네야 한다고 적었습니다.", SIG_CASH_HANDOVER, "R15"],
  ["a nominal reported demand for handing over cash face to face",
    "신고 메모. " + investigativeSender + " 대면으로 현금 전달을 요구한 일로 기록했습니다. 수신자는 전달하지 않았습니다.", SIG_CASH_HANDOVER, "R15"],
  ["the sender's announced visit to collect a borrower's cash repayment",
    financialSender + " 대출금 상환액을 현찰로 방문해서 회수하겠다고 밝혔습니다.", SIG_LOAN_CASH_PICKUP, "R18"],
  ["one summary with separate sender and cash collection fields",
    [reportHeading, displayedLoanRole, documentedRequest].join(" / "), SIG_LOAN_CASH_PICKUP, "R18"],
  ["one summary with reordered cash collection and sender fields separated by fullwidth bars",
    [reportHeading, documentedRequest, displayedLoanRole].join("｜"), SIG_LOAN_CASH_PICKUP, "R18"],
]) {
  test(name, () => {
    const result = evaluate(input);
    assert.equal(result.level, "위험");
    assert.ok(result.signals.includes(signal));
    assert.ok(result.fired_rules.includes(rule));
  });
}

for (const [name, input, without, expected] of [
  ["an address marked as a counseling reference with no chosen destination",
    publicReader + " 통지 내역의 예시용 주소 " + exampleAddress + " 를 적었다는 기록입니다.", SIG_AGENCY_IMPERSONATION, "주의"],
  ["an independently recognized official address used for ordinary document reading",
    publicReader + " 서류 내용은 " + knownOfficialAddress + " 에서 열람하라는 설명을 했습니다.", SIG_AGENCY_IMPERSONATION, "확인필요"],
  ["a routine notice's official host remains independently recognized",
    "신고 자료 확인 안내 " + knownOfficialAddress, SIG_AGENCY_IMPERSONATION, "확인필요"],
  ["an unrelated address in a separate sentence does not become the reading route",
    publicReader + " 서류를 이미 확인했다고 기록했습니다. 이와 별개로 보기 편한 참고 주소는 " + exampleAddress + " 입니다.", SIG_AGENCY_IMPERSONATION, "주의"],
  ["a distinct sender in the reply passage",
    telecomSender + " 이와 별개로 다른 사람의 메시지에는 " + repliesWithDocument, SIG_AGENCY_IMPERSONATION, null],
  ["a report that only discusses how identity information is stored",
    telecomSender + " 안내에는 지난달 정보 보관 방식이 변경됐다는 내용만 있었습니다.", SIG_AGENCY_IMPERSONATION, "확인필요"],
  ["a closed privacy requirement",
    telecomSender + " " + repliesWithDocument + " 해당 요구를 이미 철회했습니다.", SIG_AGENCY_IMPERSONATION, null],
  ["a classroom example about an investigative role and a cash handover",
    "예방 교육 자료에서 수사기관을 자처한 상대가 대면 현금 전달을 요구한 것으로 예시를 기록했습니다.", SIG_CASH_HANDOVER, "확인필요"],
  ["sources that only describe a return of lost property",
    investigativeSender + " 요청한 대면 현금 인계는 분실물 반환을 뜻합니다.", SIG_CASH_HANDOVER, "확인필요"],
  ["a cash mention whose stated receiver is not the action performer",
    investigativeSender + " 수신자가 들은 설명은 담당자가 직원을 만나 현찰을 건네야 한다는 말이었습니다.", SIG_CASH_HANDOVER, "확인필요"],
  ["a loan payment already resolved at a branch",
    financialSender + " 지난번 상환금은 영업점에서 이미 납부됐다고 설명했습니다.", SIG_LOAN_CASH_PICKUP, "확인필요"],
  ["a visit of a bank employee without cash collection",
    financialSender + " 대출 상환 영수증을 수거하러 방문한다고 기록했습니다.", SIG_LOAN_CASH_PICKUP, "확인필요"],
  ["disconnected sender and cash fields in separate records",
    reportHeading + " / " + displayedLoanRole + "\n다른 발신자 / " + documentedRequest, SIG_LOAN_CASH_PICKUP, "확인필요"],
  ["a printed cash field marked as no handover",
    [reportHeading, displayedLoanRole, documentedRequest + " 없음"].join(" / "), SIG_LOAN_CASH_PICKUP, "확인필요"],
  ["a reported callback whose suggested number is absent",
    "보험사 담당자라고 밝힌 발신인이 안내에 쓰인 연락처로 통화하라는 이야기를 했습니다. 번호는 기록하지 않았습니다.", SIG_CALL_THIS_NUMBER, "확인필요"],
  ["a reported unauthorized overseas transaction with no actual cancellation number in the record",
    "수신 기록｜해외 발신 결제 승인 표기｜본인 거래가 아니면 별도 취소 창구에 연락하라는 설명｜전화번호 공란", SIG_FOREIGN_PAYMENT_CALLBACK, "확인필요"],
]) {
  test(name, () => {
    const result = evaluate(input);
    assert.notEqual(result.level, "위험");
    assert.ok(!result.signals.includes(without));
    if (expected) assert.equal(result.level, expected);
    if (input.includes(knownOfficialAddress)) assert.ok(result.signals.includes(SIG_OFFICIAL_LINK));
  });
}
