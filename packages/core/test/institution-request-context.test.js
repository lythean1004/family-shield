import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";

const reportedRequests = [
  ["a stated investigative authority designates cash and an officer as its collector", "발신처: 수사 기관\n전달 항목: 현찰\n수령 담당자: 경찰 담당자\n수신자가 직접 전달하는 방법", "R15"],
  ["one sensitive field in a list of reply requirements", "회사라고 밝힌 문의 답장을 받았어요. 저의 계좌번호와 이름을 답장에 적어 달라고 요청한 내용입니다.", "R6"],
  ["prerequisite without a colon", "발신자 표기는 생활 지원 기관이라고 적혀 있어요.\n접속 화면의 요건　개인 기기에 별도 프로그램 설치 필요", "R6"],
  ["password requested inside a quoted form title", "카드사라고 표시된 문의 답신입니다. ‘신원 확인 서식’에는 개인의 카드 비밀번호를 기입해야 한다고 표시됨.", "R6"],
  ["identity material required through a reply", "보건소 담당이라네요. 주민등록번호를 회신란에 기입해야 한다는 요구였어요.", "R6"],
  ["prerequisite in a segmented notice", "발신 표기: 복지 기관 안내실\n열람 요건: 휴대폰에 외부 프로그램 추가 설치", "R6"],
  ["same notice's callback", "학교 행정부서라는 답장이었어요. 본문에 나온 연락처로 통화를 해야만 열람된다고 적혔어요.", "R6"],
  ["sensitive required answer listed as a noun phrase", "관리 회사 명의의 접수 통지였어요. 회신 필수 항목: 제 집 출입 암호", "R6"],
  ["investigative claimant and cash handover entry", "수사관이라는 통지의 일부만 봤습니다.\n전달 수단: 현찰을 방문 직원에게 직접 인계", "R15"],
  ["lender's home visit recorded as the collection method", "융자금 상환 안내 일부입니다.\n징수 방식: 금융회사 직원의 자택 방문 수령(현금)", "R18"],
  ["foreign-origin payment and designated cancellation contact", "[국외발신] 거래 승인 알림\n제가 하지 않은 거래에 대한 취소 접수 연락처: 000-0000-0000", "R19"],
];

for (const [name, text, rule] of reportedRequests) {
  test(name, async () => {
    const verdict = await analyze({ text });
    assert.equal(verdict.level, "위험");
    assert.ok(verdict.fired_rules.includes(rule));
  });
}

const checkedNumber = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" && card.callback_contact?.numbers.length)
  .callback_contact.numbers[0];
const ordinaryNotices = [
  ["the reply field asks if an ID was lost", "발신처: 공단\n회신 항목: 신분증 분실 여부"],
  ["an ID replacement date is requested", "발신처: 도서관\n회신 항목: 신분증 재발급 일정"],
  ["a question about whether an access code was changed", "발신처: 학교\n필수 항목: 현관 비밀번호 변경 여부"],
  ["a club starts speaking in its own name", "발신처: 도서관\n공예 동아리 담당자는 외부 프로그램 설치가 접수 요건이라는 동아리 안내를 읽었습니다."],
  ["an ordinary research group describes a form", "발신처: 일반 조사기관\n전달 항목: 현찰\n수령 담당자: 방문 직원\n수신자가 직접 전달하는 방법"],
  ["ordinary eligibility form with optional identification", "학교라고 표시된 수강 안내입니다. 방문용 양식에 신분증을 지참할지 묻는 항목은 선택입니다."],
  ["reply instructions prohibit including the secret", "관리 회사 명의의 접수 통지였어요. 출입 암호를 답장으로 보내지 말고 다른 사항만 써 달라고 했어요."],
  ["home visit collects paperwork and the branch accepts cash", "융자금 상환 안내입니다. 금융회사 직원이 집에 방문하여 서류만 수거하고 현금 수령은 창구에서 한다고 했어요."],
  ["institution mentioned as a discussion topic", "세무서랑 공단을 비교한 글을 읽었습니다. 제 자료는 필요 없고 글에 없는 사진을 추가하면 좋겠다고 했어요."],
  ["an external program is listed with no installation requirement", "복지 기관이 보낸 회신입니다. 소개 자료의 제목은 외부 앱 설치 안내이고 다운로드는 선택이에요."],
  ["ordinary notices and a different source nearby", "은행 명의의 문서가 도착했어요. 다른 단체에서 보낸 별도 쪽지는 별도 앱 설치가 필수라고 하네요."],
  ["an institution as the destination", "안내문에서 제출 기관은 관리 회사라고 나와 있어요. 내부 검토 대상으로 개인정보 회신 요청을 분류했어요."],
  ["sensitive field removed from a form", "관리 기관 명의 접수 통지예요. 개인 신분 자료는 제외했다고 합니다. 그 대신 공개 서류를 보내야 한다고 적혀 있어요."],
  ["private field in a refused earlier request", "관리 회사라고 적힌 접수 답장에서 내 집 출입 암호가 필수 항목이었다고 합니다. 요청은 이미 거절했어요."],
  ["training sample", "사기 피해 예방 교육입니다. 관리 회사 이름으로 된 회신 예시에는 내 카드 비밀번호가 필수 입력 항목이었다고 합니다."],
  ["no credential is transmitted to the sender", "카드사 담당이라네요. 내가 쓰던 공식 앱의 내 카드 비밀번호를 본인 기기에서 입력해야만 등록된다고 합니다."],
  ["official callback appears in the same sentence", `학교 행정부서라는 통지예요. 본문에 나온 연락처 ${checkedNumber}로 전화를 해야 상담된다는 내용입니다.`],
  ["phone designates a reference instead of a request", "학교 행정부서라는 답장이었어요. 본문에 나온 연락처로 전화를 해야 하는지 내일 점검하기로 했습니다."],
  ["separate topic uses a staff app", "복지 기관 안내실이라고 표시돼요. 별도로 이웃 모임 운영자는 외부 앱 설치가 필요하다는 의견이래요."],
  ["a lost property handover is about recovering one's own money", "수사관이라는 사람이 보낸 분실물 처리 안내예요. 제가 잃어버린 현찰을 방문해 돌려받는 방식이 거기 적혀 있어요."],
  ["loan branch counter cash deposit and staff visit unrelated", "융자금 상환 안내입니다. 직원 방문은 상담만, 영업점 창구에서 현금으로 납부하기는 다른 항목이에요."],
  ["foreign payment notice leaves the cancellation contact blank", "[국외발신] 결제 승인 안내\n신청하지 않은 거래. 취소 창구와 전화번호는 모두 공란입니다."],
  ["a past cancellation and a number intended for a different purpose", "[국외발신] 거래 승인 알림\n제가 하지 않은 거래는 이미 취소됐고, 전화번호는 배송 문의용으로만 표시됩니다."],
];

for (const [name, text] of ordinaryNotices) {
  test(name, async () => {
    const verdict = await analyze({ text });
    assert.notEqual(verdict.level, "위험");
  });
}
