import { isCardCallbackNumber, isCardSenderName } from "./card-sender.js";
import { inspectLinkCandidates } from "./link-candidates.js";
import { isOfficialLink } from "./official-links.js";
import { SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER, SIG_LINK, SIG_PERSONAL_INFO } from "./signals.js";

// 역할 명칭은 문서가 표시한 발신자에 대한 주장이다. 연락처 검증에는 출처 확인 카드만 사용한다.
const INSTITUTION_ROLE = /(?:기관|회사|보험사|카드사|발급사|은행|방송국|(?:시|군|구|도)청|우체국|공단|공사|민원\s*창구|관공서|학교|도서관|병원|보건소)$/;
const DOCUMENT = /(?:안내(?:문)?|알림|공지|쪽지|문자|통지|통보|고지|공문|서류|문서|답장|답신|회신|양식|화면|본문)/;
const SENDER_FIELD = /(?:^|[\s,/|])(?:발행처|발신처|발신자(?:\s*표기)?|(?:보낸|내건)\s*곳)\s*(?:에는|에|은|는|이|가|[:：])?\s*([^,/;|\n]{1,38})/;
const SENDER_REPORT = /([가-힣A-Za-z0-9· -]{1,45}?)(?:에서\s*(?:보낸|왔(?:다|대|다고))|(?:이|가)\s*(?:보냈|올렸|발행했|냈)다는|\s+(?:명의(?:로)?|이름을\s*단)|(?:이라며|라며|이라고\s*밝힌|라고\s*밝힌))(?=[\s,]|$)/g;
const EDUCATION = /(?:피싱|사기|피해|사칭)\s*(?:예방|주의\s*교육|교육|사례)|예방\s*(?:교육|수업)|교육\s*자료|(?:예시|사례)(?:를|로|였|라고|입니다)/;
const SUBJECT_CHANGE = /(?:(?:이와|그와)\s*별개로|별건으로|별도로\s*(?:온|받은|보낸)|한편|다른\s*(?:발신자|쪽지|문자|서류|사람|업체|기관|단체)|지인(?:에게|한테)\s*받은|지난번|예전에)/;
const NO_REQUEST = /(?:하지\s*(?:말|마|않)|되면\s*안|넣으면\s*안|보내면\s*안|안\s*된다고|해야\s*하는\s*게\s*아니|할\s*필요(?:가)?\s*(?:없|없이)|을\s*필요(?:가)?\s*없|필수(?:가)?\s*아니|취소됐|접수(?:가)?\s*완료됐|제출(?:이)?\s*완료됐|이미\s*(?:보냈|제출|설치))/;
const EXTERNAL_APP = /(?:별도(?:의|로)?|추가(?:로)?|외부)\s*(?:앱|어플|애플리케이션|프로그램)(?:을|를)?(?:\s*(?:기기|휴대폰|스마트폰|컴퓨터)에)?\s*설치/;
const INSTALL_FIELD = /(?:필수(?:\s*(?:항목|요건|조건))?\s*(?:에는|은|이|[:：])\s*)$/;
const INSTALL_REQUIRED = /^\s*(?:해야|하라(?:고|는)|(?:가|하는\s*(?:게|것이)|는|이)?\s*(?:(?:이용|확인|열람|신청|접수|진행)\s*)?(?:요건|선행\s*조건|필수|필요하))/;
const OFFICIAL_APP = /(?:공식\s*(?:앱|스토어|마켓|홈페이지)|(?:기존|이미\s*쓰는)\s*앱)/;
const OPTIONAL_INSTALL = /^\s*(?:가|이)?\s*필수(?:가|는|이|은)?\s*아니/;
const STAFF_INSTALL = /(?:운영|관리|직원용|업무용)\s*기기(?:에(?:서|는)?|에서)\s*$/;
const DOCUMENT_NUMBER = /(?:(?:본문|글|통지|안내문?|쪽지|답신|답장|메시지|문자|문서)(?:에\s*(?:적힌|있는|표시된)|\s*속)|(?:회신|통화)(?:용|\s*창구로)?\s*(?:지정된|적힌))\s*(?:(?:별도|지정(?:된)?|전용)\s*)?번호(?:\s*[:：]\s*(?<number>[0-9][0-9 -]{2,15})\s*)?(?:으로|로|에)(?:만)?\s*(?:(?:제가|받은\s*사람이|직접|먼저|별도로)\s*)*(?:회신\s*)?(?:전화|통화)(?:를)?\s*(?:해야|하라는|하라고|해\s*달라|걸어야)/;
const CALLBACK_QUESTION = /^\s*(?:하는지|하는\s*건지|할지|할\s*필요가\s*있는지)/;
const CALLBACK_TEMPLATE = /참고용|표준\s*서식|빈\s*서식|예시\s*문구/;
const RECEIVED_NOTICE = /(?:받(?:은|았|았다|았어|았습|아본)|수신한|(?:에서|쪽에서)\s*(?:보낸|왔(?:다|대|다고))|(?:명의(?:로)?\s*(?:온|답장|답신|회신))|(?:에서|으로)\s*온\s*(?:문서|문자|답장|답신|연락|안내)|문의(?:했|한)\s*(?:뒤|후|는데))/;
const CALLBACK_REPORTED = /(?:적혀|써\s*있|쓰여|표시|명시|(?:라|다)는\s*(?:내용|설명|조건)|한다는|된다고|기재|필수(?:라고|라는)|라고\s*(?:했|해|답했)|하도록\s*안내)/;
const EXCLUSIVE_CALLBACK = /(?:전용|지정(?:된)?)\s*번호(?:로|으로|에)만/;
const OTHER_ORGANIZER = /^(?!(?:이|그|해당|같은)\s)(?:[\p{L}\p{N}·-]{1,12}\s+){0,2}(?:동아리|모임|협회|학회)\s*(?:담당자|운영자|직원)(?:는|가|이|은)(?=\s)/u;
export const startsOtherOrganizer = clause => OTHER_ORGANIZER.test(clause);
const PRIVATE_FIELD = /(?:신분\s*(?:증|자료)|주민\s*등록\s*번호|여권\s*(?:번호|사본)|개인\s*(?:신상|정보)|비공개\s*(?:신상\s*)?(?:서류|자료|정보)|(?:개인|비공개)\s*가족관계\s*(?:자료|서류)|가족관계\s*증명서|카드\s*번호|계좌\s*번호|인증\s*번호|비밀\s*번호)/gu;
const REDACTED_FIELD = /^(?:이|가|은|는)?\s*(?:(?:제거|삭제|마스킹|비식별(?:화)?|익명화)(?:\s*처리)?\s*(?:된|한|됐|했)|가려진)/;
const SENSITIVE_COPY = /^\s*(?:(?:사진|사본|원본|자료)(?:을|를|은|는)?|(?:을|를|은|는))?\s*/;
const SEND_REQUIRED = /^(?:(?:답장|회신)(?:으로|로|에)\s*)?(?:달라|(?:제출|첨부|전송|회신)\s*(?:해야|하라|해\s*달라)|(?:보내|넣어|적어)\s*(?:야|달라|달라고))|^(?:답장|회신)(?:으로|로|에)\s*받아야/;
const REPLY_FIELD = /(?:답장|회신)(?:으로|로|에)\s*(?:(?:넣어|적어)야|(?:첨부|제출)해야)\s*(?:한다는\s*)?(?:자료|항목|서류)(?:는|은|이|가|[:：])\s*(?:(?:제|저의|수신자의)\s*)?$/;
const PRIVATE_REFERENCE = /^(?:그\s*(?:서류|자료|정보|내용|신분증|사본)|그것|이를|해당\s*(?:서류|자료|정보))(?:을|를|은|는|이|가)?(?=[\s,]|$)/;

const PUBLIC_AUTHORITY = /(?:공공[가-힣\s]{0,14}기관|행정(?:\s*기관)?|관공서|(?:시|군|구|도)청|공단|위원회|지방자치단체)$/;
const MUNICIPAL_REPLY = /(?:^|[\s,])(?<sender>(?:시|군|구|도)청|관청|관공서)(?:의|에서\s*온)?\s*민원\s*(?:답신|회신|답장)(?:이라고|이라는|라고|으로)\s*(?:표시|적혀|떠|나와|안내|내용|문서|글)/;
const NOTICE_LINK_FIELD = /(?:배정(?:\s*확인)?|접수|등록|신청|이의\s*제기)(?:\s*(?:업무|확인|절차))?(?:에|을\s*위해|하려면)\s*(?:쓰라(?:는|고\s*적은)|이용하라(?:는|고\s*적은)|사용하라(?:는|고\s*적은)|사용해야\s*할|이용해야\s*할)\s*(?:안내\s*)?(?:링크(?:\s*표시)?|(?:페이지\s*)?주소)(?:는|가|이|[:：])\s*(?<token>\S+)/g;
const ORDINARY_LOOKUP = /(?:도서관|도서\s*대출|열람실|병원|진료|검진|접종|의료|공연\s*좌석|관람|전시)/;
const schoolOffice = /^[\p{L}\p{N}· -]{0,24}학교\s*(?:행정실|회계실)(?:입니다|이에요|이라고\s*표시)/u;
const outstandingFee = /(?:학비|급식비|교재비|교육비|수강료|등록금|공과금|보험료|세금)(?:가|이)?\s*(?:미납|체납|연체)/u;
const paymentAddress = /(?:납부|결제)\s*(?:(?:요청|전용)\s*)?(?:(?:주소|링크)(?:는|가|[:：])?|바랍니다)\s+(?<token>\S+)/gu;
const feeContinuation = /^(?:(?:(?:금일|오늘|당일|기한)(?:\s*(?:중|내|까지))?|(?:미납액|미납금|해당\s*(?:금액|요금))(?:을|은)?)\s*){0,2}(?:납부|결제)/u;
const instructionalExample = /(?:예시|예문).{0,24}(?:수업|교육|교재)|(?:교재|수업|교육).{0,24}(?:예시|예문)/u;
const MUNICIPAL_PRIVATE_FIELD = /(?<owner>(?:제|저의|민원인의|수신자의)\s+)?(?:신상\s*(?:자료|정보)|신분증(?:\s*(?:사진|사본))?|가족관계\s*증명서|주민\s*등록\s*번호)(?:은|는|을|를)?\s*(?:이|같은|해당|현재)\s*(?:대화|채팅|문자|메시지)(?:로|으로|에)\s*(?:(?<direction>받아|보내|넣어|올려)야|(?:제출|첨부|전송)해야)\s*(?:민원\s*)?(?:접수|처리)(?:가|를)?\s*(?:끝|마무리|마치|완료|진행)/;

const MUNICIPAL_ANONYMOUS_FILE = /(?:비식별(?:화)?|가명\s*처리|익명\s*처리|(?:개인정보|신상\s*(?:자료|정보))(?:를|가)?\s*(?:제거|삭제|가림)|(?:개인정보|신상\s*정보)(?:가)?\s*없는)/;
const DISCLOSURE_RECIPIENT = /(?:제가|수신자가|민원인이)\s*$/;

function requiresMunicipalDisclosure(clause) {
  const request = MUNICIPAL_PRIVATE_FIELD.exec(clause);
  if (!request || MUNICIPAL_ANONYMOUS_FILE.test(clause)) return false;
  if (request.groups.direction !== "받아") return true;
  // '받아야'의 주어가 생략돼도 민원인이 자신의 자료를 대화에서 회신하라는 경우만 받는다.
  return Boolean(request.groups.owner) && !DISCLOSURE_RECIPIENT.test(clause.slice(0, request.index));
}

function institutionName(value) {
  const name = value.trim().replace(/(?:이?라고\s*(?:적혀|표시돼|나와|써\s*있).*$|(?:이에요|예요|입니다)$)/, "");
  return isCardSenderName(name) || INSTITUTION_ROLE.test(name) ? name : "";
}

function noticeSender(clause, previous) {
  const municipal = MUNICIPAL_REPLY.exec(clause);
  if (municipal) return municipal.groups.sender;
  const field = SENDER_FIELD.exec(clause);
  const fieldName = field && institutionName(field[1]);
  if (fieldName) return fieldName;
  for (const match of clause.matchAll(SENDER_REPORT)) {
    const name = institutionName(match[1]);
    if (name && (DOCUMENT.test(clause.slice(match.index + match[0].length)) || DOCUMENT.test(previous))) return name;
  }
  return "";
}

function hasDesignatedLink(clause, fieldPattern, unverifiedLinks) {
  if (unverifiedLinks.size === 0) return false;
  return [...clause.matchAll(fieldPattern)].some(field => {
    const { candidates, complete } = inspectLinkCandidates(field.groups.token);
    const candidate = candidates[0];
    // 한 필드의 전체 토큰을 다시 확인해 상위 추출에서 얻은 후보와 같은 원문만 인정한다.
    return complete && candidates.length === 1 && candidate.complete &&
      ["http:", "https:"].includes(candidate.protocol) &&
      unverifiedLinks.has(candidate.raw) && !isOfficialLink(candidate.raw);
  });
}

function demandsFeeAtLink(clauses, index, unverifiedLinks) {
  if (!unverifiedLinks.size) return false;
  let outstanding = false;
  for (const [offset, clause] of clauses.slice(index, index + 3).entries()) {
    if (SUBJECT_CHANGE.test(clause) || startsOtherOrganizer(clause) || NO_REQUEST.test(clause) || EDUCATION.test(clause) ||
        instructionalExample.test(clause) || (offset && noticeSender(clause, ""))) break;
    const sameFee = outstandingFee.test(clause);
    if (sameFee) outstanding = true;
    if (outstanding && (sameFee || feeContinuation.test(clause)) && hasDesignatedLink(clause, paymentAddress, unverifiedLinks)) return true;
  }
  return false;
}

function privateFields(clause) {
  return [...clause.matchAll(PRIVATE_FIELD)].filter(match =>
    !REDACTED_FIELD.test(clause.slice(match.index + match[0].length)));
}

function actionIn(clause, previous, attributionContext) {
  if (EDUCATION.test(clause) || NO_REQUEST.test(clause)) return null;
  const install = EXTERNAL_APP.exec(clause);
  if (install && !OFFICIAL_APP.test(clause)) {
    const before = clause.slice(0, install.index);
    const after = clause.slice(install.index + install[0].length);
    if (!STAFF_INSTALL.test(before) && !OPTIONAL_INSTALL.test(after) &&
        (INSTALL_FIELD.test(before) || INSTALL_REQUIRED.test(after))) return SIG_APP_INSTALL;
  }
  const callback = DOCUMENT_NUMBER.exec(clause);
  if (callback) {
    const number = callback.groups.number;
    const after = clause.slice(callback.index + callback[0].length);
    if (!isCardCallbackNumber(number) && !CALLBACK_QUESTION.test(after) &&
        (!CALLBACK_TEMPLATE.test(clause) && (number || CALLBACK_REPORTED.test(after) && (RECEIVED_NOTICE.test(attributionContext) || EXCLUSIVE_CALLBACK.test(callback[0]))))) return SIG_CALL_THIS_NUMBER;
  }
  for (const secret of privateFields(clause)) {
    if (REPLY_FIELD.test(clause.slice(0, secret.index)) ||
        SEND_REQUIRED.test(clause.slice(secret.index + secret[0].length).replace(SENSITIVE_COPY, ""))) return SIG_PERSONAL_INFO;
  }
  const reference = PRIVATE_REFERENCE.exec(clause);
  return reference && privateFields(previous).length && SEND_REQUIRED.test(clause.slice(reference[0].length).trimStart())
    ? SIG_PERSONAL_INFO : null;
}

export function addReportedNoticeFields(text, signals, { unverifiedLinks = [] } = {}) {
  const outside = new Set(unverifiedLinks);
  const clauses = text.split(/[.!?。]+(?=\s|$)|[\r\n]+/u).map(clause => clause.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    const previous = clauses[index - 1] ?? "";
    if (EDUCATION.test(previous) || EDUCATION.test(clause) || SUBJECT_CHANGE.test(clause)) continue;
    const sender = noticeSender(clause, previous);
    if ((sender || schoolOffice.test(clause)) && demandsFeeAtLink(clauses, index, outside)) {
      signals.add(SIG_AGENCY_IMPERSONATION);
      signals.add(SIG_LINK);
    }
    if (!sender) continue;
    const boundClauses = [clause];
    const next = clauses[index + 1];
    if (next && !SUBJECT_CHANGE.test(next) && !OTHER_ORGANIZER.test(next) && !noticeSender(next, clause)) boundClauses.push(next);
    for (const [offset, body] of boundClauses.entries()) {
      if (EDUCATION.test(body) || NO_REQUEST.test(body) || OTHER_ORGANIZER.test(body)) continue;
      const signal = actionIn(body, offset ? clause : "", previous + " " + clause);
      if (signal) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(signal);
      }
      if (PUBLIC_AUTHORITY.test(sender) && !ORDINARY_LOOKUP.test(clause + " " + body) && hasDesignatedLink(body, NOTICE_LINK_FIELD, outside)) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(SIG_LINK);
      }
      if (MUNICIPAL_REPLY.test(clause) && requiresMunicipalDisclosure(body)) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(SIG_PERSONAL_INFO);
      }
    }
  }
}
