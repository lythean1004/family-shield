import { classifyCallback } from "./callback-number.js";
import { personalDisclosure } from "./personal-disclosure.js";
import { isCardCallbackNumber, isCardSenderName } from "./card-sender.js";
import { INVESTIGATIVE, readInvestigativeCashDocument } from "./cash-handover.js";
import { recognizedIssuedNoticeActions, recognizedRecipientActions } from "./issued-institution-actions.js";
import { readInstitutionIssuer } from "./institution-request-context.js";
import { inspectLinkCandidates } from "./link-candidates.js";
import { isOfficialLink, readUnregisteredAddressDirection } from "./official-links.js";
import { hasOpenInstallationReport, ORDINARY_LOOKUP, startsOtherOrganizer } from "./reported-notice-fields.js";
import { cashEventEvidence, couldDescribeCashTransaction } from "./cash-event-evidence.js";
import { currentReceivedRequests, isReceivedContinuation, receivedFieldLines } from "./received-message.js";
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
  if (!receivingContext.test(text) || notCurrent.test(text) || anotherTopic.test(text) || !roleBelongsToReportedSource(text)) return "";
  return declaredAuthority.exec(text)?.groups.role ?? "";
}

const quoteBoundary = /[,，;；]\s*(?=(?:(?:이와|그와)는?\s*별개로|한편|별건으로|(?:다른|별도)\s*(?:쪽지|문자|기관|업체|담당자)))/u;
const conversation = /(?:[와과]|하고)\s*(?:(?:먼저|앞서|방금|아까|직접)\s*)?(?:통화|전화)(?:했|하였|한|하고)/u;
const anotherCallParticipant = /(?:다른|별도(?:의)?)\s*(?:기관|사람|담당자|발신자|발신처|업체)(?:이|가|에서|에게서|한테서)/u;
const senderSpecifiedApp = /(?:상대(?:방)?|발신자|보낸\s*사람|그\s*사람)(?:가|이)\s*(?:정해\s*준|지정한|보낸|고른|알려\s*준)\s*(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*(?:내|제|수신자(?:의)?|받은\s*사람(?:의)?)\s*(?:휴대\s*(?:폰|전화)|스마트폰|기기|컴퓨터)(?:에|에서)\s*설치(?:하라|하도록|해야)/u;
function* narrativeFrames(text, unverifiedLinks) {
  const identifiesRequest = body => requestsDesignatedPrivateReply(body) || requiresRecipientInstallation(body) ||
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
const issuerField = /^(?:(?:발신(?:자|처)?(?:가\s*(?:주장|내세운|밝힌)(?:한)?\s*(?:소속|역할|기관))?|발행처|보낸\s*(?:곳|이|사람))(?:\s*(?:표기|표시|소개|주장))?)(?:\s*[|:：]\s*|[ \t]+)(?<value>\S.*)$/u;
const relevantField = /^(?<label>받은\s*(?:요청|요구)|(?:요청|요구)\s*(?:항목|사항|내용)|해야\s*할\s*일|(?:처리\s*)?목적|용도|(?:대출\s*)?상환\s*(?:수단|방식|방법)|(?:수거|회수|납부)\s*(?:방식|방법))(?:\s*[|:：]\s*|[ \t]+)(?<value>\S.*)$/u;
const requestStatusField = /^(?:요청|요구|지시)\s*(?:(?:최종|처리)\s*)?상태(?:\s*[:：|]\s*|[ \t]{2,}|\t|\u3000+)(?<value>\S.*)$/u;
const finalCancelledRequest = /^(?:(?:그|해당|같은)\s*(?:요청|요구|지시)(?:은|는|이|가|을|를)?\s*)?(?:최종\s*)?(?:취소|철회)(?:\s*(?:완료|확정|됨|됐(?:음|다|습니다)|되었(?:음|다|습니다)|했(?:음|다|습니다)|하였(?:음|다|습니다)))?\s*[.!。]?$/u;
const nominalCashRequest = /^대면\s*(?:현금|현찰)\s*(?:인계|전달|교부)\s*(?:요구|요청|지시)\s*[.!。]?$/u;
const requestLabel = /^(?:받은\s*(?:요청|요구)|(?:요청|요구)\s*(?:항목|사항|내용)|해야\s*할\s*일)$/u;
const recordDateField = /^(?:기록|작성)\s*(?:일자|날짜)\s*[:：]\s*\d{4}[-.]\d{1,2}[-.]\d{1,2}\.?$/u;

function hasSingleCashRequest(value) {
  const demand = receivedCashDemand.exec(value);
  return demand ? /^(?:내용|요구|요청|지시|기록)?\s*[.!。]?$/u.test(value.slice(demand[0].length).trim()) :
    nominalCashRequest.test(value);
}

function finalCashRequestClosed(rows) {
  const body = rows.at(-1) === "" ? rows.slice(2, -1) : rows.slice(2);
  const [request, ...statusRows] = body;
  const field = relevantField.exec(request ?? "")?.groups;
  if (!field || !requestLabel.test(field.label) || !hasSingleCashRequest(field.value) || !statusRows.length) return false;
  const statuses = statusRows.filter(row => !recordDateField.test(row)).map(row => requestStatusField.exec(row)?.groups.value);
  return statuses.length > 0 && statuses.every(Boolean) && finalCancelledRequest.test(statuses.at(-1));
}

const sameRequestSubject = /^(?:(?:최종\s*)?(?:재확인(?:\s*(?:결과|에서))?|정정(?:\s*기록에서)?)\s*[:：,，]?\s*)?(?:그|해당|같은|앞(?:의|선))\s*(?:(?<cash>현금\s*인계)\s*)?(?:요청|요구)(?:은|는|이|가|을|를)?\s*/u;
const activeRequestStatus = /^(?:(?:현재(?:도)?|여전히|다시)\s*)?(?:유효(?:함|하다|합니다|하다고\s*확인함)?|유지(?:됨|한다|합니다|한다고\s*확인함)?|재개(?:됨|됐다|됐습니다|\s*확정)?)\s*[.!。]?$/u;

function latestActiveRequest(rows) {
  const last = rows.findLast(row => requestStatusField.test(row) || sameRequestSubject.test(row));
  if (!last) return null;
  const value = requestStatusField.exec(last)?.groups.value ?? last;
  const subject = sameRequestSubject.exec(value);
  if (!activeRequestStatus.test(value.slice(subject?.[0].length ?? 0))) return null;
  return { sameRequest: Boolean(subject), cashHandover: Boolean(subject?.groups.cash) };
}

function followingRequestStatus(next, issuer) {
  if (!next || next.some(row => requestLabel.test(relevantField.exec(row)?.groups.label ?? ""))) return null;
  const otherIssuer = issuerField.exec(next[1] ?? "")?.groups.value;
  if (otherIssuer) {
    // 발신처가 다시 적힌 문단은 별도 기록이다. 상태 행에서 앞선 현금 요구를 직접 가리켜야 한다.
    if (otherIssuer !== issuer || !/정정|재확인/u.test(next[0])) return null;
    const fields = next.slice(2);
    const status = latestActiveRequest(fields);
    if (status?.cashHandover) return "reopened";
    // 무엇을 정정했는지 적지 않은 후속 상태만 있으면 새로 취소를 확정할 수 없다.
    if (status && fields.every(row => requestStatusField.test(row) || recordDateField.test(row))) return "unclear";
    return null;
  }
  return latestActiveRequest(next)?.sameRequest ? "reopened" : null;
}

function structuredRecordBlocks(text) {
  const blocks = text.split(/\r?\n[ \t]*\r?\n/u).map(body => ({ body, rows: receivedFieldLines(body) }))
    .filter(block => block.rows.length);
  return blocks.map((block, index) => {
    const [heading, issuer, ...fields] = block.rows;
    const sender = issuerField.exec(issuer ?? "")?.groups.value;
    const requests = fields.map(row => relevantField.exec(row)?.groups).filter(field => field && requestLabel.test(field.label));
    const singleCashRequest = requests.length === 1 && hasSingleCashRequest(requests[0].value);
    const following = singleCashRequest ? followingRequestStatus(blocks[index + 1]?.rows, sender) : null;
    const reopened = singleCashRequest && Boolean(latestActiveRequest(fields) || following === "reopened");
    const cashClosed = !reopened && !following && recordedNotice.test(heading) && Boolean(sender) && finalCashRequestClosed(block.rows);
    return { ...block, reopened, cashClosed };
  });
}

function* structuredFrames(blocks) {
  const lines = blocks.flatMap(block => block.rows.map(line => ({ line, block })));
  for (const [index, { line, block }] of lines.entries()) {
    const heading = lines[index - 1]?.line ?? "";
    if (!recordedNotice.test(heading) || notCurrent.test(heading)) continue;
    const sender = issuerField.exec(line)?.groups.value;
    const issuer = sender && issuerLabel.exec(sender)?.groups.role;
    if (!issuer) continue;
    const fields = [];
    const rows = lines.slice(index + 1, index + 5);
    for (const { line: row } of rows) {
      const field = relevantField.exec(row);
      if (!field || notCurrent.test(row) || anotherTopic.test(row)) break;
      fields.push(field.groups);
    }
    if (!fields.length) continue;
    const status = lines[index + 1 + fields.length];
    const legacyClosed = closedRemainder.test((status?.line ?? "").replace(dispositionField, ""));
    const sameRecord = lines[index - 1]?.block === block && rows.slice(0, fields.length).every(row => row.block === block);
    // 다른 문단의 상태나 이후의 명시적 재확인 때문에 R15만 다시 판단할 수 있다.
    const cashOnly = legacyClosed && sameRecord && investigator.test(issuer) &&
      (status?.block !== block || block.reopened);
    if (!legacyClosed || cashOnly) {
      yield { issuer, sender, heading, fields, cashOnly, cashClosed: sameRecord && block.cashClosed };
    }
  }
}

const appointmentProcedure = /(?:예약\s*내역|(?:면담|상담|접수|심사|배정|신청)(?:\s*(?:예약|일시|시간|결과|상태|내용|절차)))/u;
const namedAddress = /^\s*(?:주소|링크|페이지)(?:에서|로|에)(?:만)?\s*(?:신청|입력|등록|접수|확인)\s*절차(?:을|를)?\s*(?:밟으라|진행하라|진행하도록|거치라|밟아야|거쳐야)/u;
const bodyAddress = /(?:본문|문자|안내문?|메시지)(?:의|에\s*(?:적힌|실린|있는))\s*$/u;
const useAddress = /^\s*(?:에서|으로|로|에)\s*(?:(?:신청|입력|등록|접수|확인)(?:을|를)?\s*(?:하라(?:고|는)?|해야|하도록)|(?:로그인|접속)(?:하라(?:고|는)?|해야|하도록))/u;
function isUnverifiedAddressToken(token, unverifiedLinks) {
  const { complete, candidates } = inspectLinkCandidates(token);
  return complete && candidates.length === 1 && ["http:", "https:"].includes(candidates[0].protocol) &&
    unverifiedLinks.includes(candidates[0].raw);
}

function directsToUnverifiedAddress(action, unverifiedLinks, includesReading = false) {
  if (!unverifiedLinks.length || ORDINARY_LOOKUP.test(action)) return false;
  for (const token of action.matchAll(/\S+/gu)) {
    const after = action.slice(token.index + token[0].length);
    const before = action.slice(0, token.index);
    if (!(useAddress.test(after) && appointmentProcedure.test(before)) &&
        !(namedAddress.test(after) && bodyAddress.test(before)) &&
        !(includesReading && reportDocument.test(before) && readAtAddress.test(after))) continue;
    if (isUnverifiedAddressToken(token[0], unverifiedLinks)) return true;
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
const requestedPrivateMaterial = /(?:개인\s*(?:정보|신상\s*정보)|주민\s*등록\s*번호|신분증|여권\s*(?:사본|사진|번호)|계좌\s*(?:번호|비밀번호))(?=\s|를|을|가|이|의)/u;
const designatedReply = /^\s*(?:(?:을|를)|(?:가|이)?\s*(?:담긴|포함된)\s*(?:서류|자료|사본|사진)(?:을|를)?)?\s*(?:발신자|발신처|상대(?:방)?|보낸\s*사람)(?:가|이)\s*(?:지정한|정해\s*준|보낸)\s*(?:회신처|답장\s*(?:주소|채널|계정)|별도\s*(?:회신|제출)\s*(?:주소|채널|접수처))(?:으로|로|에)(?:만)?\s*(?:내|보내|전달하|제출하|회신하|첨부하)(?:라(?:고|는)|야)(?=\s|$)/u;
function requestsDesignatedPrivateReply(action) {
  const material = requestedPrivateMaterial.exec(action);
  return Boolean(material && designatedReply.test(action.slice(material.index + material[0].length)));
}
const remoteInstall = /(?:원격\s*(?:지원|제어))\s*(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*설치/u;
const extraInstall = /(?:별도(?:의)?|외부(?:의)?|추가(?:로)?)\s*(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*설치/u;
const receiverProcedure = /(?:접수|처리|심사|검토|상담|열람|신청|확인)(?:\s*절차)?(?:를|을)?\s*(?:이어가|진행하|받|계속하|하)려면/u;
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

const receivedCashDemand = /^\s*(?:현금|현찰)(?:을|은)?\s*(?:(?:준비|마련)(?:해|해서|한\s*뒤)\s*)?(?:(?:직접\s*)?만나(?:서)?\s+|대면(?:해|해서)?\s*)(?:인계하|전달하|건네|넘기)(?:라(?:고|는)|도록)(?=\s|$)/u;
const dispositionField = /^(?:처리|진행|조치|요청)\s*상태\s*[:：]\s*/u;
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

const telecomRole = String.raw`통신\s*(?:사|회사|업체)`;
const reportedRole = "(?:" + authority + "|공공\\s*(?:고지|통지|민원)|" + telecomRole + "|보험사|건강\\s*보험(?:공단)?|카드사|택배\\s*(?:사|회사)|공단)";
const roleTitle = "(?<role>" + reportedRole + ")(?<unit>(?:\\s+(?:가입|관리|고객|민원|업무|전산|수사|조사|사건|통지|지원|상담|대출|상환|금융|담당(?:자|부서)?|부서|직원|팀|소속|창구)){0,5})";
const reportingSender = "(?:발신(?:자|인|처)|보낸\\s*(?:사람|이|쪽)|상대(?:방)?)";
const roleMarker = "(?:이?라고\\s*(?:소개한|밝힌|말한|주장한)|(?:[을를]\\s*)?(?:자처하(?:는|던)|자처한|자칭하(?:는|던)|자칭한))";
const introducedSender = new RegExp("(?<![\\p{L}\\p{N}])" + roleTitle + "\\s*" + roleMarker + "\\s*" + reportingSender + "(?:이|가|은|는)?(?=[\\s,，]|$)", "u");
const introducedTelecomSender = new RegExp(
  String.raw`^(?:[가-힣]+\s*(?:기록|메모)\s*[—:：]\s*)?` + telecomRole +
  String.raw`(?:\s+(?:접수|고객(?:\s*관리)?|가입|관리|상담|지원)){0,2}\s*(?:(?:팀|부서|창구)\s*)?` +
  roleMarker + "\\s*(?:" + reportingSender + "|직원|담당자|사람)(?:이|가|은|는)\\s*", "u",
);
const selfDescription = new RegExp("^(?:(?:문자|메시지|연락)(?:를|을)?\\s*)?" + reportingSender + "(?:이|가|은|는)\\s*" + roleTitle +
  "\\s*(?:이?라고\\s*(?:했|하였|말했|소개했|밝혔|주장했)|(?:[을를]\\s*)?(?:자처했|자칭했))", "u");
const describedRole = new RegExp("^" + roleTitle + "이?라는\\s*(?:사람|쪽|상대(?:방)?)(?:이|가|은|는)?(?=[\\s,，]|$)", "u");
const institutionTitle = new RegExp("^" + roleTitle + "$", "u");
const receivedRoleNotice = new RegExp("^(?:(?:수신한|받은)\\s*)?" + roleTitle +
  "\\s*(?:이?라는|이?라고\\s*(?:소개|설명|밝히|밝혔|표시)[가-힣]*)\\s*" +
  "(?:문자|메시지|연락|안내|통지|쪽지)(?:였|이었|입니다|이라고\\s*(?:기록|적었))", "u");
const reportedRoleOrigin = new RegExp("(?<![\\p{L}\\p{N}])(?:자신|본인|자기)(?:이|가)\\s*" + roleTitle +
  "\\s*(?:에서|\\s*소속으로)\\s*(?:(?:현재|지금|직접)\\s*){0,2}(?:연락|안내|전화|통지)하(?:는\\s*중이|고\\s*있)" +
  "(?:라고|다고)\\s*(?:한|말한|밝힌|설명한)\\s*(?:사람|상대(?:방)?|발신(?:자|인)|쪽)(?:이|가|은|는)?(?=[\\s,，]|$)", "u");
const explicitOtherRole = new RegExp(
  "(?<![\\p{L}\\p{N}])(?!(?:본인|자신|자기)(?:들)?(?:을|를)\\s+)[\\p{L}\\p{N}]{1,18}(?:을|를)\\s+" +
  roleTitle + "\\s*(?:이?라고|으로|로)\\s*(?:소개|설명|밝)", "u");
const illustrativeRole = /(?:작성|기재|입력|문서|서식|형식)\s*(?:형식\s*)?(?:예시|견본)/u;

function roleBelongsToReportedSource(clause) {
  return !explicitOtherRole.test(clause) && !illustrativeRole.test(clause);
}
const sameMessageSource = /(?:문자|메시지|쪽지|답장|회신)(?:을|를)?\s*보낸/u;
const separateActionSource = /(?:^|[,，]\s*|\s+)(?:다른|별도(?:의)?|별개의?)\s*(?:발신(?:자|인|처)|사람|상대(?:방)?|단체|회사|기관|업체|담당자|직원|문자|서식|양식|쪽지)/u;
const instructionalReport = /(?:예방|교육|훈련|모의|예시|참고)\s*(?:용|자료|사례|문구|설명|대본|상황)|(?:교육|훈련|수업|연극|역할극)(?:에서|의|을\s*위해)|(?:(?:신고|상담|교육)\s*이관용|기록용|참고용|예시용)\s*(?:더미|주소|링크|표기)|(?:절차|요청|통화|문자)(?:[이은가는을를])?\s*(?:취소|철회|종료|거절)|(?:자료|문서|주소|링크|현금)(?:[이은가는을를])?\s*(?:보내지|열지|봐서는|포함하지|전달하지|건네지|인계하지)\s*(?:말|마|않)/u;
const reportDocument = /(?:서류|문서|고지|통지|접수|신청)(?:의|한)?\s*(?:내용|내역|위치|결과|확인)/u;
const readAtAddress = /^\s*(?:에서|으로|로|에)(?:만)?\s*(?:직접\s*)?(?:보라는|보라고|봐야|읽으라는|읽으라고|읽어야|열람하라는|열람하라고|열람해야|확인하라는|확인하라고|확인해야)/u;
const linkedPrivateReply = /(?:주민\s*등록\s*번호|여권\s*(?:번호|사본)|신분증\s*(?:사진|사본)|카드\s*비밀번호|계좌\s*비밀번호)(?:\s*(?:전부|전체|모두))?(?:을|를)?\s*(?:(?:그|해당|같은)\s*)?(?:(?:문자|메시지|쪽지)\s*)?(?:답장|회신)(?:란)?(?:으로|로|에)\s*(?:보내\s*(?:달라|달라는)|첨부하(?:라(?:고|는)?|도록)|알려\s*달라|남기(?:라(?:고|는)?|도록))/u;
const deniedReportAction = /(?:요청|요구|지시|부탁|안내|말|뜻|내용)(?:[을를이가은는])?\s*(?:하지\s*않|없(?:었|다|다는|음)|아니(?:었|라|다)|취소|철회|거절)|(?:달라|하라|해야|보라)(?:고|는)?\s*(?:한|했던)?\s*(?:말|적|사실)(?:[이은가는])?\s*(?:없|아니)|이미\s*(?:종결됐|철회했|거절했|취소했)/u;
const personCashDelivery = /(?:^|[\s,，])(?:수신자(?:가|는)?|받은\s*(?:사람|이)(?:가|이|은|는)?|제가|내가)\s*(?:(?:직접|먼저)\s*)?(?:사람|직원|담당자|수사관|대리인)(?:을|를)?\s*(?:직접\s*)?만나(?:서)?\s*(?:직접\s*)?(?:현금|현찰)(?:을|를|은)?\s*(?:건네|넘겨|인계해|전달해|교부해)(?:야|라(?:고|는)|\s*달라)/u;
const requiredInPersonCash = /(?:대면\s*(?:으로)?\s*(?:현금|현찰)\s*(?:인계|전달|교부)|(?:현금|현찰)\s*대면\s*(?:인계|전달|교부))(?:를|을)?\s*(?:요구|지시)(?:하|한|했|함)/u;
const inPersonLoanRepayment = /(?:대출(?:금)?|융자금)(?:의|을)?\s*상환(?:금|액)?(?:을|를|은)?\s*(?:현금|현찰)(?:으로|로|을|를)?\s*(?:직접\s*)?(?:(?:찾아\s*와서|와서|방문(?:해|하여|해서))\s*(?:수거|회수|받아\s*가|받아가|받)(?:하)?겠다고|(?:준비해(?:서)?\s*)?방문\s*(?:수거인|수령인|직원|담당자)(?:에게|한테)\s*(?:인계|전달|건네|넘겨)(?:하라는|하라고|해야|도록|라(?:고|는))?(?=\s*[.!。]?$))/u;
const summarySplit = /\s*(?:\/|[|｜])\s*(?=(?:발신(?:인|자|처)|보낸\s*(?:사람|이)|(?:요구|요청)\s*(?:요약|내용|항목))[^.!?\n]{0,20}[:：])/u;
const summaryHeading = /^(?:기록\s*(?:종류|유형)|(?:수신|받은\s*연락)\s*(?:기록|요약))(?:\s*[:：]\s*[^.!?\n]{0,20})?$/u;
const summaryRole = /^(?:발신(?:인|자|처)|보낸\s*(?:사람|이))(?:의)?(?:\s*(?:자기\s*소개|소속|역할|표기|주장))?\s*[:：]\s*(?<value>[^\r\n]+)$/u;
const summaryDemand = /^(?:요구|요청)\s*(?:요약|내용|항목)\s*[:：]\s*(?<value>[^\r\n]+)$/u;

function issuerInReport(text) {
  if (notCurrent.test(text) || anotherTopic.test(text) || instructionalReport.test(text)) return null;
  return introducedSender.exec(text) ?? selfDescription.exec(text) ?? describedRole.exec(text);
}

function openDirectedReport(text) {
  return !notCurrent.test(text) && !instructionalReport.test(text) && !deniedReportAction.test(text) &&
    !separateActionSource.test(text) && !startsOtherOrganizer(text);
}

function* reportedDirectedInstitutionActions(text, unverifiedLinks) {
  const hasRequest = clause => directsToUnverifiedAddress(clause, unverifiedLinks, true) ||
    linkedPrivateReply.test(clause) || personCashDelivery.test(clause) || requiredInPersonCash.test(clause) || inPersonLoanRepayment.test(clause);
  for (const { body, previous, next } of currentReceivedRequests(text, issuerInReport, hasRequest)) {
    if (!openDirectedReport(body) || closedRemainder.test(next)) continue;
    const sender = issuerInReport(body);
    if (!sender) {
      // 직전 절이 같은 문자의 발신자를 명시한 경우에만 현재 답장 요구와 연결한다.
      if (sameMessageSource.test(previous) && issuerInReport(previous) && linkedPrivateReply.test(body)) yield SIG_PERSONAL_INFO;
      continue;
    }
    const action = body.slice(sender.index + sender[0].length);
    const { role, unit } = sender.groups;
    if (!openDirectedReport(action)) continue;
    if (directsToUnverifiedAddress(action, unverifiedLinks, true)) yield SIG_LINK;
    if (linkedPrivateReply.test(action)) yield SIG_PERSONAL_INFO;
    if (investigator.test(role) && !cashReturn.test(action) &&
        (personCashDelivery.test(action) || requiredInPersonCash.test(action))) yield SIG_CASH_HANDOVER;
    if (financialIssuer.test(role) && /직원|담당/u.test(unit) && inPersonLoanRepayment.test(action)) yield SIG_LOAN_CASH_PICKUP;
  }
  for (const line of text.split(/\r?\n/u)) {
    if (!openDirectedReport(line)) continue;
    const [heading, ...fields] = line.split(summarySplit).map(field => field.trim());
    if (fields.length !== 2 || !summaryHeading.test(heading) || !receivingContext.test(heading)) continue;
    const sender = fields.map(field => summaryRole.exec(field)?.groups.value).find(Boolean);
    const role = institutionTitle.exec(sender ?? "")?.groups;
    const request = fields.map(field => summaryDemand.exec(field)?.groups.value).find(Boolean);
    if (role && financialIssuer.test(role.role) && /담당|직원/u.test(role.unit) &&
        request && openDirectedReport(request) && inPersonLoanRepayment.test(request)) yield SIG_LOAN_CASH_PICKUP;
  }
}

const recordRole = "(?<role>(?:" + reportedRole + "|공공\\s*(?:요금|서비스)|공과금))" +
  "(?<unit>(?:(?:\\s+|의\\s*)(?:관리|민원|정산|처리|납부|상담|대출|상환|지원|복지|사업|담당(?:자)?|부서|직원|소속|센터|창구|팀|쪽)){0,5})";
const selfAttributedRole = "(?:이?라고\\s*(?:한|소개한|밝힌|주장한)|(?:[을를]\\s*)?(?:자처|자칭)(?:한|하는))";
const deliveryArtifact = "(?:문자|메시지|알림|통지|안내(?:문)?|연락|회신|쪽지)";
const receivedPredicate = "(?:받았|왔|도착했|수신했|받아\\s*(?:확인|기록))";
const claimedPerson = new RegExp("(?<![\\p{L}\\p{N}])" + recordRole + "\\s*" + selfAttributedRole +
  "\\s*(?:(?:사람|상대(?:방)?|발신(?:자|인)|쪽|곳)(?:이|가|은|는|에서)?)" + "(?=[\\s,，]|$)", "u");
const claimedNotice = new RegExp("(?<![\\p{L}\\p{N}])" + recordRole + "\\s*(?:" +
  selfAttributedRole + "\\s*|명의(?:로|의)\\s*)" + deliveryArtifact + "(?:를|을|이|가|은|는)?\\s*" + receivedPredicate, "u");
const receivedArtifactHere = new RegExp(deliveryArtifact + "(?:를|을|이|가|은|는)?\\s*" + receivedPredicate, "u");
const continuationEvidence = /(?:내용|요청|조건|안내|기록)(?:이|가|은|는)?(?:이었|였|이었음|이었다|입니다|이다|\s*(?:담겼|들어|적혀|붙어|실렸|이라고|이라고\s*했|임))|(?:라|다)고\s*(?:연락|알림|통보|적|안내)/u;
const informationalAddress = /(?:참고|예시|기록|비교|교육|상담\s*이관)용|(?:참고|예시)(?:로|자료)|(?:옮겨|수동으로)\s*적은|보낸\s*쪽과\s*무관|주소만\s*기록/u;
const bodyLinkLabel = /(?:^|[\s,，])(?:(?:같은|그|해당|이)\s*)?(?:본문|(?:문자|메시지|통지|안내문?)(?:의\s*본문)?)(?:에|\s*속)\s*(?:적힌|실린|나온|기재된|표시된|들어\s*있는)\s*(?:주소|페이지|링크)(?:은|는|이|가)?\s*(?:[:：]\s*)?(?<token>\S+)/u;
const exclusiveDirection = /^\s*(?:으로|로|에)만\s*(?<action>연락|전화|통화|문의|회신|응답|접수)(?:를|을)?\s*(?:해야|하도록|하라(?:고|는)?|하라는|해야만|할\s*수\s*있)/u;
const excludedReply = /(?:수신\s*거부|발신\s*전용|참고용|예시용|기존\s*(?:대표|공식)\s*(?:번호|연락처))|(?:번호|연락처)(?:로도|에서도)\s*(?:가능|연결)|(?:할|하실)\s*필요(?:는|가)?\s*없/u;

const formName = /(?:신청|접수|제출)\s*(?:양식|서식|주소|링크)/u;
const formRecipient = /^\s*(?:(?:제게|내게|저에게|나에게|수신자에게)\s*)?(?:신청|접수|제출)\s*(?:양식|서식|주소|링크)\s*[:：]?\s*$/u;
const deliveredForm = /^\s*(?:을|를)?\s*(?:직접\s*)?(?:보냈|보내\s*왔|전송했|전달했)(?:습니다|다|음|어요)?[.!。]?$/u;
function suppliedApplicationForm(action, unverifiedLinks) {
  if (!unverifiedLinks.length || !formName.test(action) || informationalAddress.test(action)) return false;
  const { complete, candidates } = inspectLinkCandidates(action);
  if (!complete || candidates.length !== 1) return false;
  const [{ raw, protocol }] = candidates;
  if (!["http:", "https:"].includes(protocol) || !unverifiedLinks.includes(raw)) return false;
  const position = action.indexOf(raw);
  return formRecipient.test(action.slice(0, position)) && deliveredForm.test(action.slice(position + raw.length));
}

const recordedSelfClaim = new RegExp("^(?:문자\\s*)?발신(?:처|자|인)(?:은|는|이|가)\\s*(?:(?:지역|지방|보건)\\s*)?" +
  recordRole + "(?:[을를]\\s*)?\\s*(?:자칭|자처)(?:함|했음|했다|했습니다)?[.。]?$", "u");
const nameAndBirth = /(?:수신자의|받은\s*사람의|저의|제|내)\s*(?:(?:이름|성명)(?:과|와|·)\s*(?:생년월일|출생\s*(?:일자|일))|(?:생년월일|출생\s*(?:일자|일))(?:과|와|·)\s*(?:이름|성명))(?:을|를)\s*$/u;
const requiredDisclosure = /(?:제공|제출|전달)해야(?:만)?\s*(?:한다(?:고|는)|된다는)\s*(?:내용|설명|안내|요구|말|기재|표시|적혀)/u;
const independentIdentityCheck = /(?:본인|자기|개인)\s*기기|현장|대면|직접\s*(?:방문|방문한)|방문\s*창구|공식\s*(?:앱|창구|사이트|누리집)/u;
const concurrentIssuerClaim = new RegExp(
  "^(?:(?:발신(?:자|인)|상대(?:방)?|보낸\\s*(?:사람|쪽))(?:이|가|은|는)\\s*)?" +
  "(?:" + recordRole + "|복지\\s*(?:(?:접수|상담)\\s*)?창구)(?:(?:의)?\\s*(?:직원|담당자|상담원))?\\s*" +
  "(?:이?라고\\s*(?:(?:자신|자기)(?:을|를)\\s*)?(?:하|말하|소개하|밝히|설명하|주장하)면서|이?라며)\\s*", "u");
const identityReplyPreface = /^(?:(?:제게|저에게|저한테|내게|수신자에게|직접)\s+)?/u;
const identityReplyInquiry = /(?:라고|라는|하도록)\s*(?:(?:요청|요구)(?:을|를|이|가)?\s*)?(?:받았|있었|요청했|요구했|말했)는지|(?:여부|뜻인지|하는지|할지를?)\s*(?:물|문의|확인)/u;

function issuerAskedForIdentityReply(clause) {
  const claim = concurrentIssuerClaim.exec(clause);
  if (!claim || !openDirectedReport(clause) || !roleBelongsToReportedSource(clause)) return false;
  const action = clause.slice(claim[0].length).replace(identityReplyPreface, "");
  if (independentIdentityCheck.test(action) || identityReplyInquiry.test(action) || excludedReply.test(action)) return false;
  return personalDisclosure(action, { recordedReply: true, atStart: true }).reply;
}

const receiptHeader = /^(?:수신|신고|상담|민원|연락)\s*(?:메모|기록|요약|정리)(?:\s*(?:요약|중\s*일부|발췌|일부))?\s*[:：]\s*/u;
const billingOfficialClaim = new RegExp(
  "^(?:문자\\s*)?발신(?:처|자|인)(?:은|는|이|가)\\s*(?:상하)?수도\\s*요금\\s*" +
  "(?:처리|납부|부과|접수|징수)?\\s*담당\\s*(?:부서|팀|기관|창구)(?:을|를)?\\s*" +
  "(?:자칭|자처)(?:함|했음|했다|했습니다)?[.。]?$", "u");
const reporterOfDifferentRequest = /(?:^|[,，]\s*)(?:제가|저는|내가|나는|수신자(?:가|는)|신고인(?:이|은))\s*[^.!?\n]{0,55}(?:(?:요구|요청|부탁)(?:했|하였|함)|(?:물었|문의했))/u;

function hasRecordedIssuerClaim(clause) {
  const claim = clause.replace(receiptHeader, "");
  return openDirectedReport(clause) && roleBelongsToReportedSource(clause) &&
    (recordedSelfClaim.test(claim) || billingOfficialClaim.test(claim));
}

function hasRecordedIdentityReply(clause) {
  return openDirectedReport(clause) && !independentIdentityCheck.test(clause) && !questionedDemand.test(clause) &&
    !reporterOfDifferentRequest.test(clause) && !excludedReply.test(clause) &&
    personalDisclosure(clause, { recordedReply: true }).reply;
}

function requiresRecipientIdentity(action) {
  if (independentIdentityCheck.test(action) || ORDINARY_LOOKUP.test(action)) return false;
  const transfer = requiredDisclosure.exec(action);
  return transfer !== null && nameAndBirth.test(action.slice(0, transfer.index));
}

function linkedDestination(action, unverifiedLinks) {
  if (informationalAddress.test(action) || ORDINARY_LOOKUP.test(action)) return "";
  const address = bodyLinkLabel.exec(action)?.groups.token;
  if (address && isUnverifiedAddressToken(address, unverifiedLinks)) return SIG_LINK;
  const contact = providedCallback.exec(action);
  const number = contact?.groups.number;
  if (!number || isCardCallbackNumber(number) || number.replace(/\D/g, "").length < 8 || excludedReply.test(action)) return "";
  return exclusiveDirection.test(action.slice(contact.index + contact[0].length)) ? SIG_CALL_THIS_NUMBER : "";
}

const attributedLoan = /(?:남은|미상환|잔여)\s*(?:대출(?:금)?|융자금)|(?:대출(?:금)?|융자금)\s*(?:잔액|잔금|상환(?:금|액)?|갚)|(?:^|[\s,，])상환(?:금|액)(?=$|[을를은는이가\s,，])/u;
const cashMedium = /(?:현금|현찰)(?:으로|로|을|를|은)?(?=$|[\s,，.!?])/u;
const employeeVisit = /(?:^|[\s,，])(?:금융\s*(?:회사|기관)\s*|은행\s*)?(?:담당\s*(?:자|직원)|직원|수거인|수령인)(?:이|가|은|는)\s*(?:(?:직접|나중에|당일에?|별도로)\s*)?(?:(?:집|댁|자택|수신지|거주지)(?:으로|로|에)\s*)?(?:방문(?:해(?:서)?|하여(?:서)?|하고)|찾아\s*(?:와서|가서|온\s*뒤|간\s*뒤))/u;
const cashReceipt = /^\s*(?:(?:직접|따로|당일에?)\s*)?(?:(?:현금|현찰)(?:으로|로|을|를)?\s*)?(?:받아\s*가(?:는|겠다고|기로)|받아\s*간(?:다는|다고)|(?:수거|회수|수령)하(?:는|겠다고|겠다는|기로)|가져\s*가(?:는|겠다고)|가져\s*간(?:다는|다고))/u;
const currentCollection = /(?:겠다고|ㄴ다고|다고|다는)\s*(?:연락|알려|적|설명|안내|내용|했다|했음)|(?:방식|방법|절차)(?:이)?라고\s*(?:연락|알려|알렸|적|안내|통보|설명)|(?:받아\s*간다는|수거한다는)\s*(?:내용|안내|연락)/u;
const separateCashPart = /(?:하지만|다만|한편|와는?\s*별개|이번엔\s*다른)|(?:같은\s*(?:금액|자료|요금)|[가-힣]{1,10})(?:을|를)\s*(?:환급|반환|돌려주|지원)/u;

function reportsWorkerCashCollection(action) {
  const debt = attributedLoan.exec(action);
  const visit = employeeVisit.exec(action);
  if (!debt || !visit || noCashCollection.test(action) || separateCashPart.test(action) ||
      !cashMedium.test(action) || !currentCollection.test(action)) return false;
  return pickupVerbAfterVisit(action, debt, visit);
}

function pickupVerbAfterVisit(action, debt, visit) {
  const visitEnd = visit.index + visit[0].length;
  if (debt.index < visit.index) return cashReceipt.test(action.slice(visitEnd).replace(/^서(?=\s)/u, ""));
  if (debt.index < visitEnd || action.slice(visitEnd, debt.index).trim()) return false;
  const afterDebt = action.slice(debt.index + debt[0].length).replace(/^[을를은는](?=\s|$)/u, "");
  return cashReceipt.test(afterDebt);
}

const cashObject = /(?:^|[\s,，])(?:현금|현찰)(?:을|를|은|만)?(?=$|[\s,，])/u;
const appointedPerson = /(?:(?:지정|지목|정해\s*놓|보내|안내)\s*(?:한|준|둔|온)|(?:정한|정해\s*준|보낸))\s*(?:사람|방문자|수거인|담당자|직원|대리인)(?:에게|한테)(?:만)?/u;
const inPersonDelivery = /^\s*직접\s*(?:넘기|인계하|전달하|건네|교부하)(?:는\s*(?:방식|방법)|도록|라(?:고|는)|라고|라는|야)/u;
const explicitDemand = /(?:요구|지시)(?:하라고|한\s*(?:내용|사실)|했다|했|함|하는|해\s*왔)|(?:하라(?:고|는)|하도록)\s*(?:요구|지시)/u;

function reportsAppointedCashHandover(action) {
  const money = cashObject.exec(action);
  const target = appointedPerson.exec(action);
  if (!money || !target || cashReturn.test(action) || separateCashPart.test(action) || !explicitDemand.test(action)) return false;
  const actionStart = Math.max(money.index + money[0].length, target.index + target[0].length);
  return inPersonDelivery.test(action.slice(actionStart));
}

const reportCashRole = new RegExp(String.raw`(?<![\p{L}\p{N}])(?<role>(?:${INVESTIGATIVE}|수사\s*기관|금융\s*(?:사|회사|기관)|은행))` +
  String.raw`(?:의)?(?<unit>(?:\s+(?:조사|수사|대출|상환|확인|담당(?:자)?|직원|심사|업무)){0,5})\s*` +
  String.raw`(?:이?라는|이?라고\s*(?:한|밝힌|소개한|말한)|(?:[을를]\s*)?자처한)\s*` +
  String.raw`(?:발신(?:자|인)|사람|상대(?:방)?|쪽)(?:이|가|은|는|에게|한테|에서)?(?=[\s,，]|$)`, "u");
const meetForDelivery = /(?:직접\s*)?(?:만나(?:서|는\s*(?:자리|곳)(?:에서|에)?)?|대면(?:해서|으로)?)(?=\s|$)/u;
const visitingCashRecipient = /(?:^|\s)(?:방문(?:하는|할)|찾아(?:오는|올))\s*(?:직원|담당자|대리인|요원|수사관)(?:에게|한테)(?:만)?\s*(?:직접\s*)?$/u;
const directedHandover = /(?:건네|넘겨|인계해|전달해|교부해)(?:야|라(?:고|는)|\s*달라)|(?:인계하|전달하|교부하|넘기)(?:라고|라는|도록)/u;
const returnToReceiver = /(?:제게|저에게|내게|나에게|수신자에게)(?:만)?\s*(?:직접\s*)?$/u;
const anotherCashPayer = /(?:^|[\s,，])(?:직원|담당자|발신(?:자|인)|상대(?:방)?|제삼자)(?:이|가|은|는)(?=[\s,，]|$)/u;
const otherDeliveryObject = /(?:서류|증빙|신분증|영수증|카드|물건|물품)(?:을|를|만)/u;

function requiresCashAtMeeting(action) {
  const cash = cashObject.exec(action);
  if (!cash || cashReturn.test(action) || separateCashPart.test(action)) return false;
  const afterCash = action.slice(cash.index + cash[0].length);
  const delivery = directedHandover.exec(afterCash);
  if (!delivery || delivery.index > 54) return false;
  const beforeDelivery = afterCash.slice(0, delivery.index);
  const meeting = action.slice(Math.max(0, cash.index - 42), cash.index) + " " + beforeDelivery;
  return (meetForDelivery.test(meeting) || visitingCashRecipient.test(beforeDelivery)) && !anotherCashPayer.test(meeting) &&
    !returnToReceiver.test(beforeDelivery) && !otherDeliveryObject.test(beforeDelivery);
}

const loanRoleContext = /(?:대출(?:금)?|융자(?:금)?)(?:을|를|의)?\s*(?:업무(?:를)?\s*)?(?:담당|맡)/u;
const recipientRepayment = /(?:갚을|갚아야\s*할|갚기로\s*한)\s*(?:몫|금액|액수|돈)/u;
const reportsPickupPlan = /(?:수령|수거|회수)하겠(?:다고|다는)|(?:받아|가져)\s*가겠(?:다고|다는)|(?:받아|가져)\s*간(?:다고|다는)/u;
const asksAboutCollection = /(?:수거|수령|받아\s*가|가지러\s*오|방문)(?:하는지|할지|할\s*수\s*있는지|하는\s*건지)|(?:방문|수거|수령)\s*여부/u;

const pickupCancellation = /^(?:(?<sender>(?:발신자|발신인|상대(?:방)?|보낸\s*사람)(?:가|이|는|은))\s*)?(?:그|이|해당|같은)\s*(?:현금\s*)?(?:수거|회수|방문)(?:\s*(?:계획|일정|요청|절차))?(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:취소|철회|중단)/u;
function hasClosedCashPickupPlan(clause) {
  const cancellation = pickupCancellation.exec(clause);
  if (!cancellation) return false;
  if (!cancellation.groups.sender) return true;
  return /^(?:\s*처리)?(?:(?:했|하였|됐|되었)(?:습니다|어요|다|음)|함|한다)[.!。]?$/u.test(clause.slice(cancellation[0].length).trim());
}
const preparesRepaymentInCash = /(?:현금|현찰)(?:으로|로)\s*(?:준비|마련)(?:해\s*(?:두면|놓으면)|하면|해\s*놓을\s*경우)\s*[,，]?\s*/u;
const issuerVisitsAfterPreparation = /^(?:(?:자기|자신|본인)(?:이|가)\s+)?(?:직접\s+)?(?:(?:집|댁|자택|거주지)(?:에|로|으로)\s+)?(?:방문(?:해(?:서)?|하여(?:서)?)|찾아(?:와서|가서|온\s*뒤|간\s*뒤))\s+/u;

function pickupAfterCashPreparation(action, debt) {
  const preparation = preparesRepaymentInCash.exec(action);
  const debtEnd = debt.index + debt[0].length;
  if (!preparation || preparation.index < debtEnd ||
      !/^(?:[을를은는이가])?\s*$/u.test(action.slice(debtEnd, preparation.index))) return false;
  const pickup = action.slice(preparation.index + preparation[0].length);
  const visit = issuerVisitsAfterPreparation.exec(pickup);
  return Boolean(visit && cashReceipt.test(pickup.slice(visit[0].length)));
}

function requiresLoanPickup(action, issuerClause, hasCurrentIssuer) {
  if (!cashMedium.test(action) || noCashCollection.test(action) || separateCashPart.test(action) ||
      asksAboutCollection.test(action) || !reportsPickupPlan.test(action)) return false;
  const debt = attributedLoan.exec(action) ?? (loanRoleContext.test(issuerClause) && recipientRepayment.exec(action));
  const visit = employeeVisit.exec(action) ?? staffVisit.exec(action);
  // 명시 발신자가 있는 한 절에서만, 준비 조건 뒤 무표지 주어를 그 발신자로 연결한다.
  return Boolean(debt && (visit ? pickupVerbAfterVisit(action, debt, visit) :
    hasCurrentIssuer && pickupAfterCashPreparation(action, debt)));
}

function* currentCashReports(text, extraRequest = () => false, extraIssuer = () => null) {
  const issuer = clause => openDirectedReport(clause) && roleBelongsToReportedSource(clause) &&
    (reportCashRole.exec(clause) || issuerForCurrentReport(clause) || extraIssuer(clause));
  // 이 단계에서는 현금 요구 후보만 찾는다. 지급자와 인수자는 발신자 소개를 뺀 본문에서 확인한다.
  const request = clause => extraRequest(clause) || cashMedium.test(clause) && (directedHandover.test(clause) || reportsPickupPlan.test(clause));
  for (const record of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, previous, next } of currentReceivedRequests(record, issuer, request)) {
      if (!openDirectedReport(body) || asksAboutCollection.test(body) || closedRemainder.test(next)) continue;
      const speakerHere = issuer(body);
      const speaker = speakerHere || ((receivedArtifactHere.test(previous) || receivedRoleNotice.test(previous) || extraIssuer(previous)) && issuer(previous));
      if (!speaker) continue;
      const { role, unit } = speaker.groups;
      const action = speakerHere ? body.slice(speaker.index + speaker[0].length) : body;
      yield { role, unit, action, source: speakerHere ? body : previous, speakerHere: Boolean(speakerHere), previous, next };
    }
  }
}

const statedInvestigationDuty = /^(?<role>수사(?:를|\s*업무(?:를)?)?\s*)(?:(?:담당(?:자)?이?라고)|(?:담당한다고|맡았다고|맡고\s*있다고))\s*(?:한|말한|밝힌|소개한|주장한)\s*(?:발신(?:자|인)|보낸\s*(?:사람|이)|상대(?:방)?|사람|쪽)(?:이|가|은|는)(?=\s|$)/u;
const heldByAddressee = /^(?:(?:제|내|수신자의)\s*|(?:(?:제가|내가|수신자가)\s*)?(?:(?:집|자택|댁)(?:에|에서)\s*)?(?:가진|가지고\s*있던|보관(?:한|하던|\s*중이던)|준비한|소지(?:한|하던))\s*)(?:현찰|현금)(?:을|를|만)(?=\s|$)/u;
const dutyPayee = /^(?:수사|조사)\s*(?:업무\s*)?담당\s*(?:직원|수사관|요원)(?:에게|한테)(?=\s|$)/u;
const physicalHandoff = /^(?:직접|대면(?:으로|해서)?)(?=\s|$)/u;
const issuedCashOrder = /^\s*(?:(?:요구|요청|지시)(?:를|을)?\s*(?:했|하였|한|받았)|(?:했|하였)(?:다|습니다|어요|고))/u;

function hasInvestigationDutyHandoff(action) {
  const order = directedHandover.exec(action);
  if (!order || !issuedCashOrder.test(action.slice(order.index + order[0].length))) return false;
  const argumentsNeeded = new Set([heldByAddressee, dutyPayee, physicalHandoff]);
  let argumentsText = action.slice(0, order.index).trim();
  while (argumentsText) {
    const first = [...argumentsNeeded].find(pattern => pattern.test(argumentsText));
    if (!first) return false;
    argumentsText = argumentsText.replace(first, "").trimStart();
    argumentsNeeded.delete(first);
  }
  return !argumentsNeeded.size &&
    cashEventEvidence(action, { investigative: true, sourceInClause: true, structuredReceiver: true }) === "investigative_handover";
}

function* reportedCashTransfers(text) {
  for (const { role, unit, action, source, speakerHere, next } of
    currentCashReports(text, undefined, clause => statedInvestigationDuty.exec(clause))) {
    if (investigator.test(role) && requiresCashAtMeeting(action) ||
        speakerHere && statedInvestigationDuty.test(source) && hasInvestigationDutyHandoff(action)) yield SIG_CASH_HANDOVER;
    if ((financialIssuer.test(role) || /^금융\s*사$/u.test(role)) && /직원|담당/u.test(unit ?? "") &&
        requiresLoanPickup(action, source, speakerHere && !hasClosedCashPickupPlan(next))) yield SIG_LOAN_CASH_PICKUP;
  }
}

const claimedInvestigator = new RegExp(
  "^(?<role>" + INVESTIGATIVE + "|수사\\s*기관)(?:에서\\s*(?:나왔|파견됐|파견되었)|[을를]\\s*대표해(?:서)?\\s*왔)" +
  "다고\\s*(?:한|밝힌|설명한|말한)\\s*(?:사람|직원|담당자|상대(?:방)?|발신자)(?:이|가|은|는)(?=\\s|[,，])", "u");
const representativePayee = /(?:(?:자기|자신|본인|우리)(?:가|이)?\s*(?:쪽|소속|보낸|파견한)|(?:같은|해당)\s*기관(?:의)?)\s*(?:직원|담당자|수사관|요원|대리인)(?:에게|한테)\s*(?:(?:현금|현찰)(?:을|를|은|만)?\s*)?(?:직접\s*)?(?:건네|넘기|넘겨|인계하|전달하|교부하)/u;

const originalLenderClaim = /^(?<role>(?:(?:제가|내가|수신자가)\s*)?(?:대출|융자)(?:을|를)?\s*받(?:은|았던)\s*(?:곳|기관|업체|은행|금융회사))의\s*(?<unit>(?:(?:대출|상환)\s*)?담당(?:자|\s*직원))이?라고\s*(?:하|밝히|소개하|알리)면서\s*/u;
const changesBranchRepayment = /^(?<debt>(?:(?:남은|잔여|미상환)\s*)?(?:(?:대출(?:금)?|융자금)\s*)?상환(?:금|액)(?:을|를|은|는)?)\s*(?:(?:그|해당|같은)\s*)?(?:지점|영업점)(?:에서|에)\s*(?:받지\s*않고|납부하지\s*않고|내지\s*않고|(?:받는|납부하는|내는)\s*대신)\s*[,，]?\s*/u;
const lenderEmployee = /^(?:(?:(?:그|해당|같은)\s*(?:지점|영업점|회사|기관)(?:\s*소속)?|(?:우리|저희|자기|자신)(?:의)?\s*(?:회사|금융회사|업체|기관))(?:의)?\s*)?(?:담당\s*)?직원(?:이|가|은|는)(?=\s)/u;
const personalLoan = /(?:지인|친구|가족|개인)(?:에게|한테)(?:서)?\s*(?:빌린|빌렸)|(?:개인\s*간|사적인)\s*(?:대여|차용)/u;
const namedLoanAlreadyPaid = /^(?:그|해당|같은|이)\s*(?:대출금|융자금|상환(?:금|액))(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:(?:모두|다|전부)\s*)?(?:갚았|갚은|완납했|완납됐|상환했|상환이\s*끝났)/u;

function pendingBranchPickup(action, source, previous, next) {
  if (!originalLenderClaim.test(source) || personalLoan.test(previous + " " + source) ||
      namedLoanAlreadyPaid.test(previous) || namedLoanAlreadyPaid.test(next)) return "";
  const branch = changesBranchRepayment.exec(action.trimStart());
  if (!branch) return "";
  // 명시적으로 제외한 창구는 방문 수거 경로에 포함하지 않는다.
  const collector = action.trimStart().slice(branch[0].length);
  return lenderEmployee.test(collector) ? branch.groups.debt + " " + collector : "";
}

const financialStaffSelfIntroduction = /^(?<role>은행|금융\s*(?:회사|기관|사))(?:의)?\s*(?<unit>(?:(?:대출|융자|상환)\s*)?(?:직원|담당(?:자|\s*직원)?))(?:으로|로)\s*(?:자신|본인|자기)(?:을|를)\s*(?:소개한|밝힌)\s*(?:발신(?:자|인)|(?:연락\s*)?상대(?:방)?|보낸\s*사람|사람|쪽)(?:이|가|은|는)(?=\s|$)/u;

function alternateCashSource(clause) {
  const staffClaim = financialStaffSelfIntroduction.exec(clause);
  if (staffClaim) return staffClaim;
  const lender = originalLenderClaim.exec(clause);
  if (lender) return lender;
  const document = readInvestigativeCashDocument(clause);
  if (document) return document;
  const representative = claimedInvestigator.exec(clause);
  if (representative && representativePayee.test(clause.slice(representative[0].length))) return representative;
  const sender = readInstitutionIssuer(clause);
  if (sender && investigator.test(sender.name) && /(?:이래|라네요|이라며)[.?!]?\s*$/u.test(clause)) {
    return { index: 0, 0: clause, groups: { role: sender.name, unit: "" } };
  }
  return null;
}

const cashRecordHeading = /(?:받은|수신|발췌|문자\s*일부|문자\s*상담|통지서)/u;
const cashRecordRow = /^(?<key>[가-힣 ]{1,34}?)(?:\s*[|:：]\s*|[ \t]{2,}|\u3000+)(?<value>\S.*)$/u;
const cashRecordAction = /(?:수단|방식|방법|요구|요청|인계|수거|받는|받으러|받기로|수취|상환|준비|항목|용도)/u;

function* cashRecordFacts(blocks) {
  for (const { body: record, rows: fieldLines, cashClosed } of blocks) {
    if (!openDirectedReport(record) || !roleBelongsToReportedSource(record)) continue;
    const [heading, ...lines] = fieldLines.length === 1 ? fieldLines[0].split(summarySplit).map(line => line.trim()) : fieldLines;
    if (!cashRecordHeading.test(heading ?? "") || lines.length < 2 || lines.length > 5) continue;
    const sources = [heading, ...lines].map(line => {
      const row = cashRecordRow.exec(line)?.groups;
      const normalized = row ? row.key + ": " + row.value : line;
      const named = summaryRole.exec(line)?.groups.value ?? issuerField.exec(normalized)?.groups.value;
      const declared = named && institutionTitle.exec(named)?.groups.role;
      return declared ? { name: declared } : readInstitutionIssuer(named ? "발신처: " + named : normalized);
    }).filter(Boolean);
    if (sources.length !== 1) continue;
    const [source] = sources;
    const fields = lines.map(line => cashRecordRow.exec(line)?.groups).filter(field=>field && cashRecordAction.test(field.key));
    const actionRows = fields.map(field => field.value);
    const proceduralLine = lines.find(line => !cashRecordRow.test(line) && /(?:직접\s*)?(?:건네|넘기|인계하|전달하)는\s*방식(?:으로)?\s*(?:적|기록|표시)/u.test(line));
    if (proceduralLine) actionRows.push(proceduralLine);
    yield { source: source.name, heading, fields, action: actionRows.join(" "), cashClosed };
  }
}

const unperformedPickupNote = /[,，]\s*(?:(?:다만|그리고)\s*)?(?:(?:예정된|실제(?:로)?)\s*){0,2}(?:방문|수거|회수|수령)(?:은|는|이|가|을|를)?\s*아직\s*(?:실제로\s*)?(?:하지|이행되지|이뤄지지)\s*않았(?:다|습니다|음|다고\s*(?:기록했|기록됐|확인했|확인됐)다|다는\s*(?:상태\s*)?(?:기록|메모)(?:이|가)?\s*(?:남았다|있었다|기록됐다))\s*[.!。]?\s*$/u;

export function* cashEventSignals(text, blocks = structuredRecordBlocks(text)) {
  for (const { role, unit, action, source, speakerHere, previous, next } of currentCashReports(text, couldDescribeCashTransaction, alternateCashSource)) {
    if (!openDirectedReport(action) || hasClosedCashPickupPlan(next)) continue;
    const branchPickup = speakerHere ? pendingBranchPickup(action, source, previous, next) : "";
    const investigative = investigator.test(role);
    const financialStaff = Boolean(branchPickup) || (financialIssuer.test(role) || /^금융\s*사$/u.test(role)) && /직원|담당/u.test(unit ?? "");
    const reportedPlan = branchPickup || action;
    // 같은 수신 보고에서 방문·수거의 실행 여부는 그에 앞서 확인한 계획과 따로 읽는다.
    const evidence = cashEventEvidence(financialStaff && !investigative ? reportedPlan.replace(unperformedPickupNote, "") : reportedPlan, {
      investigative, financialStaff,
      loanFromSource: loanRoleContext.test(source),
      sourceInClause: speakerHere,
    });
    if (evidence === "investigative_handover") yield SIG_CASH_HANDOVER;
    if (evidence === "staff_loan_pickup") yield SIG_LOAN_CASH_PICKUP;
  }
  const records = [...structuredFrames(blocks)].map(({ issuer, sender, heading, fields, cashOnly, cashClosed }) => ({
    source: issuer, sender, heading, cashOnly, cashClosed, fields: fields.map(({label, value}) => ({key: label, value})),
    action: fields.map(field => field.value).join(" "),
  }));
  for (const { source, sender = source, heading, fields, action, cashOnly, cashClosed } of [...records, ...cashRecordFacts(blocks)]) {
    const structuredLoan = /(?:대출|융자|상환)/u.test(heading) ||
      fields.some(field => /상환/.test(field.key) || attributedLoan.test(field.value));
    const structuredReceiver = fields.some(field =>
      /받으러|수취인|수령인/.test(field.key) && /직원|담당자|경찰|수사관|수거인/u.test(field.value));
    const evidence = cashEventEvidence(action, {
      investigative: !cashClosed && investigator.test(source),
      financialStaff: !cashOnly && /(?:금융\s*(?:회사|기관|사)|은행)$/u.test(source) && (structuredLoan || /직원|담당/u.test(sender)),
      loanFromSource: loanRoleContext.test(sender),
      sourceInClause: false,
      structuredLoan,
      structuredReceiver,
      structuredHandoff: fields.some(field => /요구|요청|지시/u.test(field.key)),
    });
    if (evidence === "investigative_handover") yield SIG_CASH_HANDOVER;
    if (evidence === "staff_loan_pickup") yield SIG_LOAN_CASH_PICKUP;
  }
}

function issuerForCurrentReport(text) {
  if (!openDirectedReport(text) || anotherTopic.test(text) || !roleBelongsToReportedSource(text)) return null;
  return receivedRoleNotice.exec(text) ?? reportedRoleOrigin.exec(text) ??
    claimedNotice.exec(text) ?? claimedPerson.exec(text) ?? issuerInReport(text);
}

function* institutionTransactionReports(text, unverifiedLinks) {
  const identifiesIssuer = clause => issuerForCurrentReport(clause) || concurrentIssuerClaim.test(clause) || hasRecordedIssuerClaim(clause);
  const identifiesAction = clause => issuerAskedForIdentityReply(clause) || hasRecordedIdentityReply(clause) ||
    Boolean(linkedDestination(clause, unverifiedLinks)) ||
    formName.test(clause) || requiresRecipientIdentity(clause) ||
    reportsWorkerCashCollection(clause) || reportsAppointedCashHandover(clause);
  for (const record of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, previous, next } of currentReceivedRequests(record, identifiesIssuer, identifiesAction)) {
      if (!openDirectedReport(body) || closedRemainder.test(next)) continue;
      if (issuerAskedForIdentityReply(body) || recordedSelfClaim.test(previous) && requiresRecipientIdentity(body)) yield SIG_PERSONAL_INFO;
      if (hasRecordedIssuerClaim(previous) && hasRecordedIdentityReply(body) && !identifiesIssuer(body)) {
        yield SIG_PERSONAL_INFO;
      }
      const current = issuerForCurrentReport(body);
      const previousSender = current ? null : issuerForCurrentReport(previous);
      if (!current && (!previousSender || !receivedArtifactHere.test(previous))) continue;
      const { role, unit } = (current ?? previousSender).groups;
      const action = current ? body.slice(current.index + current[0].length) : body;
      if (!openDirectedReport(action)) continue;
      if (current && !ORDINARY_LOOKUP.test(body) && suppliedApplicationForm(action, unverifiedLinks)) yield SIG_LINK;
      // 같은 수신 기록의 본문이 직접 지정한 목적지만 이전 발신 표시와 결합한다.
      const arrived = receivedArtifactHere.test(current ? body : previous);
      const destination = arrived && !ORDINARY_LOOKUP.test(current ? body : previous) && linkedDestination(action, unverifiedLinks);
      if (destination) yield destination;
      if (investigator.test(role) && reportsAppointedCashHandover(action)) yield SIG_CASH_HANDOVER;
      if (financialIssuer.test(role) && /직원|담당/u.test(unit) &&
          (current || continuationEvidence.test(body)) && reportsWorkerCashCollection(action)) yield SIG_LOAN_CASH_PICKUP;
    }
  }
}

const formRow = /^\|\s*(?<label>[^|]*?)\s*\|\s*(?<value>[^|]*?)\s*\|$/u;
const formDivider = /^\|\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*\|$/u;
const labeledRow = /^(?<label>[^:：|]{1,32})\s*[:：|]\s*(?<value>.*)$/u;
const installationFields = new Map([
  ["actor", ["설치담당", "설치담당자", "설치수행자", "설치주체", "설치하는사람"]],
  ["device", ["설치대상", "설치대상기기", "설치기기"]],
  ["requirement", ["필수여부", "설치필수여부", "설치조건", "설치요건"]],
  ["status", ["설치상태", "설치진행상태", "요청상태", "요구상태"]],
  ["route", ["설치경로", "설치출처", "프로그램출처"]],
  ["action", ["설치항목", "설치요청", "필수항목", "필수설치항목"]],
].flatMap(([kind, labels]) => labels.map(label => [label, kind])));
const recordMetadata = new Set(["문서번호", "수신시각", "수신시간", "수신일", "수신일자", "기록일", "작성일", "시행일"]);
const newRecordLabel = /^(?:(?:새(?:로운)?|별도|다음|다른)(?:의)?(?:문서|기록|연락|안내|양식|요청)|(?:문서|기록|양식)(?:제목|시작))$/u;
const installationActionField = /^(?:받은\s*(?:요청|요구)|(?:요청|요구)\s*(?:항목|사항|내용)|해야\s*할\s*일)$/u;
const legacyInstallationLabel = /항목|해야\s*할\s*일/u;
const recipientInstaller = /^(?:수신자|받은\s*(?:사람|이)|신고인|민원인|고객|본인|나|저|제가|내가)$/u;
const recipientEquipment = /^(?:(?:수신자(?:의)?|받은\s*(?:사람|이)(?:의)?|본인(?:의)?|제|내)\s*(?:개인(?:용)?\s*)?|개인(?:용)?\s*)(?:기기|단말(?:기)?|휴대\s*(?:폰|전화)|스마트폰|컴퓨터|노트북)$/u;
const requiredInstallationField = /^(?:필수(?:\s*항목)?|의무|예|필요|해야\s*함)$/u;
const activeInstallationStatus = /^(?:대기(?:\s*중)?|진행\s*중|요청됨|미처리|미이행|미설치|유효|수신|접수\s*대기)$/u;
const exactRequestedInstallation = new RegExp("^" + remoteInstall.source + "(?:\\s*(?:요청(?:됨)?|필수|필요|해야\\s*함))?[.!。]?$", "u");
const installationDescription = /(?:설치(?:가|는)?\s*(?:여부|유무|방법|절차\s*안내|기록|이력|예시|참고)|설치하지|설치\s*(?:금지|불필요)|설치(?:가|는)?\s*(?:필요하지|필요\s*없|끝났|완료|취소|철회))/u;

// 발신과 요청·담당 행을 같은 수신 기록에서만 읽는다. 별도의 표나 기록을 이어 붙이지 않는다.
function* installationRows(lines, start) {
  if (!lines[start] && formDivider.test(lines[start + 2] ?? "")) start++;
  const table = formRow.test(lines[start] ?? "") && formDivider.test(lines[start + 1] ?? "");
  for (let index = start + (table ? 2 : 0); lines[index]; index++) {
    const line = lines[index];
    if (!table) {
      if (formRow.test(line)) break;
      yield line;
      continue;
    }
    const row = formRow.exec(line);
    if (!row || formDivider.test(lines[index + 1] ?? "")) break;
    yield row.groups.label + ": " + row.groups.value;
  }
}

function structuredInstallation(rows) {
  let sender = "";
  let closed = false;
  const actions = [];
  const details = new Map();
  for (const row of rows) {
    if (anotherTopic.test(row) || startsOtherOrganizer(row)) break;
    if (closedRemainder.test(row.replace(dispositionField, ""))) {
      closed = true;
      break;
    }
    const issuer = issuerField.exec(row);
    if (issuer) {
      if (sender) break;
      sender = issuer.groups.value.trim();
      continue;
    }
    const entry = labeledRow.exec(row)?.groups;
    const label = entry?.label.replace(/\s/g, "");
    const kind = installationFields.get(label);
    // 경로 표기만으로 받은 설치 요청 자체를 무효로 보지 않는다.
    if (kind === "route" || recordMetadata.has(label)) continue;
    const field = relevantField.exec(row)?.groups;
    if (!kind && !field) {
      if (!entry || !label || newRecordLabel.test(label)) break;
      // 같은 양식의 부가 필드 뒤에도 담당자나 철회 상태가 올 수 있다.
      continue;
    }
    if (kind && kind !== "action") {
      if (details.has(kind)) return false;
      details.set(kind, entry.value.trim());
    } else if (kind || installationActionField.test(field.label)) {
      const legacy = !kind && legacyInstallationLabel.test(field.label);
      actions.push({ value: kind ? entry.value.trim() : field.value, legacy });
    }
  }
  if (!sender || closed) return false;
  const genericIssuer = issuerLabel.test(sender);
  const requested = ({ value }) => remoteInstall.test(value) && !staffInstallation.test(value) &&
    !noInstallation.test(value) && !installationDescription.test(value) && !notCurrent.test(value);
  const actor = details.get("actor");
  const device = details.get("device");
  const requirement = details.get("requirement");
  const status = details.get("status");
  if (requirement !== undefined && !requiredInstallationField.test(requirement) ||
      status !== undefined && !activeInstallationStatus.test(status)) return false;
  if (actor === undefined && device === undefined) {
    return genericIssuer && actions.some(action => action.legacy && requested(action));
  }
  return (genericIssuer || isCardSenderName(sender)) && actions.length === 1 &&
    exactRequestedInstallation.test(actions[0].value) && recipientInstaller.test(actor ?? "") && recipientEquipment.test(device ?? "");
}

function hasStructuredInstallation(text) {
  const lines = text.split(/\r?\n/u).map(line => line.trim());
  return lines.some((heading, index) => recordedNotice.test(heading) && !notCurrent.test(heading) &&
    !labeledRow.exec(heading)?.groups.value && !formRow.test(heading) && !anotherTopic.test(heading) &&
    structuredInstallation(installationRows(lines, index + 1)));
}

const dispatchAssertion = "(?:소개|밝|설명|기재|표시|적)";
const redirectRole = String.raw`(?<![\p{L}\p{N}])${reportedRole}(?:\s+[가-힣]{1,12}){0,3}?`;
const declaredDispatch = new RegExp(redirectRole + String.raw`\s*(?:에서|이|가)\s*(?:보냈|발송했|전달했)(?:다고|다는)\s*` + dispatchAssertion, "u");
const attributedRedirect = new RegExp(redirectRole + String.raw`\s*(?:이?라고)\s*` + dispatchAssertion +
  String.raw`[가-힣]*\s*(?:쪽|곳|사람|상대|발신자)(?:에게서|한테서|에서)(?:\s*연락(?:이|은)?)?\s*(?:왔|도착했|받았)`, "u");
const redirectSelfDescription = new RegExp(reportingSender + String.raw`(?:이|가|은|는)\s*` + redirectRole +
  String.raw`\s*(?:이?라고)\s*(?:(?:자신|자기)(?:을|를)\s*)?` + dispatchAssertion, "u");

function claimsRedirectIssuer(clause) {
  return openDirectedReport(clause) && !anotherTopic.test(clause) && roleBelongsToReportedSource(clause) &&
    Boolean(issuerForCurrentReport(clause) || declaredDispatch.test(clause) ||
      attributedRedirect.test(clause) || redirectSelfDescription.test(clause));
}

const establishedRoute = /(?:기존|(?:평소|늘)\s*(?:알던|쓰던|쓰는|사용하던)|(?:청사|(?:시|군|구|도)청|해당\s*기관)(?:에서|이|가)\s*(?:쓰는|사용하는|운영하는)|공식|대표)(?:\s*공식)?\s*(?:접수처|창구|민원실|페이지|주소|연락처|전화번호|곳)(?:가|이|을|를|와는?|과는?)?\s*(?:아닌|아니라|대신|말고|별개|다른)/u;
const requiredAddressUse = /^\s*(?:에서|으로|로|에)(?:만)?\s*(?:[가-힣]{1,12}\s+){0,4}?(?:(?:확인|열람|조회|접속|신청|접수)(?:하도록|하라고|하라는|해야|할(?:\s*것)?을\s*(?:요구|요청))|들어가(?:도록|라고|야)|들어갈\s*것을\s*(?:요구|요청)|읽(?:으라고|으라는|어야)|보(?:라고|라는)|봐야)/u;
function requiresParsedAddressToken(token, after, unverifiedLinks) {
  if (!isUnverifiedAddressToken(token, unverifiedLinks)) return false;
  if (requiredAddressUse.test(after)) return true;

  const direction = readUnregisteredAddressDirection(token);
  return Boolean(direction && requiredAddressUse.test(direction + after));
}
function replacesEstablishedAddress(action, unverifiedLinks) {
  if (!unverifiedLinks.length || ORDINARY_LOOKUP.test(action) || informationalAddress.test(action) ||
      !establishedRoute.test(action)) return false;
  for (const token of action.matchAll(/\S+/gu)) {
    if (requiresParsedAddressToken(token[0], action.slice(token.index + token[0].length), unverifiedLinks)) return true;
  }
  return false;
}

const selectedBySender = /(?:자기(?:들)?|자신(?:들)?|발신(?:자|인|처)|보낸\s*(?:사람|이|쪽)|상대(?:방)?)(?:이|가|은|는)?\s*(?:(?:아까|방금|직접|새로|따로)\s*)?(?:지정한|정한|정해\s*준|보낸|(?:적어|써)\s*보낸|알려\s*준)\s*$/u;
const publishedPhone = /(?:전화|회신|통화|연락|상담|문의)\s*(?:전용\s*)?(?:번호|연락처)\s*[:：]?\s*(?<number>0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1\d{3}[- ]?\d{4})(?![\d-])/gu;
const requiredCallback = /^\s*(?:으로|로|에)(?:만)?\s*(?:직접\s*)?(?:(?:전화|통화|회신|연락|답(?:변)?|응답|문의)(?:을|를)?\s*(?:하라(?:고|는)?|하도록|해야|해\s*달라|받아야|보내야|줘야|주어야))/u;
const optionalRoute = /선택\s*사항|(?:공식|대표|기존)\s*(?:연락처|번호|창구)(?:로도|에서도|에)\s*(?:가능|연결)|(?:전화|회신|연락)(?:을|를)?\s*(?:할\s*필요(?:가|는)?\s*없|하지\s*않아도)/u;
function requiresSenderSelectedCallback(action) {
  if (optionalRoute.test(action) || excludedReply.test(action)) return false;
  for (const target of action.matchAll(publishedPhone)) {
    if (!isCardCallbackNumber(target.groups.number) && selectedBySender.test(action.slice(0, target.index)) &&
        requiredCallback.test(action.slice(target.index + target[0].length))) return true;
  }
  return false;
}

const actualPhone = /(?<![\d-])(?:0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1\d{3}[- ]?\d{4})(?![\d-])/gu;
const noticeContainsNumber = /(?:(?:그|이|해당|받은)\s*(?:문자|메시지|통지|안내|안|본문)(?:\s*안)?|본문)(?:에|에는|속에)\s*(?:(?:번호|연락처)\s*[:：]?\s*)?$/u;
const numberIsPrinted = /^\s*(?:이|가|은|는)?\s*(?:적혀|실려|표시(?:돼|되어)|기재(?:돼|되어)|나와|있)/u;
const referencedNumber = /(?:그|이|해당)\s*(?:전화\s*)?(?:번호|연락처)/u;
const asksIfRequired = /(?:해야|하는지)\s*(?:하는지|하는지를|하는\s*건지|물었|문의했)|(?:할지|할\s*필요가\s*있는지)/u;

function requiresPrintedCallback(action) {
  const numbers = [...action.matchAll(actualPhone)];
  if (numbers.length !== 1 || optionalRoute.test(action) || excludedReply.test(action) || asksIfRequired.test(action)) return false;
  const [number] = numbers;
  if (isCardCallbackNumber(number[0]) || !noticeContainsNumber.test(action.slice(0, number.index))) return false;
  const tail = action.slice(number.index + number[0].length);
  const reference = referencedNumber.exec(tail);
  return numberIsPrinted.test(tail) && Boolean(reference && requiredCallback.test(tail.slice(reference.index + reference[0].length)));
}

function requiresReportedExternalInstallation(action) {
  return /(?:휴대\s*(?:전화|폰)|스마트폰|기기|단말|컴퓨터)(?:에서|에)(?=\s|$)/u.test(action) &&
    !asksIfRequired.test(action) && requiresRecipientInstallation(action);
}

function* reportedRouteChanges(text, unverifiedLinks) {
  const request = clause => replacesEstablishedAddress(clause, unverifiedLinks) || requiresSenderSelectedCallback(clause) ||
    requiresPrintedCallback(clause) || requiresReportedExternalInstallation(clause);
  for (const record of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, previous, next } of currentReceivedRequests(record, claimsRedirectIssuer, request)) {
      if (!openDirectedReport(body) || closedRemainder.test(next)) continue;
      const action = body.split(quoteBoundary, 1)[0];
      const sameReceivedSource = claimsRedirectIssuer(action) ||
        (receivingContext.test(previous) || attributedRedirect.test(previous)) && claimsRedirectIssuer(previous);
      if (!sameReceivedSource) continue;
      if (replacesEstablishedAddress(action, unverifiedLinks)) yield SIG_LINK;
      if (requiresSenderSelectedCallback(action) || requiresPrintedCallback(action)) yield SIG_CALL_THIS_NUMBER;
      if (hasOpenInstallationReport(action, next, requiresReportedExternalInstallation)) yield SIG_APP_INSTALL;
    }
  }
}

const directRoleReceipt = new RegExp("^" + roleTitle +
  "\\s*(?:이?라는\\s*(?:사람|상대(?:방)?|쪽)(?:이|가|은|는|에서)?|이?라며|" +
  "이?라고\\s*(?:소개한|밝힌|설명한|한)\\s*(?:사람|발신(?:자|인)|상대(?:방)?|쪽)(?:이|가|은|는|에서)?|" +
  "(?:[을를]\\s*)?자처한\\s*(?:문자|메시지|연락|통지|안내)(?:에는|에서|에|의)?)(?=[\\s,，]|$)", "u");
const arrivalContext = /(?:받았|받은|수신|보냈|보낸|발송|도착|연락(?:이\s*왔|했|해\s*왔)|(?:문자|메시지|통지|안내)(?:에\s*관한|로\s*답|였|라고|에\s*적힌))/u;
const sameDocumentReference = /^(?:(?:그|이|해당|같은|받은|수신한)\s*)?(?:문자|메시지|본문|통지|안내문?|답장|회신)(?:에|에서|의|에는)(?:\s|$)/u;
const continuedDemand = /(?:요구|요청|지시)(?:를|을|가|이|는|은)(?:\s*(?:받았|있었|적혔|담겼|기재|포함|들어))|(?:라고|라는|다는)\s*(?:요구|요청|지시|내용|조건)/u;
const otherEventActor = /^(?:(?:이웃|지인|친구|동료|가족|배우자)(?:이|가|은|는)(?=\s)|(?:제가|내가|저는|수신자가|기록자가)\s*(?:먼저|직접)\s*[^.!?\n]{0,22}(?:요청|문의|부탁|제안))/u;
const questionedDemand = /(?:해야|하라|달라|하도록)\s*(?:하는지|할지|하는\s*건지)|(?:할\s*필요가\s*있는지|해야\s*하는지를)\s*(?:물|문의)/u;

const selfClaimedArtifact = new RegExp(
  "^(?:(?:받은|수신한)\\s*)?(?:" + reportedRole + "|건강\\s*보험\\s*기관)\\s*" +
  "(?:(?:(?!아닌(?:\\s|$)|없는(?:\\s|$)|사칭\\s*예시)[가-힣]{1,10}\\s+){0,3}[가-힣]{0,8}(?:팀|담당(?:자|부서)?|센터|창구|직원)\\s*)?" +
  "(?:[을를]\\s*(?:자처|자칭)한|이?라고\\s*(?:(?:자신|자기)[을를]\\s*)?(?:소개(?:한|된)|밝힌|설명(?:한|된)|표시(?:한|된)))\\s*" +
  "(?:문자|메시지|안내(?:문)?|통지(?:문)?|알림|쪽지)(?:[이가은는]|(?:였|이었|입니다|예요|이라고))(?=\\s|[.!?]|$)", "u");
const directedLinkObject = /(?:(?:읽으|보|들어가)라|(?:열람|확인|조회|접속)하라)(?:고|는)\s*(?:안내한\s*)?(?:링크|주소)(?=\s|[을를은는])/u;
const addressSentByNotice = /^(?:\s+\S+\s*)?(?:을|를)\s*(?:보냈|전달했|첨부했|붙여\s*보냈|보내\s*왔)/u;
const displayedNoticeAddress = /^(?:(?:(?:그|이|해당|받은)\s*)?(?:문자|메시지|안내문?|통지|알림|화면|본문)(?:에|에서)\s*)?(?:표시|기재|표기)(?:된|돼\s*있던)\s*(?:주소|링크)(?:은|는|가|이)?(?:\s*[:：])?\s+/u;
const printedContactPrefix = /^(?:(?:(?:그|이|같은|해당|받은)\s*)?(?:문자|메시지|안내문?|통지|알림|본문)(?:의\s*본문)?)(?:에|에는|\s*속에)\s*(?:적힌|실린|기재된|표시된|나온)\s*$/u;
const requiredBodyCallback = /^\s*(?:으로|로|에)(?:만)?\s*(?:(?:다시|직접|먼저)\s*)?(?:전화|통화|회신|연락)(?:을|를)?\s*(?:하라(?:고|는)|하도록|해야)(?!\s*(?:했는지|해야\s*하는지|하는지|하는\s*건지|하는\s*것인지|건지|할지|할\s*필요))/u;
const requestQuotedAsExample = /(?:라는|다는)\s*(?:인용|예시|가정|설명문)/u;

const recordedInstallationIssuer = new RegExp(
  "^(?:(?:받은|수신한)\\s*)?" + reportedRole + "\\s*" +
  "(?:(?:[가-힣]{1,10}\\s+){0,3}(?:팀|부서|담당(?:자|부서)?|센터|창구|직원)\\s*)?" +
  "이?라고\\s*(?:적힌|기재된|표시된)\\s*" + deliveryArtifact + "(?:에|에는|에서)(?=\\s|$)", "u");
const selectedInstallation = /(?:(?:새(?:로운)?\s*전용|별도(?:의)?(?:\s*외부)?|외부(?:의)?)\s*)(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*설치(?:를|가)?\s*(?:요구|지시|요청|필수)/u;
const installationDemandInquiry = /(?:설치\s*)?(?:요구|지시|요청|의무)(?:는|은|이|가)?\s*(?:있는지|있었는지|인지를?|하였는지|했는지|하는지)|설치\s*(?:조건|사실)\s*여부/u;

function hasRecordedInstallationDemand(action) {
  return openDirectedReport(action) && !staffInstallation.test(action) && !noInstallation.test(action) &&
    !installationDemandInquiry.test(action) && selectedInstallation.test(action);
}

function hasClaimedArtifact(clause) {
  return selfClaimedArtifact.test(clause) && openDirectedReport(clause) &&
    !anotherTopic.test(clause) && roleBelongsToReportedSource(clause);
}

function asksToUseSentLink(action) {
  const object = directedLinkObject.exec(action);
  return Boolean(object && addressSentByNotice.test(action.slice(object.index + object[0].length))) &&
    !informationalAddress.test(action) && !requestQuotedAsExample.test(action);
}

function hasBodyContactDemand(action) {
  const numbers = [...action.matchAll(actualPhone)];
  if (numbers.length !== 1 || optionalRoute.test(action) || excludedReply.test(action) ||
      asksIfRequired.test(action) || requestQuotedAsExample.test(action)) return false;
  const [number] = numbers;
  return !isCardCallbackNumber(number[0]) && printedContactPrefix.test(action.slice(0, number.index)) &&
    requiredBodyCallback.test(action.slice(number.index + number[0].length));
}

function onlyUnverifiedNoticeAddress(record, action, unverifiedLinks) {
  if (!unverifiedLinks.length || informationalAddress.test(action) || linkFromReporter.test(action)) return false;
  const { candidates, complete } = inspectLinkCandidates(record);
  const target = candidates[0];
  if (!complete || candidates.length !== 1 || !target.host || !unverifiedLinks.includes(target.raw)) return false;
  const display = displayedNoticeAddress.exec(action);
  const object = directedLinkObject.exec(action);
  const label = display ?? object;
  if (!label) return false;
  const token = action.slice(label.index + label[0].length).trimStart().split(/\s/u, 1)[0];
  return isUnverifiedAddressToken(token, unverifiedLinks);
}

function issuerOfReceivedEvent(clause) {
  if (!openDirectedReport(clause) || !roleBelongsToReportedSource(clause) || !arrivalContext.test(clause)) return false;
  return Boolean(directRoleReceipt.test(clause) || issuerForCurrentReport(clause) || claimedIssuer(clause));
}

const asksAboutSendingLink = /(?:보냈|전달했|기재했|첨부했|받았)을까요|(?:보냈는지|전달했는지|받았는지)\s*(?:물|문의)/u;
const linkFromReporter = /(?:제가|내가|수신자가|기록자가)\s*[^.!?\n]{0,26}(?:주소|링크|양식)[^.!?\n]{0,34}(?:보냈|전달했|붙였|추가했)/u;
function localUnverifiedLink(action, unverifiedLinks) {
  if (!unverifiedLinks.length || ORDINARY_LOOKUP.test(action) || informationalAddress.test(action) ||
      asksAboutSendingLink.test(action) || linkFromReporter.test(action)) return false;
  const { candidates, complete } = inspectLinkCandidates(action);
  return complete && candidates.some(({ raw, protocol }) =>
    (protocol === "http:" || protocol === "https:") && unverifiedLinks.includes(raw));
}

// 기관 역할과 각 행동은 같은 수신 문장의 현재 범위에서 확인한다.
function* sameInstitutionEventActions(text, unverifiedLinks, installFromDirectPatterns) {
  const hasAction = clause => localUnverifiedLink(clause, unverifiedLinks) || asksToUseSentLink(clause) || hasBodyContactDemand(clause) ||
    hasRecordedInstallationDemand(clause) ||
    installFromDirectPatterns(clause) || personalDisclosure(clause, { recordedReply: true }).reply ||
    classifyCallback(clause, [], { includeReportedDirective: true }).directed;
  const requiresRecipientApp = clause => !staffInstallation.test(clause) && !noInstallation.test(clause) &&
    !questionedDemand.test(clause) && (requiresRecipientInstallation(clause) || installFromDirectPatterns(clause));

  for (const report of text.split(/\r?\n[ \t]*\r?\n/u)) {
    const reportedIssuer = clause => issuerOfReceivedEvent(clause) || hasClaimedArtifact(clause) || recordedInstallationIssuer.test(clause);
    for (const { body, previous, next } of currentReceivedRequests(report, reportedIssuer, hasAction)) {
      const action = body.split(quoteBoundary, 1)[0];
      if (!openDirectedReport(action) || !roleBelongsToReportedSource(action) || closedRemainder.test(next) ||
          questionedDemand.test(action)) continue;
      // 소개된 발신 문서와 같은 수신 기록 안에서만 명시된 목적지를 결합한다.
      const here = hasClaimedArtifact(action);
      const reportedInstallation = recordedInstallationIssuer.exec(action);
      if (reportedInstallation &&
          hasOpenInstallationReport(action.slice(reportedInstallation[0].length), next, hasRecordedInstallationDemand)) {
        yield SIG_APP_INSTALL;
      }
      const prior = !otherEventActor.test(action) && hasClaimedArtifact(previous);
      if ((here && asksToUseSentLink(action) || prior && asksToUseSentLink(previous) && displayedNoticeAddress.test(action)) &&
          onlyUnverifiedNoticeAddress(report, action, unverifiedLinks)) yield SIG_LINK;
      if (prior && hasBodyContactDemand(action)) yield SIG_CALL_THIS_NUMBER;
      const sameEvent = issuerOfReceivedEvent(action) || issuerOfReceivedEvent(previous) && !otherEventActor.test(action) &&
        (sameDocumentReference.test(action) || continuedDemand.test(action));
      if (!sameEvent) continue;

      if (localUnverifiedLink(action, unverifiedLinks)) yield SIG_LINK;
      if (personalDisclosure(action, { recordedReply: true }).reply) yield SIG_PERSONAL_INFO;
      if (classifyCallback(action, [], { includeReportedDirective: true }).directed) yield SIG_CALL_THIS_NUMBER;
      if (hasOpenInstallationReport(action, next, requiresRecipientApp)) yield SIG_APP_INSTALL;
    }
  }
}

const sameNoticeContact = /(?:(?:이|그|같은|해당)\s*)?(?:문자(?:\s*본문)?|메시지|통지|안내|발신\s*내용|본문)(?:에(?:서)?|\s*속)\s*/u;
const assignedSymbolicCallback = /^(?:(?<separate>별도(?:로|의)?|따로)\s*)?(?:지정(?:한|된)|정해\s*둔|적힌|실린)\s*(?:(?<separateTarget>별도(?:의)?|따로)\s*)?(?:(?<unverified>미확인|확인되지\s*않은)\s*)?(?:(?<phone>전화)(?:\s*(?:번호|연락처))?|(?:회신|통화|상담|문의)\s*(?:번호|연락처)|(?:번호|연락처))/u;
const establishedCallbackBypass = /(?:(?:공식|대표|평소|기존)\s*(?:고객\s*센터|상담\s*창구|전화|번호|연락처))(?:를|은|는)?\s*(?:이용하는\s*)?(?:대신|말고)\s*$/u;
const callbackPurpose = /^(?:(?:그|해당|같은)\s*(?:기관|발신자)(?:은|는|이|가)\s*)?(?:(?:(?:접수\s*상태|수령지|수령\s*정보|처리\s*상태)(?:을|를)?\s*)?확인(?:하려면|은)|처리\s*(?:요건|조건)으로)?\s*$/u;
const symbolicCallInstruction = /^\s*(?:으로|로|에)(?<exclusive>만)?\s*(?:(?:직접|다시|따로)\s*)?(?:(?<verb>전화|통화)(?:을|를)?\s*)?(?:하라(?:고|는)|하도록|해야)(?!\s*(?:하는지|할지|하는\s*건지|할\s*필요))/u;
const symbolicCallbackAssignment = /(?:회신|전화|통화)\s*(?:번호|연락처)(?:를|을)\s*(?:별도로|따로)\s*(?:지정했|정했)(?:고|으며)\s*(?:수신자(?:가|는)\s*)?(?:그|해당)\s*(?:연락처|번호)/u;
const independentOfficialCallback = /(?:직접|스스로)\s*(?:찾|확인한)\s*(?:기관의\s*)?(?:공식|대표)|(?:공식|대표)\s*(?:고객\s*센터|상담\s*창구|전화|번호|연락처)(?:으로|로|에)(?:만)?\s*(?:다시\s*)?(?:전화|통화|연락|문의)/u;
const substitutedCallbackDestination = /(?:대체(?:한|된|용)\s*(?:주소|번호|연락처)|원래\s*(?:번호|연락처|주소)\s*대신|(?:원번호|원래\s*번호|실제\s*연락처)[^.!?\n]{0,24}(?:다른\s*(?:번호|연락처|주소)|바꿨|바꿔|대체했)|(?:가린|가려진)\s*(?:번호|연락처)\s*대신)/u;
const numericCallbackCandidate = /(?<!\d)(?:1\d{2,3}|0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1\d{3}[- ]?\d{4})(?!\d)/u;

const affirmedReportedEnding = String.raw`(?:다(?:고\s*(?:알렸|기록했|적었|말했|설명했|확인했|정리했)(?:다|습니다|어요|음))?|습니다|어요|음)[.!。]?\s*$`;
const completedSymbolicDemand = new RegExp(
  String.raw`^\s*(?:한다(?:고|는)\s*)?(?:(?:적었|기록했|알렸|설명했|말했|했)|(?:요구|요청|지시|안내)(?:했|하였|(?:이었|였)|(?:이|가)\s*(?:같이\s*)?있었|(?:을|를)\s*받았)|(?:내용|말|설명)(?:이었|였))` +
    affirmedReportedEnding, "u",
);

function readCompletedSymbolicCall(text) {
  const directive = symbolicCallInstruction.exec(text);
  return directive && completedSymbolicDemand.test(text.slice(directive[0].length)) ? directive.groups : null;
}

const callbackRecordNote = /^(?:수신자|부모|저)(?:는|가|님은)\s*(?:(?:다음날|나중에|직접)\s*)?(?:그|이|해당)\s*(?:문자|메시지|안내|통지)(?:를|을)\s*(?:(?:회의|상담)에서\s*)?(?:검토|보관|기록)했(?:다|다고\s*(?:기록|설명)했다|습니다|어요|음)[.!。]?$/u;
const separateFollowingRecord = /^(?:별개(?:의)?\s+(?:수업|사건|기록)|별건으로\s+다른\s)/u;

function symbolicNoticeCallback(action) {
  if (!openDirectedReport(action) || optionalRoute.test(action) || asksIfRequired.test(action) ||
      questionedDemand.test(action) || independentOfficialCallback.test(action)) return false;
  const marker = sameNoticeContact.exec(action);
  if (!marker) return false;
  const lead = action.slice(0, marker.index);
  const bypass = establishedCallbackBypass.exec(lead);
  if (!callbackPurpose.test(bypass ? lead.slice(0, bypass.index) : lead)) return false;
  const tail = action.slice(marker.index + marker[0].length);
  const assigned = assignedSymbolicCallback.exec(tail);
  const assignment = symbolicCallbackAssignment.exec(tail);
  if (assignment) return Boolean(readCompletedSymbolicCall(tail.slice(assignment.index + assignment[0].length))?.verb);
  if (!assigned) return false;
  const order = readCompletedSymbolicCall(tail.slice(assigned[0].length));
  return Boolean(order && (order.verb || assigned.groups.phone) &&
    (bypass || (assigned.groups.separate || assigned.groups.separateTarget) && (order.exclusive || assigned.groups.unverified)));
}

const callbackHeading = /^(?:(?:피해|상담|수신)\s*(?:경위|기록|일지)(?:\s*(?:발췌|요약))?\s*[—:：]\s*|(?:수신|상담)\s*기록(?:에서|에는|에)\s+)/u;
const callbackIssuerRole = String.raw`(?:민원\s*접수\s*기관|${reportedRole})(?:\s+(?:업무|담당(?:자|\s*부서)?|직원|부서)){0,3}`;
const callbackNotice = "(?:문자|메시지|연락|통지|안내)";
const callbackClaim = new RegExp(
  String.raw`^(?:(?:(?:[가-힣]+\s+){0,4}[가-힣]+(?:다는|라는)\s+)?${callbackNotice}의\s+)?(?:${reportingSender}|발신\s*쪽)(?:은|는|이|가)\s*` +
    callbackIssuerRole + String.raw`\s*(?:(?:을|를)?\s*(?:자처했|자칭했)|이?라고\s*(?:밝혔|소개했|말했))` + affirmedReportedEnding, "u",
);
const callbackReceipt = new RegExp(
  "^" + callbackIssuerRole + "\\s*" + roleMarker +
    String.raw`\s*(?:(?:쪽|사람|발신자)(?:에서|에게서|한테서)\s*)?${callbackNotice}(?:이|가|를|을)?\s*(?:있었|왔|받았|도착했|수신했)` +
    String.raw`(?:고$|으며$|${affirmedReportedEnding})`, "u",
);
function affirmedCallbackIssuer(clause) {
  const source = clause.trim().replace(callbackHeading, "").replace(/배송\s*(?:사|회사)/u, "택배사");
  return openDirectedReport(source) && roleBelongsToReportedSource(source) &&
    (callbackClaim.test(source) || callbackReceipt.test(source));
}

// An omitted number can support R6 only as a directed, separate route in the same institution's notice.
function hasBoundSymbolicCallback(text) {
  if (!sameNoticeContact.test(text) || !/(?:번호|연락처|전화)/u.test(text)) return false;
  const reports = text.split(/\r?\n[ \t]*\r?\n/u);
  if (reports.length > 2 || reports[1] && !separateFollowingRecord.test(reports[1].trim())) return false;
  const report = reports[0].trim();
  if (numericCallbackCandidate.test(report) || substitutedCallbackDestination.test(report)) return false;
  const parsed = inspectLinkCandidates(report);
  if (!parsed.complete || parsed.candidates.length) return false;

  const clauses = report.split(/(?<=[.!?。])\s+|[\r\n]+/u).map(s => s.trim()).filter(Boolean);
  if (callbackRecordNote.test(clauses.at(-1) ?? "")) clauses.pop();
  if (clauses.length === 1) {
    const parts = clauses[0].split(/[,，]\s*/u);
    return parts.length === 2 && affirmedCallbackIssuer(parts[0]) && symbolicNoticeCallback(parts[1]);
  }
  if (clauses.length !== 2) return false;
  for (const { body, previous } of currentReceivedRequests(clauses.join(" "), affirmedCallbackIssuer, symbolicNoticeCallback)) {
    if (clauses.at(-1).endsWith(body) && affirmedCallbackIssuer(previous) && symbolicNoticeCallback(body)) return true;
  }
  return false;
}
export function addInstitutionReportFrames(text, signals, { unverifiedLinks = [], outsideCandidates = [], inputComplete = true, installFromDirectPatterns } = {}) {
  const addAgencyAction = signal => {
    signals.add(SIG_AGENCY_IMPERSONATION);
    signals.add(signal);
  };
  if (inputComplete && hasBoundSymbolicCallback(text)) addAgencyAction(SIG_CALL_THIS_NUMBER);
  for (const { issuer, action, next, continuedCall } of narrativeFrames(text, unverifiedLinks)) {
    if (directsToUnverifiedAddress(action, unverifiedLinks)) addAgencyAction(SIG_LINK);
    if (directsToNoticeNumber(action)) addAgencyAction(SIG_CALL_THIS_NUMBER);
    if (privateReply.test(action) || requestsDesignatedPrivateReply(action)) addAgencyAction(SIG_PERSONAL_INFO);
    if (hasOpenInstallationReport(action, next, notice => requiresRecipientInstallation(notice) ||
        continuedCall && senderSpecifiedApp.test(notice) && !staffInstallation.test(notice) && !noInstallation.test(notice))) {
      addAgencyAction(SIG_APP_INSTALL);
    }
    if (investigator.test(issuer) && reportsInvestigativeCash(action)) signals.add(SIG_CASH_HANDOVER);
  }
  for (const signal of reportedDirectedInstitutionActions(text, unverifiedLinks)) {
    if (signal === SIG_LINK || signal === SIG_PERSONAL_INFO) addAgencyAction(signal);
    else signals.add(signal);
  }
  for (const signal of reportedRouteChanges(text, unverifiedLinks)) addAgencyAction(signal);
  for (const signal of recognizedIssuedNoticeActions(text)) addAgencyAction(signal);
  const recipientActions = recognizedRecipientActions(text, {
    outsideCandidates,
    inputComplete,
    telecomSender: clause => roleBelongsToReportedSource(clause) ? introducedTelecomSender.exec(clause) : null,
  });
  for (const signal of recipientActions) addAgencyAction(signal);
  if (installFromDirectPatterns) {
    for (const signal of sameInstitutionEventActions(text, unverifiedLinks, installFromDirectPatterns)) addAgencyAction(signal);
  }
  for (const signal of institutionTransactionReports(text, unverifiedLinks)) {
    if (signal === SIG_LINK || signal === SIG_CALL_THIS_NUMBER || signal === SIG_PERSONAL_INFO) addAgencyAction(signal);
    else signals.add(signal);
  }
  for (const signal of reportedCashTransfers(text)) signals.add(signal);
  const blocks = structuredRecordBlocks(text);
  for (const signal of cashEventSignals(text, blocks)) signals.add(signal);
  if (hasStructuredInstallation(text)) addAgencyAction(SIG_APP_INSTALL);
  for (const { issuer, sender, heading, fields, cashOnly, cashClosed } of structuredFrames(blocks)) {
    if (!cashOnly && financialIssuer.test(issuer) && reportsLoanCollection(fields, sender, heading)) signals.add(SIG_LOAN_CASH_PICKUP);
    if (!cashClosed && investigator.test(issuer) && fields.some(({ label, value }) => /요청|요구/u.test(label) &&
        receivedCashDemand.test(value) && !cashReturn.test(value) && !notCurrent.test(value))) {
      signals.add(SIG_CASH_HANDOVER);
    }
  }
}
