import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";

const url = "https://appointment.example.invalid/confirmation";
const known = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" && card.official_domains.includes("hometax.go.kr")).official_domains[0];
const verified = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" && card.callback_contact?.numbers.length).callback_contact.numbers[0];
const positives = [
  ["a claimed civil office directs an appointment action to its unverified destination", "민원 창구 담당이라고 자신을 소개한 발신자의 쪽지가 왔어요. 상담 예약 내역은 " + url + " 에서 확인하라는 내용이었습니다.", "R6"],
  ["the notice requires a callback through its own number instead of a saved contact", "금융 감독기관 담당이라는 안내라고 적혀 있어요. 저장해 둔 문의처 대신 이 안내문에 적힌 번호로 통화하라는 요구를 받아 메모합니다.", "R6"],
  ["a field describes an installation requested by the claimed sender", "받은 통지의 표시 사항입니다.\n보낸 곳 | 민원 창구 기관 실무자\n해야 할 일 | 원격 제어 프로그램 설치", "R6"],
  ["a stated public insurance process requires additional installation by the addressee", "공공보험 업무 창구 담당이라며 자기 소개가 적힌 쪽지를 수신했습니다. 검토를 이어가려면 별도의 프로그램 설치가 필요하다는 요구였어요.", "R6"],
  ["a reported prerequisite carries its request force without an explicit request noun", "공공보험 담당 창구에서 발송한 안내라는 설명을 들었어요. 접수를 계속하려면 외부 소프트웨어 설치가 필요하다고 표시돼 있었습니다.", "R6"],
  ["a claimed fiscal office requests several identifiers in the same reply", "세무 업무 담당이라고 스스로 밝혔다는 안내를 받았어요. 답장에 저의 생년월일과 성명을 기입하라는 요구가 적혀 있었습니다.", "R6"],
  ["a claimed investigator asks for an in-person handover of the addressee's own cash", "수사기관 관계자라고 자신을 소개한 발신자의 회신입니다. 제가 보유한 현찰을 직접 인계하도록 요구했다는 요지를 기록했습니다.", "R15"],
  ["a named staff recipient is the destination of an investigative handover", "수사기관이라 밝힌 발신자가 현찰을 준비한 뒤 이후 만나는 담당자에게 직접 인계하라는 요구를 남겼다고 기록했습니다. 장소와 시각은 생략했습니다.", "R15"],
  ["typed fields can obtain the loan subject from their heading while requiring repayment in a field", "받은 융자 안내 중 항목 요약입니다.\n보낸 사람: 금융기관 직원\n상환 수단: 현찰\n회수 방식: 직원이 직접 방문해 수령한다고 적힘", "R18"],
  ["typed fields tie a purported lender's staff visit to cash repayment", "수신한 상환 안내의 내용만 옮겨 적습니다.\n발신처: 금융회사 상담 직원\n처리 목적: 대출금 상환\n회수 방법: 현찰을 직원이 방문하여 수령", "R18"],
];

const controls = [
  ["an employee's device is not the recipient's device", "받은 문서 중 일부만 옮겼습니다.\n발신처: 복지 기관 운영 창구\n해야 할 일: 담당자 개인 기기에 원격 지원 앱 설치"],
  ["ordinary public library lookups follow the existing exception", "시청 도서관 지원 담당이라고 소개하는 안내를 받았어요. 도서관 대출 예약 내역은 " + url + " 에서 확인하라는 내용만 적혔습니다."],
  ["a model reply demonstrates information without requesting it", "세무 업무 담당이라고 소개하는 안내를 받았어요. 답장에 제 생년월일과 성명을 기입하라는 문구는 예시였고 실제 회신 요구는 없습니다."],
  ["the confirmed official destination remains exempt", "민원 창구 담당이라고 자신을 소개한 발신자의 쪽지가 왔어요. 상담 예약 내역은 https://" + known + " 에서 확인하라는 내용이었습니다."],
  ["the confirmed official number remains exempt", `금융기관 담당이라는 안내를 읽었어요. 기존 문의처 말고 이 문자에 적힌 번호 ${verified}로 통화하라는 내용으로, 카드에서 확인한 창구였습니다.`],
  ["unrelated archive link accompanies an ordinary update", "민원 창구의 안내라고 소개한 발신자가 문의 시간을 정정했어요. 접수는 직접 방문하고 외부 참고 자료 주소는 " + url + " 라고 표시돼요."],
  ["a separate organizer owns the installation requirement", "민원 창구 담당이라고 자기 소개가 적힌 통지를 받았습니다. 한편 독서 모임 담당자는 별도 프로그램 설치가 필요하다고 적었어요."],
  ["the installation applies to a staff device", "받은 안내의 표시 사항입니다.\n보낸 곳 | 복지 기관 담당\n해야 할 일 | 직원용 기기에 원격 지원 앱 설치"],
  ["a rejected requirement is closed", "공공보험 업무 담당이라고 소개한 안내가 왔습니다. 심사를 이어가려면 외부 앱 설치가 필요하다고 적혀 있었어요. 그 요청은 이미 거절했습니다."],
  ["a formal branch counter receives ordinary payments", "수신한 대출 상환 안내를 옮겨 둡니다.\n발신처: 금융회사 상담 직원\n처리 목적: 대출금 상환\n납부 방식: 현찰은 영업점 창구에 납부하고 직원 방문은 서류 확인만 합니다."],
  ["cash flows back to the recipient", "수사기관 관계자라고 자신을 소개한 발신자의 회신이에요. 이미 보관됐던 현찰을 제가 직원에게서 돌려받는다는 기록만 남겼습니다."],
  ["supposed investigator explicitly withdraws the transfer", "수사기관이라 밝힌 발신자가 제 현찰을 직원에게 직접 건네라는 요구를 남겼어요. 해당 요청은 이미 철회됐습니다."],
  ["visiting staff collect cash for a different topic outside the repayment block", "받은 융자 안내의 일부를 옮겼습니다.\n보낸 사람: 금융기관 직원\n상환 수단: 창구에서 결제\n새로 받은 조합 공지\n수거 방식: 직원이 직접 방문해 현찰을 수령한다고 적힘"],
  ["the bank's visitor collects only paperwork", "수신한 대출 안내를 옮겨 둡니다.\n보낸 곳: 금융회사 직원\n처리 목적: 대출금 상환\n받는 방법: 직원이 방문하여 관련 서류를 수령하고 현금은 지점에서 접수합니다."],
  ["do not reply with the named private information", "세무 업무 담당이라고 소개한 안내를 받았어요. 답장에 저의 생년월일과 성명을 기입하지 말고 날짜만 알려 달라는 내용이었습니다."],
];
for (const [name, text, rule] of positives) {
  test(name, async () => assert.ok((await analyze({ text, ai: null })).fired_rules.includes(rule)));
}
for (const [name, text] of controls) {
  test(name, async () => assert.notEqual((await analyze({ text, ai: null })).level, "위험"));
}
