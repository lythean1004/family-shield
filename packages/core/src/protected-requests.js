import { inspectLinkCandidates } from "./link-candidates.js";
import { isOfficialLink } from "./official-links.js";
import { SIG_CREDENTIAL_DISCLOSURE, SIG_DOCUMENT_BUNDLE } from "./signals.js";

const credential = "(?:(?:일회용|인증|원격\\s*(?:지원|제어|접속))\\s*(?:번호|코드|암호|값)|OTP)";
const recipient = "(?:(?:나|저|담당자|상담원|직원)(?:한테|에게)|(?:이\\s*)?(?:문자|메시지|채팅창)(?:로|으로))";
const delivery = "(?:(?:바로|그대로|좀|" + recipient + ")\\s*){0,3}(?:보내|알려|불러|읽어|전달해)\\s*" +
  "(?:줘|주라|줄래|주세요|주십시오|주실래요|주면\\s*(?:돼|됩니다))(?=[\\s.,!?~ㅋㅎㅠㅜ\\p{Extended_Pictographic}]|$)";
const directRelay = new RegExp(credential + "(?:만|을|를)?\\s*" + delivery, "iu");
const verification = new RegExp(credential + "|본인\\s*확인\\s*(?:용\\s*)?문자", "i");
const arrival = /(?:발송|도착|왔|갔|갈\s*거|올\s*거|오면|잘못\s*보내)/;
const numericSubject = /^(?:(?:문자로|방금|지금)\s*)?(?:(?:\d+|네|여섯|여덟)\s*자리\s*)?(?:그거|그걸|그\s*(?:번호|숫자|코드)|숫자)/;
const referencedRelay = new RegExp("(?:그거|그걸|그\\s*(?:번호|숫자|코드)|숫자)(?:만|를|가)?\\s*" +
  "(?:(?:오면|도착하면|갔을\\s*거야)\\s*)?" + delivery, "u");
const financialSecret = /(?:복구\s*(?:문구|구문)|시드\s*(?:문구|구문)|(?:계좌|통장)\s*비밀번호|보안\s*카드\s*(?:번호\s*)?(?:전체|전부))(?:를|을)?\s*(?:[(（][가-힣0-9\s]{1,14}[)）]\s*)?입력\s*(?:후|하면|하시면|해야|해\s*주세요|하세요)(?=[\s.!?,]|$)/;
const commentary = /[‘’“”"'「」]|(?:예방|보안)\s*교육|(?:라고|라는|다는)\s*(?:문구|요구|사례|말)|(?:요구|사기)\s*사례/;
const clauseBreak = /(?<=[.!?。])\s+|[\r\n]+/;
const aidOrWork = /(?:지원금|긴급\s*생계비|부업|재택\s*(?:근무|알바|일자리|채용)|체험단\s*모집)/;
const identityCopy = "(?:신분증|주민등록증|운전면허증)\\s*(?:(?:앞면|뒷면|앞뒤)\\s*)?(?:사진|사본)";
const bankCopy = "(?:(?:(?:급여|입금|지급)(?:을)?\\s*)?받(?:으실|을)\\s*(?:계좌(?:\\s*번호)?|통장\\s*사본)|통장\\s*사본)";
const together = "\\s*(?:과|와|이랑|랑|및|[,·])\\s*";
const docs = new RegExp("(?:" + identityCopy + together + bankCopy + "|" + bankCopy + together + identityCopy +
  ")(?:을|를)?\\s*(?:(?:아래(?:에|로)|이쪽으로|여기로|함께)\\s*)?(?:(?:올려|보내|첨부해|제출해)\\s*(?:줘|주세요|주십시오)|" +
  "(?:제출|첨부|등록)\\s*(?:하세요|하십시오|바랍니다|필수))(?=[\\s.!?]|$)");

function externalOnly(parsed) {
  return parsed.complete && parsed.candidates.length > 0 && parsed.candidates.every(c => c.complete && !isOfficialLink(c.raw));
}

const humanRecipient = "(?:대화\\s*상대(?:방)?|상대(?:방)?|자기|(?:그|다른)\\s*(?:사람|분)|(?:상담|접수)\\s*(?:자|원|직원|담당자)|담당자|직원)(?:에게|한테)";
const reportedRelay = new RegExp(credential + "(?:을|를|만)?\\s*(?:그대로\\s*)?" + humanRecipient +
  "\\s*(?:그대로\\s*)?(?:불러|알려|읽어|전달해|보내|넘겨|말해)\\s*(?:달라고|달라는|달라네|달래|줘야)", "iu");
const inactiveReport = /(?:요청|요구|부탁)(?:을|를)?\s*(?:이미\s*)?(?:거절|취소|철회)|(?:예방|보안)\s*(?:교육|강의)|(?:수업|교육|연수)에서|(?:예시|사례)(?:로|예요|입니다)|(?:역할극|극본|대본)\s*(?:대본|속|연습)|(?:하는|그런)\s*(?:일|경우)(?:이|가)?\s*없|(?:달라고|요구|부탁|요청)\s*한\s*적(?:이|은)?\s*없|(?:절차|접수)(?:가|는)?\s*(?:종료|마감|완료)됐|하지\s*(?:말|마|않)|(?:필요|의무)(?:가|는)?\s*없/;
const documentPair = new RegExp("(?:" + identityCopy + together + bankCopy + "|" + bankCopy + together + identityCopy + ")");
const requiredCopies = /^\s*(?:이|가|을|를)?\s*(?:(?:함께|한꺼번에|모두|둘\s*다)\s*)?(?:내라|내야|보내야|(?:제출|첨부|접수|등록)해야|들어가|포함(?:돼|되|된)|(?:이?라고|이래|이랍니다|입니다))/;
const destinationField = /(?:접수처|(?:제출|접수)\s*(?:주소|링크)|(?:두\s*서류|둘|자료)(?:를|을)?\s*(?:낼|보낼|제출할|올릴)\s*곳)(?:라고\s*적힌(?:\s*곳)?|라\s*적힌|로\s*적힌|라는\s*곳)?\s*(?:은|는|이|가|[:：])?\s*(?<token>https?:\/\/[^\s"'<>]+)/giu;
const topicBoundary = /다른\s*(?:서류|업무|행사|기관|신청)|별개로|(?:행사|교육|일정|그림|홍보)\s*(?:참고|안내)/;

function hasNamedDestination(text) {
  return [...text.matchAll(destinationField)].some(match => externalOnly(inspectLinkCandidates(match.groups.token)));
}

export function addReportedProtectedRequests(text, signals, hasUnverifiedLink) {
  const clauses = text.split(clauseBreak).map(clause => clause.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    if (inactiveReport.test(clause)) continue;
    if (reportedRelay.test(clause)) signals.add(SIG_CREDENTIAL_DISCLOSURE);
    if (!hasUnverifiedLink) continue;
    const pair = documentPair.exec(clause);
    if (!pair || !requiredCopies.test(clause.slice(pair.index + pair[0].length))) continue;
    const previous = clauses[index - 1] ?? "";
    if (!aidOrWork.test(clause) && (!aidOrWork.test(previous) || inactiveReport.test(previous) || topicBoundary.test(clause))) continue;
    const afterPair = clause.slice(pair.index + pair[0].length);
    const next = clauses[index + 1] ?? "";
    if (hasNamedDestination(afterPair) || (!topicBoundary.test(next) && !inactiveReport.test(next) && hasNamedDestination(next))) {
      signals.add(SIG_DOCUMENT_BUNDLE);
    }
  }
}

// 제출을 요구한 절의 주소, 또는 바로 다음에 단독으로 제시한 양식 주소만 결합한다.
function externalForm(clause, next) {
  const local = inspectLinkCandidates(clause);
  if (local.candidates.length || !local.complete) return externalOnly(local);
  const address = next?.trim().replace(/^(?:신청|등록|제출|접수)(?:\s*(?:주소|링크))?\s*[:：→]\s*/, "");
  return Boolean(address && !/\s/.test(address) && externalOnly(inspectLinkCandidates(address)));
}

export function hasCredentialDisclosure(text, unverifiedLink) {
  const clauses = text.split(clauseBreak).filter(Boolean);
  let awaitingCode = false;
  for (const [i, clause] of clauses.entries()) {
    if (commentary.test(clause) || /(?:인증|일회용)\s*(?:번호|코드)[^.!?\n]{0,28}(?:전달|보내|알려|공유)(?:주|하)?지\s*(?:마|말|않)/.test(clause)) {
      awaitingCode = false;
      continue;
    }
    if (directRelay.test(clause)) return true;
    const codeNotice = verification.test(clause) && arrival.test(clause);
    const continuesNotice = awaitingCode && numericSubject.test(clause.trimStart());
    if ((codeNotice || continuesNotice) && referencedRelay.test(clause) &&
        !/(?:택배|예약|주문|좌석|운송장)\s*(?:번호|코드)|(?:본인|자신)(?:의)?\s*(?:기기|앱)에서/.test(clause)) return true;
    if (unverifiedLink && financialSecret.test(clause) && externalForm(clause, clauses[i + 1])) return true;
    awaitingCode = codeNotice || (continuesNotice && arrival.test(clause));
  }
  return false;
}

export function hasDocumentBundle(text, unverifiedLink) {
  if (!unverifiedLink || !aidOrWork.test(text)) return false;
  const clauses = text.split(clauseBreak).filter(Boolean);
  return clauses.some((clause, i) => {
    const request = clauses.slice(Math.max(0, i - 1), i + 1).join(" ");
    return aidOrWork.test(request) && !commentary.test(request) && docs.test(clause) && externalForm(clause, clauses[i + 1]);
  });
}
