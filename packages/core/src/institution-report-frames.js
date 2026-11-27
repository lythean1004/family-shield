import { isCardCallbackNumber } from "./card-sender.js";
import { INVESTIGATIVE } from "./cash-handover.js";
import { inspectLinkCandidates } from "./link-candidates.js";
import { hasOpenInstallationReport, ORDINARY_LOOKUP, startsOtherOrganizer } from "./reported-notice-fields.js";
import { currentReceivedRequests, isReceivedContinuation } from "./received-message.js";
import {
  SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER, SIG_CASH_HANDOVER,
  SIG_LINK, SIG_LOAN_CASH_PICKUP, SIG_PERSONAL_INFO,
} from "./signals.js";

const authority = String.raw`(?:${INVESTIGATIVE}|수사\s*기관|(?:금융\s*)?감독\s*기관|(?:시|군|구|도)청|관공서|공공\s*(?:기관|보험)|민원\s*(?:창구|접수(?:처|\s*부서)?|조정\s*기관)|(?:세금|세무(?:\s*(?:기관|서))?|과세)|(?:금융\s*(?:기관|회사)|은행)|(?:복지|행정)\s*기관)`;
const issuerLabel = new RegExp(String.raw`^(?<role>${authority})(?=\s|$)`, "u");
const declaredAuthority = new RegExp(String.raw`(?<role>${authority})(?:의)?(?:\s+[가-힣]{1,12}){0,4}?\s*(?:[을를]?\s*자처|이름(?:을)?\s*(?:댔|대며|대면서)|(?:이?라고|이라|이?라는|이라며)\s*(?:(?:스스로|자신을?|자기를?)\s*)?(?:소개|밝히|밝힌|밝혔|적힌|표시)|(?:이?라는|이라며)(?=\s*(?:수신|문자|연락|안내|메시지|쪽지))|(?:담당했|맡았)다고\s*(?:소개|밝힌|밝히|밝혔)|에서\s*(?:발송한|보낸))`, "u");
const receivingContext = /(?:문자|메시지|알림|답장|답신|통지|안내|연락|쪽지|발신|보낸\s*쪽|수신)/u;
const notCurrent = /(?:피싱|사기|사칭|피해)\s*(?:예방|교육|사례)|(?:예방|교육|가상|모의|참고)\s*(?:자료|사례|연습|문구|용)|(?:극본|대본|역할극)|(?:문구|표기|항목|내용)(?:은|는|이|가)?\s*(?:참고|예시|가정)(?:였|이었|입니다|에\s*불과)|(?:실제로?\s*)?(?:회신|설치|제출)\s*(?:요청|요구)(?:은|는|이|가)?\s*없(?:습|었|어요|다)|(?:요청|요구|안내)(?:은|는|이|가|을|를)?\s*(?:(?:제가|이미|어제)\s*){0,3}(?:거절|철회|취소)|(?:접수|상담)(?:는|이|가)?\s*(?:이미\s*)?(?:종료|완료)(?:됐|되었)/u;
const anotherTopic = /^(?:(?:이와|그와)는?\s*별개로|한편|별건으로|(?:다른|별도)\s*(?:쪽지|문자|기관|업체|담당자)|(?:지난번|예전|이전)(?:에는|에|의)\s*)/u;
const closedRemainder = /^(?:그|해당|같은|이)\s*(?:요청|요구|접수|절차)(?:은|는|이|가|을|를)?\s*(?:(?:제가|이미|어제)\s*){0,3}(?:거절|취소|철회|종료|완료)(?:했|하였|됐|되었|함)/u;
const requestReport = /(?:요구|요청|지시)(?:했|했다|하|을|를|이|가|였|라고|라|라는|함)|(?:하라|하라고|하라는|하도록|해야|달라|필요하다고)(?:[\s,，]|적|는|고|$)/u;

function claimedIssuer(text) {
  if (!receivingContext.test(text) || notCurrent.test(text) || anotherTopic.test(text)) return "";
  return declaredAuthority.exec(text)?.groups.role ?? "";
}

const quoteBoundary = /[,，;；]\s*(?=(?:(?:이와|그와)는?\s*별개로|한편|별건으로|(?:다른|별도)\s*(?:쪽지|문자|기관|업체|담당자)))/u;
const conversation = /(?:[와과]|하고)\s*(?:(?:먼저|앞서|방금|아까|직접)\s*)?(?:통화|전화)(?:했|하였|한|하고)/u;
const anotherCallParticipant = /(?:다른|별도(?:의)?)\s*(?:기관|사람|담당자|발신자|발신처|업체)(?:이|가|에서|에게서|한테서)/u;
const senderSpecifiedApp = /(?:상대(?:방)?|발신자|보낸\s*사람|그\s*사람)(?:가|이)\s*(?:정해\s*준|지정한|보낸|고른|알려\s*준)\s*(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*(?:내|제|수신자(?:의)?|받은\s*사람(?:의)?)\s*(?:휴대\s*(?:폰|전화)|스마트폰|기기|컴퓨터)(?:에|에서)\s*설치(?:하라|하도록|해야)/u;
function* narrativeFrames(text, unverifiedLinks) {
  const identifiesRequest = body => requiresRecipientInstallation(body) ||
    directsToUnverifiedAddress(body, unverifiedLinks);
  for (const { body, previous, next } of currentReceivedRequests(text, claimedIssuer, identifiesRequest)) {
    if (notCurrent.test(body) || startsOtherOrganizer(body) || closedRemainder.test(next)) continue;
    const action = body.split(quoteBoundary, 1)[0];
    // 이어 받은 안내에 같은 상대가 지정한 앱이 있을 때만 앞선 통화의 발신자를 연결한다.
    const continuedCall = isReceivedContinuation(action) && senderSpecifiedApp.test(action) && !anotherCallParticipant.test(action) &&
      conversation.test(previous) && !notCurrent.test(previous) && !anotherTopic.test(previous);
    const callIssuer = continuedCall ? declaredAuthority.exec(previous)?.groups.role : "";
    const issuer = claimedIssuer(action) || claimedIssuer(previous) || callIssuer;
    if (issuer) yield { issuer, action, next, continuedCall };
  }
}

const recordedNotice = /(?:수신|받은|받았)|(?:문자|안내|알림|통지|수신함)\s*[^.!?\n]{0,18}(?:항목|분류|미리보기|요약|기록)/u;
const issuerField = /^(?:(?:발신(?:자|처)?|발행처|보낸\s*(?:곳|이|사람))(?:\s*(?:표기|표시|소개|주장))?)(?:\s*[|:：]\s*|[ \t]+)(?<value>\S.*)$/u;
const relevantField = /^(?<label>(?:요청|요구)\s*항목|해야\s*할\s*일|(?:처리\s*)?목적|용도|(?:대출\s*)?상환\s*(?:수단|방식|방법)|(?:수거|회수|납부)\s*(?:방식|방법))(?:\s*[|:：]\s*|[ \t]+)(?<value>\S.*)$/u;
function* structuredFrames(text) {
  const lines = text.split(/[\r\n]+/u).map(line => line.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const heading = lines[index - 1] ?? "";
    if (!recordedNotice.test(heading) || notCurrent.test(heading)) continue;
    const sender = issuerField.exec(line)?.groups.value;
    const issuer = sender && issuerLabel.exec(sender)?.groups.role;
    if (!issuer) continue;
    const fields = [];
    for (const row of lines.slice(index + 1, index + 5)) {
      const field = relevantField.exec(row);
      if (!field || notCurrent.test(row) || anotherTopic.test(row)) break;
      fields.push(field.groups);
    }
    if (fields.length && !closedRemainder.test(lines[index + 1 + fields.length] ?? "")) yield { issuer, sender, heading, fields };
  }
}

const appointmentProcedure = /(?:예약\s*내역|(?:면담|상담|접수|심사|배정|신청)(?:\s*(?:예약|일시|시간|결과|상태|내용|절차)))/u;
const namedAddress = /^\s*(?:주소|링크|페이지)(?:에서|로|에)(?:만)?\s*(?:신청|입력|등록|접수|확인)\s*절차(?:을|를)?\s*(?:밟으라|진행하라|진행하도록|거치라|밟아야|거쳐야)/u;
const bodyAddress = /(?:본문|문자|안내문?|메시지)(?:의|에\s*(?:적힌|실린|있는))\s*$/u;
const useAddress = /^\s*(?:에서|으로|로|에)\s*(?:(?:신청|입력|등록|접수|확인)(?:을|를)?\s*(?:하라(?:고|는)?|해야|하도록)|(?:로그인|접속)(?:하라(?:고|는)?|해야|하도록))/u;
function directsToUnverifiedAddress(action, unverifiedLinks) {
  if (!unverifiedLinks.length || ORDINARY_LOOKUP.test(action)) return false;
  for (const token of action.matchAll(/\S+/gu)) {
    const after = action.slice(token.index + token[0].length);
    const before = action.slice(0, token.index);
    if (!(useAddress.test(after) && appointmentProcedure.test(before)) &&
        !(namedAddress.test(after) && bodyAddress.test(before))) continue;
    const { complete, candidates } = inspectLinkCandidates(token[0]);
    if (complete && candidates.length === 1 && ["http:", "https:"].includes(candidates[0].protocol) &&
        unverifiedLinks.includes(candidates[0].raw)) return true;
  }
  return false;
}

const providedCallback = /(?:(?:이|그|같은|해당)\s*)?(?:문자|메시지|안내문?|통지|답장|회신|본문)(?:\s*본문)?(?:에|\s*속)\s*(?:따로\s*)?(?:적힌|실린|나온|표시된|있는)\s*(?:전화\s*)?(?:번호|연락처)(?:\s*[:：])?\s*(?<number>0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1\d{3}[- ]?\d{4}|1\d{2,3})?/u;
const leavesKnownContact = /(?:기존|저장해\s*둔|원래\s*(?:알던|쓰던|저장해\s*둔)|평소\s*(?:알던|쓰던)|대표|공식)\s*(?:연락처|문의처|번호|곳|전화|창구)(?:를|은|는|와는?|과는?)?\s*(?:대신|말고|아니라|별개로)\s*[,，]?\s*$/u;
const callActivity = /(?:문의|상담|전화|통화|연락|회신)/u;
const callDirective = /^\s*(?:으로|로|에)(?:만)?\s*(?:(?<call>전화|통화|연락|문의|회신)(?:를|을)?\s*)?(?:하라(?:는|고)?|하도록|해야|하래)/u;
function directsToNoticeNumber(action) {
  const callback = providedCallback.exec(action);
  if (!callback || isCardCallbackNumber(callback.groups.number)) return false;
  const before = action.slice(0, callback.index);
  const directive = callDirective.exec(action.slice(callback.index + callback[0].length));
  return Boolean(directive && leavesKnownContact.test(before) && (directive.groups.call || callActivity.test(before)));
}

const privateReply = /(?:이|같은|해당)?\s*(?:회신|답장)(?:란)?(?:에|으로|로)\s*(?:제|저의|내|수신자의)\s*(?:생년월일|출생\s*일자)\s*(?:과|와|및|,|·)\s*(?:기본\s*)?(?:인적\s*사항|성명|이름|주소|연락처)(?:을|를)?\s*(?:기입|작성|입력|적)(?:하라(?:는|고)?|으라(?:는|고)?|하라고|어\s*달라|해야)/u;
const remoteInstall = /(?:원격\s*(?:지원|제어))\s*(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*설치/u;
const extraInstall = /(?:별도(?:의)?|외부(?:의)?|추가(?:로)?)\s*(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*설치/u;
const receiverProcedure = /(?:접수|처리|심사|검토|상담|열람|신청|확인)(?:를|을)?\s*(?:이어가|진행하|받|계속하|하)려면/u;
const installationPurpose = /(?:필요|필수|요건)(?!\s*(?:없|아니))|하라(?:는|고)?|하도록|해야/u;
const staffInstallation = /(?:직원용|업무용|운영용|관리용|운영자|전산팀|직원\s*교육|공식\s*(?:앱|스토어|마켓))|(?:직원|담당자|운영진)(?:의)?\s*(?:개인\s*)?(?:기기|단말|컴퓨터|휴대\s*(?:폰|전화))|(?:직원|담당자)(?:가|는)\s*(?:직접|먼저)?\s*설치/u;
const noInstallation = /(?:설치\s*(?:없이|하지\s*않)|(?:설치|필수|요건)(?:가|는|은)?\s*(?:필요(?:하지\s*않|가\s*없)|아니)|필수(?:는|가)?\s*아니|설치\s*(?:여부|이력|기록))/u;
function requiresRecipientInstallation(action) {
  if (staffInstallation.test(action) || noInstallation.test(action)) return false;
  return (remoteInstall.test(action) && requestReport.test(action)) ||
    (extraInstall.test(action) && receiverProcedure.test(action) && installationPurpose.test(action));
}

const investigator = new RegExp(String.raw`^(?:${INVESTIGATIVE}|수사\s*기관)$`, "u");
const financialIssuer = /^(?:금융\s*(?:기관|회사)|은행)$/u;
const ownCash = /(?:제가|내가|수신자가)\s*(?:가진|갖고\s*있는|보유한|보관한)|(?:제|저의|내|수신자의)\s*$/u;
const cashHandover = /(?:현금|현찰)(?:을|은|만)?\s*(?:준비(?:해|한\s*뒤|해서)\s*)?(?:(?:나중에|이후에?)\s*)?(?:(?<staff>(?:(?:방문하|찾아오|만나)는\s*)?(?:직원|담당자|요원|수사관|대리인))(?:에게|한테)\s*)?(?<direct>직접\s*)?(?:인계하|전달하|건네|넘기)(?:도록|라(?:는|고)|라고|는\s*(?:것|일|방법)|라는|야)/u;
const cashReturn = /(?:분실물|습득물|반환|돌려[받주]|에게서\s*(?:받|인수)|현금(?:을|은)?\s*(?:인계|전달|수거)\s*하지\s*않)/u;
function reportsInvestigativeCash(action) {
  if (cashReturn.test(action) || !requestReport.test(action)) return false;
  const handover = cashHandover.exec(action);
  return Boolean(handover && (handover.groups.staff || handover.groups.direct &&
    ownCash.test(action.slice(Math.max(0, handover.index - 24), handover.index))));
}

const repayment = /(?:대출(?:금)?|융자금)\s*(?:상환|갚)|^(?:상환금|상환액)(?:\s|$)/u;
const cashOnly = /^(?:현금|현찰)(?:으로|을|은)?$/u;
const fieldCash = /(?:현금을?|현찰)(?=[을은\s]|$)/u;
const staffVisit = /(?:방문(?:한|하는)|찾아오(?:는|ㄴ))\s*(?:직원|담당자)|(?:직원|담당자)(?:이|가|의)?\s*(?:직접\s*)?(?:찾아[오와가]|방문(?:해|해서|하여|한\s*뒤)?)/u;
const collects = /(?:받아\s*(?:[가간감]|왔)|가져\s*[가간감]|수령|수거|회수)/u;
const noCashCollection = /(?:서류|서명|동의|증빙|영수증)(?:을|를|만)?\s*(?:받|수거|수령|회수)|(?:현금|현찰)(?:을|은|이)?\s*(?:받지|수거하지|가져가지)\s*않|영업점|방문은\s*(?:상담|확인)만/u;
function reportsLoanCollection(fields, sender, heading) {
  const isRepayment = fields.some(field => repayment.test(field.value)) ||
    /(?:대출|융자)/u.test(heading) && fields.some(field => /상환/u.test(field.label));
  if (!isRepayment || !/(?:직원|담당자)/u.test(sender)) return false;
  const cash = fields.some(field => /상환\s*수단/u.test(field.label) && cashOnly.test(field.value));
  return fields.some(({label, value}) => /(?:방식|방법)/u.test(label) && !noCashCollection.test(value) &&
    staffVisit.test(value) && collects.test(value) && (cash || fieldCash.test(value)));
}

export function addInstitutionReportFrames(text, signals, { unverifiedLinks = [] } = {}) {
  const addAgencyAction = signal => {
    signals.add(SIG_AGENCY_IMPERSONATION);
    signals.add(signal);
  };
  for (const { issuer, action, next, continuedCall } of narrativeFrames(text, unverifiedLinks)) {
    if (directsToUnverifiedAddress(action, unverifiedLinks)) addAgencyAction(SIG_LINK);
    if (directsToNoticeNumber(action)) addAgencyAction(SIG_CALL_THIS_NUMBER);
    if (privateReply.test(action)) addAgencyAction(SIG_PERSONAL_INFO);
    if (hasOpenInstallationReport(action, next, notice => requiresRecipientInstallation(notice) ||
        continuedCall && senderSpecifiedApp.test(notice) && !staffInstallation.test(notice) && !noInstallation.test(notice))) {
      addAgencyAction(SIG_APP_INSTALL);
    }
    if (investigator.test(issuer) && reportsInvestigativeCash(action)) signals.add(SIG_CASH_HANDOVER);
  }
  for (const { issuer, sender, heading, fields } of structuredFrames(text)) {
    if (fields.some(({label, value}) => /항목|해야\s*할\s*일/u.test(label) && remoteInstall.test(value) &&
        !staffInstallation.test(value) && !noInstallation.test(value))) addAgencyAction(SIG_APP_INSTALL);
    if (financialIssuer.test(issuer) && reportsLoanCollection(fields, sender, heading)) signals.add(SIG_LOAN_CASH_PICKUP);
  }
}
