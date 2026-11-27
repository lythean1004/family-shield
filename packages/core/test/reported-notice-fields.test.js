import assert from "node:assert/strict";
import test from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { analyze } from "../src/pipeline.js";
import { addReportedNoticeFields } from "../src/reported-notice-fields.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER, SIG_LINK, SIG_OFFICIAL_LINK, SIG_PERSONAL_INFO } from "../src/signals.js";

const knownContact = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" && card.callback_contact?.numbers.length)
  .callback_contact.numbers[0];

const riskCases = [
  ["binds adjacent form fields without a narrator", SIG_APP_INSTALL,
    "발행처: 장학 기관\n열람 전 필수 조건: 외부 프로그램 설치"],
  ["claims the document issuer and names an external installation requirement", SIG_APP_INSTALL,
    "도서 대출권 고지 화면을 살펴봤어요. 발행처는 구청, 신청 전 필수 항목에는 별도의 앱 설치가 나와 있었습니다."],
  ["reports a program as the same notice's prerequisite in another sentence", SIG_APP_INSTALL,
    "장학 업무 기관이 올렸다는 공지를 읽었습니다. 별도 프로그램을 기기에 설치하는 게 열람 요건이라네요."],
  ["reports an obligation to call the number designated in the same document", SIG_CALL_THIS_NUMBER,
    "택배 회사 명의로 온 안내문입니다. 그 안내문에 적힌 번호로 전화를 해야 처리가 된다는 설명이에요."],
  ["reports required private identification in a reply field", SIG_PERSONAL_INFO,
    "수강 변경 안내에서 발신처는 교육 기관, 회신에 첨부해야 한다는 자료는 제 신분증 사본이에요."],
  ["ties the referenced private document to a required reply in the next sentence", SIG_PERSONAL_INFO,
    "공단 이름을 단 답신에서 제 비공개 신상 서류가 필요하대요. 그 서류를 답장으로 받아야 한다는 뜻이었습니다."],
];

const ordinaryCases = [
  ["a number checked against an official evidence card", `보험사 명의로 온 공지예요. 그 안내문에 적힌 번호: ${knownContact}로 전화해야 확인된다네요.`],
  ["install is optional and the reservation time is required", "구청 명의로 온 공지예요. 별도 앱 설치 없이 예약 정보를 적으면 되며 원하는 방문 시각은 필수라고 했어요."],
  ["new version of an existing program", "박물관 기관에서 보낸 안내문입니다. 새 앱 설치가 필요하고 기존 버전은 다음 주부터 열리지 않는대요."],
  ["only a regular reply field is required", "공단이 보냈다는 공지의 설명이에요. 제 신분증 사본은 제시할 수 있고 답장에는 이름 이니셜만 적어야 한대요."],
  ["another source introduced in the next sentence", "구청에서 보낸 안내문을 읽었어요. 한편 동호회 접수에는 별도 앱 설치가 필수라고 적혀 있네요."],
  ["completed intake", "회사 명의로 온 안내문을 읽었어요. 예전에 신분증을 제출한 접수가 완료됐다는 결과입니다."],
  ["prevention education", "피해 예방 교육에서 다룬 안내문이에요. 공단 명의로 온 알림에서 별도 앱 설치가 필수라는 사례를 읽었어요."],
  ["another sender", "구청에서 보낸 안내를 봤습니다. 이와 별개로 다른 발신자가 보낸 쪽지는 별도 앱 설치가 필수라고 하네요."],
  ["another number", "구청에서 보낸 안내를 읽었어요. 안내문에 적힌 번호 대신 기존 연락처로 전화해야 한다네요."],
  ["original official contact", "보험사 명의로 온 공지예요. 그 안내문에 적힌 공식 대표번호로 전화해야 확인된다네요."],
  ["official app", "복지 기관이 보냈다는 안내문입니다. 본인 기기의 공식 앱에서 열람해야 한다고 적혀 있어요."],
  ["existing app", "복지 기관이 보냈다는 공지예요. 별도 앱을 설치해야 하는 게 아니라 본인 기기의 기존 앱에서 봤어요."],
  ["health contact", "보건 기관이 보냈다는 안내문을 받았어요. 기존 간호 상담 번호로 전화해야 일정이 확인된다는 설명이에요."],
  ["disclosure prohibited", "구청이 보냈다는 안내를 봤습니다. 제 신분증 사본은 답장에 넣으면 안 된다고 적혀 있어요."],
  ["named as the destination, not the issuer", "배움터 안내문입니다. 제출처는 기관, 별도의 앱 설치가 필수라고 적혀 있었습니다."],
  ["non-sensitive form field", "도서관에서 보낸 안내문이에요. 원하는 독서 시간대를 답장으로 받아야 배정을 한대요."],
  ["displayed number as an example", "보험사에서 보낸 공지예요. 그 글에 적힌 번호는 예시였고 원래 연락처로 전화해야 한다네요."],
  ["separate unrelated paperwork", "시청에서 보낸 안내예요. 신청을 했습니다. 두 달 전에 지인에게 받은 서류에는 제 신분증 사본을 답장해야 했어요."],
];

for (const [name, signal, text] of riskCases) {
  test(name, async () => {
    const { signals } = extractCodeSignals(text);
    assert.deepEqual([SIG_AGENCY_IMPERSONATION, signal].filter(item => !signals.includes(item)), []);
    const verdict = await analyze({ text });
    assert.ok(verdict.fired_rules.includes("R6"));
  });
}

for (const [name, text] of ordinaryCases) {
  test(name, async () => {
    const verdict = await analyze({ text });
    assert.ok(!verdict.fired_rules.includes("R6"));
  });
}

const outsideAddress = "https://notice.example.invalid/room";
const publicNotice = "공공 시설 관리기관에서 보낸 배정 안내를 확인했어요. 다음 시설 접수에 이용하라는 주소는 ";

test("a public sender designates the whole unverified address for the stated service", async () => {
  const verdict = await analyze({ text: publicNotice + outsideAddress + " 라고 표시돼 있어요.", ai: null });
  assert.ok(verdict.signals_code.includes(SIG_LINK));
  assert.ok(verdict.fired_rules.includes("R6"));
});

test("the designation also binds a complete address with a query", async () => {
  const verdict = await analyze({ text: publicNotice + outsideAddress + "?view=summary 라고 표시돼 있어요.", ai: null });
  assert.ok(verdict.fired_rules.includes("R6"));
});

test("a partial match in the parser input never counts as the designated address", () => {
  const signals = new Set([SIG_LINK]);
  addReportedNoticeFields(publicNotice + outsideAddress + " 라고 표시돼 있어요.", signals,
    { unverifiedLinks: ["https://notice.example.invalid"] });
  assert.deepEqual([...signals], [SIG_LINK]);
});

test("an official address can be the exact designated destination", async () => {
  const evidenceHost = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" &&
    card.official_domains.includes("hometax.go.kr")).official_domains.find(host => host === "hometax.go.kr");
  const verdict = await analyze({ text: publicNotice + "https://" + evidenceHost + " 라고 표시돼 있어요.", ai: null });
  assert.ok(verdict.signals_code.includes(SIG_OFFICIAL_LINK));
  assert.ok(!verdict.fired_rules.includes("R6"));
});

const addressControls = [
  ["an ordinary library renewal lookup", "공공기관에서 보낸 도서관 안내문이에요. 대출 연장 조회에 쓰라는 안내 주소는 "],
  ["an ordinary hospital appointment lookup", "시청에서 보낸 병원 안내예요. 진료 예약 확인에 이용하라는 조회 주소는 "],
  ["a separate resource added to a city notice", "시청에서 보낸 배정 공지를 읽었어요. 접수는 현장 방문으로 한다는 뜻이고, 다른 단체가 제공한 참고 주소는 "],
  ["an action that applies to a different location", "공공기관이 보냈다는 시설 문서예요. 신청은 안내문 속 창구에 접수하라는 내용이고, 외부 소개 페이지는 "],
  ["different actual issuer", "공공기관에서 보낸 첨부 안내문이에요. 다른 기관에서 보낸 문서에 따로 시설 접수에 쓰라는 주소는 "],
];

for (const [name, text] of addressControls) {
  test(name, async () => {
    const verdict = await analyze({ text: text + outsideAddress + " 입니다.", ai: null });
    assert.ok(!verdict.fired_rules.includes("R6"));
  });
}

test("a municipal reply says the same conversation needs sensitive personal records before intake ends", async () => {
  const text = "시청 민원 회신이라는 안내를 읽었습니다. 제 신상 정보를 이 채팅으로 보내야 민원 처리가 마무리된다고 적혀 있어요.";
  const verdict = await analyze({ text, ai: null });
  assert.ok(verdict.signals_code.includes(SIG_PERSONAL_INFO));
  assert.ok(verdict.fired_rules.includes("R6"));
});

const disclosureControls = [
  ["a different recipient", "구청 민원 회신으로 표시돼요. 제 신상 정보를 별개 동호회에 보내야 신청이 끝난다고 합니다."],
  ["a different form field", "시청 민원 답신이라고 표시돼요. 제 신상 자료는 보관만 하고, 희망 시간대를 이 대화로 보내야 접수가 마무리된다고 적혀 있어요."],
  ["a completion entry", "시청 민원 회신이라는 내용이에요. 제 신상 정보를 이 채팅으로 보낸 뒤 민원 처리가 완료됐다고 적혀 있어요."],
  ["a public description of unsafe requests", "사기 예방 교육 자료의 시청 민원 회신이라고 표시돼요. 제 신상 자료를 이 대화로 받아야 접수가 끝난다고 적힌 예시입니다."],
];

for (const [name, text] of disclosureControls) {
  test(name, async () => {
    const verdict = await analyze({ text, ai: null });
    assert.ok(!verdict.fired_rules.includes("R6"));
  });
}
test("an unrelated external URL cannot turn a designated official address into a risk", async () => {
  const text = publicNotice + "https://hometax.go.kr 라고 표시돼 있어요. 별도 전시 자료는 " + outsideAddress + " 입니다.";
  const verdict = await analyze({ text, ai: null });
  assert.ok(verdict.signals_code.includes(SIG_LINK));
  assert.ok(!verdict.fired_rules.includes("R6"));
});

test("a municipal notice describes the in-conversation receipt of the addressee's own record", async () => {
  const text = "군청 민원 답신이라고 나와 있어요. 저의 신상 정보를 이 채팅에 받아야 처리가 완료된다는 내용입니다.";
  const verdict = await analyze({ text, ai: null });
  assert.ok(verdict.fired_rules.includes("R6"));
});

for (const [name, body] of [
  ["the addressee receives their own record", "제가 제 신상 자료를 이 채팅으로 받아야 접수가 끝난다고 써 있어요."],
  ["a de-identified record", "비식별 처리한 신상 자료를 이 채팅으로 보내야 처리가 끝난다고 써 있어요."],
]) {
  test(name, async () => {
    const text = "군청 민원 답신이라고 나와 있어요. " + body;
    const verdict = await analyze({ text, ai: null });
    assert.ok(!verdict.fired_rules.includes("R6"));
  });
}
const noticeFieldControls = [
  ["generic callback template", "발행처: 교육 기관 / 아직 연락처가 빈 표준 서식이에요. 문서에 적힌 번호로 전화해야 한다는 문장은 참고용이라고 표시돼 있어요."],
  ["uncertain callback", "학교 명의로 받은 안내예요. 안내문에 적힌 번호로 통화해야 하는지 문의 창구로 확인 중입니다."],
  ["identity document collected by the recipient", "발행처: 관공서 / 방문할 때 창구에서 신분증 원본을 받아야 인수 처리가 끝납니다."],
  ["public material after data removal", "발행처: 대학교 / 회신으로 첨부해야 한다는 자료는 개인정보가 제거된 공개 확인서입니다."],
  ["an optional extra app", "발행처: 구청 / 별도 앱 설치가 필수는 아니고, 기존 웹으로 일정을 볼 수 있어요."],
  ["a staff-only device", "발행처: 학교 / 운영 기기에서 별도 프로그램 설치가 필수라는 전산팀 설명을 직원 교육에 기록했어요."],
  ["an unrelated participant in the next sentence", "발행처: 도서관 / 휴관일을 알려 주는 공지예요. 독서 동아리 운영자는 별도 앱을 설치해야 한다고 동아리 활동을 설명했어요."],
];

for (const [name, text] of noticeFieldControls) {
  test(name, async () => {
    const verdict = await analyze({ text, ai: null });
    assert.ok(!verdict.fired_rules.includes("R6"));
  });
}

test("a document assigns an exclusive callback as a condition even when its number is omitted from the summary", async () => {
  const text = "발행처: 관공서 / 접수 요약에는 답장 속 전용 번호로만 전화해야 처리가 된다는 설명이 적혀 있습니다.";
  const verdict = await analyze({ text, ai: null });
  assert.ok(verdict.fired_rules.includes("R6"));
});