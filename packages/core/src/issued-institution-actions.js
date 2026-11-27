
import { isCardCallbackNumber } from "./card-sender.js";
import { inspectLinkCandidates } from "./link-candidates.js";
import { currentReceivedRequests } from "./received-message.js";
import { SIG_CALL_THIS_NUMBER, SIG_LINK, SIG_PERSONAL_INFO } from "./signals.js";

const artifact = "(?:문자|메시지|연락|안내(?:문)?|통지(?:문)?|쪽지|알림)";
const postalRole = "(?:우편(?:물)?|택배|배송)\\s*(?:보관|수령|접수|문의|배송|배달)\\s*(?:창구|센터|담당\\s*부서)";
const postalOrigin = new RegExp(
  "^(?:(?:받은|수신한|도착한)\\s*)?(?:" + postalRole +
  "(?:로\\s*표시된|이라고\\s*적힌|\\s*명의의)\\s*" + artifact +
  "(?:은|는|이|가|에서|에는)|" + artifact + "(?:에는|에서)\\s*발신(?:처|자|\\s*표시)(?:가|이|는|은)\\s*" +
  postalRole + "(?:로\\s*(?:표시됐|표시되었|기재됐|기재되었)|이라고\\s*적혀\\s*있었)(?:습니다|어요|다|음))(?=[\\s.!?。]|$)",
  "u",
);
const sameNotice = new RegExp("^(?:그|같은|이|해당)\\s*" + artifact + "(?:에서|에는|에)\\s*", "u");
const assignedPurpose = /(?:배송|배달|우편(?:물)?|택배|반송|수령)(?:[가-힣]{0,8})?(?:\s+[가-힣]{1,10}){0,3}?\s*(?:문의|상담|확인)(?:(?:할|에\s*쓸)\s*(?:곳|창구|연락처)|\s*(?:창구|연락처|번호))(?:으로|로|에)\s*$/u;
const selectedNumber = /^\s*(?:이|가|은|는|을|를)?\s*(?:따로\s*)?(?:지정|명시|기재|표시|정해\s*두)(?:했(?:습니다|어요|다|음)|됐(?:습니다|어요|다|음)|하였(?:습니다|어요|다|음)|되었(?:습니다|어요|다|음)|었(?:습니다|어요|다|음))(?=[.。!?\s]|$)/u;
const actualPhone = /(?<![\d-])(?:0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1\d{3}[- ]?\d{4})(?![\d-])/gu;
const sameNoticeCallback = new RegExp(
  "^(?:(?:그|같은|이|해당|받은)\\s*)?" + artifact +
  "(?:에|에는|에서|\\s*속에)\\s*(?:적힌|실린|기재된|표시된|나온)\\s*(?:그\\s*)?(?:별도\\s*)?(?:번호|연락처)(?:로|으로|에)\\s*" +
  "(?:직접\\s*)?(?:전화|연락|회신|통화)(?:하라(?:고|는)|해\\s*달라(?:고|는)|하도록)\\s*" +
  "(?:요구|요청|지시|내용|안내|했|적혀|안내했)", "u",
);
const nonCurrentRoute = /(?:참고(?:로|용)?|가상|대체|예시|견본|예방|교육|훈련|별개로|다른\s*(?:발신자|업체|단체|문자|안내|요구|번호))|(?:할지|할\s*필요|(?:하|했|받았)는지|(?:요청|지시|내용)(?:인지|이었는지)|하라는\s*뜻(?:은|이)?\s*아니)/u;
const inactiveDemand = /(?:요구|요청|지시)(?:은|는|이|가|을|를)?\s*(?:(?:이미|그\s*뒤|나중에)\s*)?(?:철회|취소|없|아니)|(?:하라|해\s*달라)(?:고|는)\s*(?:한\s*적|말|뜻)(?:이|은|는|도)?\s*(?:없|아니)/u;
const actorWithdrawal = /^(?:발신자|상대(?:방)?|보낸\s*사람)(?:가|이)\s*(?:그|이|해당|같은)\s*(?:(?:전화|연락|자료|서류|제출)\s*)?(?:요구|요청|지시)(?:를|을)?\s*(?:취소|철회)/u;
const fundingOrigin = new RegExp(
  "^(?:(?:받은|수신한|도착한)\\s*)?(?:(?:지원금|보조금|복지)\\s*(?:담당|접수|지급|심사)\\s*기관|(?:공공|행정|복지)\\s*기관)" +
  "(?:을|를)\\s*(?:내세운|자처한|자칭한)\\s*" + artifact + "(?:에서|에는|에)(?=\\s|$)\\s*", "u",
);
const protectedMaterial = "(?:(?:주민등록증|신분증|여권)\\s*(?:사진|사본)|통장\\s*사본|주민등록번호(?:\\s*(?:전체|전부))?|(?:계좌|통장|카드)\\s*(?:번호|비밀번호))";
const positiveSubmission = new RegExp(
  "^(?:(?:저에게|제게|나에게|수신자(?:에게|한테)|수신인(?:에게|한테))\\s*)?(?:(?:제|내|수신자의)\\s*)?" +
  protectedMaterial + "(?:\\s*(?:과|와|및|하고|랑|,|·)\\s*" + protectedMaterial + ")?" +
  "(?:을|를|만)?\\s*(?:(?:함께|같이|둘\\s*다|모두)\\s*)?(?:(?:제출|전달|전송)(?:하라(?:고|는)\\s*)?)?" +
  "(?:요구|요청)(?:했|하였)(?:습니다|어요|다|음)(?:[.。!]|$)\\s*$", "u",
);

function assignsCallback(record) {
  const numbers = [...record.matchAll(actualPhone)];
  if (numbers.length !== 1) return false;
  const [number] = numbers;
  return !isCardCallbackNumber(number[0]) &&
    assignedPurpose.test(record.slice(0, number.index)) &&
    selectedNumber.test(record.slice(number.index + number[0].length));
}

export function* recognizedIssuedNoticeActions(text) {
  const isIssuer = clause => postalOrigin.test(clause) || fundingOrigin.test(clause);
  for (const report of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, previous, next } of currentReceivedRequests(report, isIssuer, assignsCallback)) {
      if (inactiveDemand.test(body + " " + next) || actorWithdrawal.test(next)) continue;
      const funding = fundingOrigin.exec(body);
      if (funding && positiveSubmission.test(body.slice(funding[0].length))) {
        yield SIG_PERSONAL_INFO;
      }
      const shipperHere = postalOrigin.exec(body);
      const shipperBefore = postalOrigin.exec(previous);
      const route = shipperHere ? body.slice(shipperHere[0].length) : sameNotice.test(body) && shipperBefore ? body : "";
      if (route && !nonCurrentRoute.test(route + " " + next) && assignsCallback(route) && sameNoticeCallback.test(next)) {
        yield SIG_CALL_THIS_NUMBER;
      }
    }
  }
}

const publicNoticeIssuer = new RegExp(
  String.raw`(?:^|[—:：]\s*)(?:(?:부모|수신자|수신인|받는\s*사람)(?:가|는)\s*)?(?:받은|수신한|전달받은)\s*` +
  artifact + String.raw`(?:이|가|은|는)\s*(?:공공|행정|복지)\s*기관\s*명의(?:(?:였|이었)(?:습니다|어요|다|음)|입니다|이다|임)[.!。]?$`, "u",
);
const sameReceivedNotice = new RegExp(
  String.raw`^(?:그|같은|이|해당)\s*` + artifact + String.raw`(?:\s*(?:안|본문))?(?:에|에는|에서)\s*`, "u",
);
const unknownAddressProvenance = /(?:발신\s*근거|발신처|출처|운영처|관리\s*주체)(?:를|을|가|이)?\s*확인(?:을)?\s*(?:할\s*수\s*없|하지\s*못|되지\s*않)/u;
const addressPresentInNotice = /(?:주소|링크)(?:가|이)\s*(?:적혀\s*있|들어\s*있|포함(?:되어|돼)\s*있|기재(?:되어|돼)\s*있|실려\s*있)/u;
const substituteAddress = /(?:대체|치환|삭제|제외|대신|별건|가상|예시|견본|참고\s*(?:용|주소|링크))/u;
const recordedAddressValue = /^(?:(?:(?:시험|신고|상담|수신|접수)\s*)?기록(?:의|에\s*남긴)\s*)?(?:주소|링크)(?:\s*표기)?(?:는|가|이|\s*[:：])\s*https?:\/\//iu;
const sameNoticePrivateReply = new RegExp(
  String.raw`^(?:(?:본인|신원|가입|접수)\s*확인(?:을)?\s*(?:이유로|명분으로|위해|목적으로)\s*)?` + protectedMaterial +
  String.raw`(?:을|를)?\s*(?:그|같은|이|해당)\s*(?:(?:대화|문자|메시지|채팅)(?:에|으로|로)\s*)?(?:답장|회신)(?:으로|로)?\s*(?:(?:첨부|제출|전송|전달)\s*)?(?:하라(?:고|는)|해\s*달라(?:고|는))(?=[\s.!?。]|$)`, "u",
);
const inactiveRoleReport = /(?:예방|교육|훈련|설문|연습)\s*(?:을\s*위해|자료|목적|사례)|(?:할지|해야\s*하는지|달라는지|있는지)\s*(?:물|문의|확인)|(?:한|말한)\s*적(?:이|은|도)?\s*(?:없|아니)|(?:다른\s*(?:직원|사람|수신자|업체)|제\s*3\s*자)(?:에게|한테)(?:만)?|(?:하면|인\s*경우|때에만)\s*(?:요구|요청|지시)/u;

const sameRequestedReplyWithdrawn = /^(?:그|같은|해당)?\s*(?:발신자|보낸\s*쪽|담당자|상대)(?:가|이)\s*(?:그|해당|같은)\s*(?:회신\s*)?(?:요구|요청)(?:를|을)\s*(?:이미\s*)?(?:철회|취소)/u;

function addressAssignedToNotice(body, next, outsideCandidates) {
  if (!sameReceivedNotice.test(body) || !unknownAddressProvenance.test(body) || !addressPresentInNotice.test(body)) return false;
  if (substituteAddress.test(body + " " + next) || !recordedAddressValue.test(next)) return false;
  const inline = inspectLinkCandidates(body);
  const recorded = inspectLinkCandidates(next);
  if (!inline.complete || inline.candidates.length || !recorded.complete || recorded.candidates.length !== 1) return false;
  const [address] = recorded.candidates;
  return outsideCandidates.some(candidate =>
    candidate.raw === address.raw && candidate.host === address.host &&
    candidate.protocol === address.protocol && candidate.port === address.port && candidate.rest === address.rest);
}

export function* recognizedRecipientActions(text, { outsideCandidates, telecomSender }) {
  const isIssuer = clause => publicNoticeIssuer.test(clause) || Boolean(telecomSender(clause));
  for (const report of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, previous, next } of currentReceivedRequests(report, isIssuer, clause => addressPresentInNotice.test(clause))) {
      if (inactiveDemand.test(body + " " + next) || inactiveRoleReport.test(body) ||
          actorWithdrawal.test(next) || sameRequestedReplyWithdrawn.test(next)) continue;
      if (publicNoticeIssuer.test(previous) && addressAssignedToNotice(body, next, outsideCandidates)) yield SIG_LINK;
      const claimant = telecomSender(body);
      if (claimant && sameNoticePrivateReply.test(body.slice(claimant.index + claimant[0].length))) yield SIG_PERSONAL_INFO;
    }
  }
}
