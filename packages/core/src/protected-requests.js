import { currentReceivedRequests } from "./received-message.js";
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
// 같은 문장 안에서 부정한 명목만 제외한다. 이어서 실제 신청한 다른 사업을 밝힐 수 있다.
const program = aidOrWork.source;
const combinedPrograms = program + "(?:\\s*(?:이나|나|과|와|또는|및|[·/])\\s*" + program + ")*";
const deniedProgram = new RegExp(combinedPrograms + "(?:\\s*(?:신청|접수|모집|등록|참여))?" +
  "(?:(?:[을를]\\s*위한)?\\s*(?:절차|목적|서류|양식))?\\s*(?:[은는이가]|[과와](?:는)?)?\\s*" +
  "(?:아니|아닌|아닙|아님|무관|(?:관련|관계)(?:이|가)?\\s*없)", "gu");
const applicationContext = new RegExp(program + "(?:[에을를의로]\\s*)?\\s*" +
  "(?:신청|모집|등록|채용|접수|수급|수령|참여|대상자|서류|양식|서식|안내|알림|공고|문의|상담|제안|" +
  "연습\\s*양식|필요한\\s*서류|이?라(?:는|고\\s*한)\\s*(?:문자|연락|안내)|" +
  "(?:(?:[\\d,]+\\s*)?[천만억]?\\s*원\\s*)?지급\\s*(?:대상|신청|안내))" +
  "|(?:재택\\s*채용|체험단\\s*모집)", "u");
const programFieldValue = new RegExp(program + "(?:입니다|임)?[.。]?\\s*$", "u");

function hasApplicationPurpose(text) {
  const affirmed = text.replace(deniedProgram, " ");
  return applicationContext.test(affirmed) || purposeHeading.test(affirmed) && programFieldValue.test(affirmed);
}
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
  "\\s*(?:그대로\\s*)?(?:불러|알려|읽어|전달해|보내|넘겨|말해)\\s*(?:달라고|달라는|달라네|달래|줘야)", "giu");
const dramaSetting = /(?:낭독극|연극|역할극|희곡|대본|극본)(?:에서(?:는)?|\s*속(?:에서|의)?)[^,，.!?\n]{0,28}$/;
const dramaLine = /^\s*(?:대사|지문|장면|배역|역할)(?:을|를|이|가|은|는)?(?=\s|$)/;
const endedRelay = /^\s*(?:요청|요구|부탁|문구|안내)(?:은|는|이|가)?\s*(?:있었|나왔|적혀\s*있었)(?:지만|는데|고)\s*(?:(?:그|해당)\s*)?(?:절차|접수|신청|업무)(?:는|가|이|은)?\s*(?:이미\s*)?(?:끝났|종료됐|마감됐|완료됐|마쳤)/;
const inactiveReport = /(?:요청|요구|부탁)(?:을|를)?\s*(?:이미\s*)?(?:거절|취소|철회)|(?:예방|보안)\s*(?:교육|강의)|(?:수업|교육|연수)에서|(?:예시|사례)(?:로|예요|입니다)|(?:역할극|극본|대본)\s*(?:대본|속|연습)|(?:하는|그런)\s*(?:일|경우)(?:이|가)?\s*없|(?:달라고|요구|부탁|요청)\s*한\s*적(?:이|은)?\s*없|(?:절차|접수)(?:가|는)?\s*(?:종료|마감|완료)됐|하지\s*(?:말|마|않)|(?:필요|의무)(?:가|는)?\s*없/;
const documentPair = new RegExp("(?:" + identityCopy + together + bankCopy + "|" + bankCopy + together + identityCopy + ")");
const requiredCopies = /^\s*(?:이|가|을|를)?\s*(?:(?:함께|한꺼번에|모두|둘\s*다)\s*)?(?:내라|내야|보내야|(?:제출|첨부|접수|등록)해야|들어가|포함(?:돼|되|된)|(?:이?라고|이래|이랍니다|입니다))/;
const destinationField = /(?:접수처|(?:제출|접수)\s*(?:주소|링크)|(?:두\s*서류|둘|자료)(?:를|을)?\s*(?:낼|보낼|제출할|올릴)\s*곳)(?:라고\s*적힌(?:\s*곳)?|라\s*적힌|로\s*적힌|라는\s*곳)?\s*(?:은|는|이|가|[:：])?\s*(?<token>https?:\/\/[^\s"'<>]+)/giu;
const topicBoundary = /다른\s*(?:서류|업무|행사|기관|신청)|별개로|(?:행사|교육|일정|그림|홍보)\s*(?:참고|안내)/;

function hasNamedDestination(text) {
  return [...text.matchAll(destinationField)].some(match => externalOnly(inspectLinkCandidates(match.groups.token)));
}

function hasCurrentReportedRelay(clause) {
  for (const match of clause.matchAll(reportedRelay)) {
    const before = clause.slice(0, match.index);
    const after = clause.slice(match.index + match[0].length);
    if (endedRelay.test(after) || (dramaSetting.test(before) && dramaLine.test(after))) continue;
    return true;
  }
  return false;
}

const bankAuthentication = /(?:금융\s*비밀(?:값|정보|자료)?|금융\s*인증\s*정보)(?:을|를|의)?\s*(?=입력)|(?:계좌|통장|은행)\s*(?:비밀번호|비번|암호)|(?:(?:지갑|계정)(?:의)?\s*)?(?:복구|시드)\s*(?:문구|구문)|보안\s*카드\s*(?:번호\s*)?(?:전체|전부)/u;
const remoteEntry = /(?:발신처|보낸\s*(?:사람|곳)|상대(?:방)?|상담(?:원|직원|자)|담당자)(?:가|이)\s*(?:지정한|보낸|준|운영하는|관리하는)\s*(?:별도\s*)?(?:확인\s*)?(?:입력\s*(?:칸|란|창)|접수\s*(?:창|란|양식)|양식|서식|폼)(?:에|으로)/u;
const reportedEntry = /입력(?:을\s*요구|해야|하라고|하라는|해\s*달라)/u;
const entryValue = "(?:" + bankAuthentication.source + ")(?:\\s*(?:값|전체|전부))?\\s*(?:을|를)?\\s*";
const entryAfterValue = new RegExp(entryValue + "(?:직접\\s*)?" + reportedEntry.source, "u");
const valueBeforeForm = new RegExp(entryValue + "$", "u");
const entryAfterForm = new RegExp("^\\s*(?:직접\\s*)?" + reportedEntry.source, "u");
const localEntry = /(?:공식\s*(?:앱|사이트|스토어|홈페이지)|(?:자기|본인|자신)(?:의)?\s*(?:기기|앱)에서|(?:바꾸|재설정|변경)\s*(?:기한|여부|일자)|글자\s*(?:수|길이)|문자\s*종류)/u;

const senderRelay = new RegExp(
  "(?:발신자|발신처|보낸\\s*사람)(?:가|는|이|은)[^,.!?\\n]{0,22}(?:" + credential + ")" +
  "(?:을|를|만)?\\s*(?:본인|자신|자기)(?:에게|한테)\\s*(?:알려|불러|전달해|읽어|보내)\\s*" +
  "(?:달라고|달라는|달래|줘야)[^,.!?\\n]{0,10}(?:요구|요청|부탁|했다고|했다|했어)", "iu");
const formEntryReport = /(?:발신처|상대|담당자|직원)(?:가|이)\s*(?:보낸|관리하는|운영하는)\s*[^,.!?\n]{0,14}(?:양식|폼|서식)(?:에|으로)[^,.!?\n]{0,15}(?:계좌\s*(?:비밀번호|암호)|금융\s*비밀(?:값|정보|자료)?|금융\s*인증\s*정보)(?:의|을|를)?\s*입력(?:을\s*(?:요구|요청)|하라고|해야)/u;

const statedFormAddress = /(?:양식|서식|접수창|입력창|폼)\s*(?:의\s*)?(?:주소|링크)(?:는|가|이|[:：])?\s+(?<token>\S+)/u;
const continuedFormAddress = /^(?:(?:그|해당|이|같은)\s*)?(?:확인\s*)?(?:양식|서식|접수창|입력창|폼)\s*(?:의\s*)?(?:주소|링크)/u;


const oneTimeConfirmationValue = "(?:일회용\\s*(?:(?:본인\\s*확인|인증|확인)\\s*)?(?:값|코드|숫자|번호)|OTP)";
const deliveredToRecipient = /(?<![\p{L}\p{N}])(?:내|제|수신자(?:의)?|저에게|저한테|제게|나에게|나한테)(?:\s*(?:휴대전화|휴대폰|핸드폰|전화기|기기|단말(?:기)?|화면|번호|연락처|수신함|알림(?:창)?|메일|채팅(?:방)?|계정|쪽|앞|문자|앱)(?:에|로|으로|에서)?|에게|한테)?\s*(?:온|오는|오면|도착한|도착하는|받은|받게\s*된|뜬|표시된|나타난|발급된|생긴)/u;
const deliveredToPhone = /(?:휴대전화|휴대폰|핸드폰|전화기|전화|단말기?|기기|폰)(?:에|로|으로)\s*(?:온|오는|오면|도착한|뜬|표시된|발급된)\s*$/u;
const anotherHolder = /(?:상대(?:방)?|발신자|직원|담당자|상담원|다른\s*사람|친구|동료|타인|그|제삼자|제3자)(?:의|가|이|는|은)?\s*(?:본인(?:의)?|자기(?:의)?|자신(?:의)?)?\s*$|(?:그의|타인의|남의|다른\s*사람의)\s*$/u;
const assignedRecipient = "(?:(?:지정(?:된|한)|정한|지목한|별도(?:의)?|다른|전담|상담|접수|지원)\\s*)*(?:직원|접수원|상담원|담당자|관리자)";
const handoverDuty = "\\s*(?:게|것(?:이|을)?|일(?:이|을)?)\\s*(?:(?:제|수신자의|다음|정해진)\\s*)?(?:몫|역할|조건|절차|순서|의무|요건)";
const relayAct = "(?:전달|인계|전송)(?:하(?:라(?:고|는|며)?|도록|여야)|해야|해\\s*달라|하기로\\s*(?:했|돼|되어|정해졌))" +
  "|(?:넘기|건네)(?:라(?:고|는|며)?|도록|어야)|(?:넘겨|건네|전해|알려|불러)\\s*(?:달라|주어야)" +
  "|(?:(?:전달|인계|전송)하|넘기|건네|전하|알리|읽어\\s*주)는" + handoverDuty;
const assignedValueRelay = new RegExp(oneTimeConfirmationValue + "(?:을|를|만)?\\s*" +
  "[^.!?\\n]{0,26}" + assignedRecipient + "(?:에게|한테|쪽으로)\\s*(?:구두로\\s*)?(?:" + relayAct + ")", "iu");
const assignedHandoverRole = new RegExp(oneTimeConfirmationValue + "(?:의|을|를)?\\s*(?:인계|전달|전송)\\s*(?:대상|수령인|받는\\s*사람)(?:은|는|이|가)\\s*" +
  "(?:(?:그쪽|발신자|상대|담당자|상담원)(?:이|가)?\\s*(?:지정한|정한|지목한)\\s*)?" + assignedRecipient +
  "(?:이?라고|이?라는|입니다|였다고|였다는)", "iu");
const valueDescriptorOnly = /(?:유형|종류|형식|길이|자리\s*수|사용\s*여부|발급\s*여부|예시(?:값)?|접수\s*번호|예약\s*번호|택배\s*코드|운송장)/u;
const otherRelayTopic = /(?:그와|이와)(?:는)?\s*별개|별도로|한편|다른\s*(?:문자|연락|답신|안내|업무)|(?:과거|지난번|이전에?|당시)\s*[^.!?\n]{0,12}(?:예|사례|문서|절차)/u;

function requiresHandoffToAssignedStaff(clause) {
  if (inactiveReport.test(clause) || localEntry.test(clause) || otherRelayTopic.test(clause)) return false;
  const relay = assignedValueRelay.exec(clause) ?? assignedHandoverRole.exec(clause);
  if (!relay || valueDescriptorOnly.test(relay[0])) return false;
  const origin = clause.slice(Math.max(0, relay.index - 32), relay.index).trimEnd();
  if (/(?:다른|별도의?)\s*(?:수신자|학생|사용자|사람)(?:의|에게|한테)/u.test(origin)) return false;
  if (deliveredToRecipient.test(origin)) return true;
  const phone = deliveredToPhone.exec(origin);
  // 받은 연락 안의 휴대전화가 다른 사람의 것으로 표시된 경우에는 수신자의 값과 연결하지 않는다.
  return Boolean(phone && !anotherHolder.test(origin.slice(0, phone.index).trimEnd()));
}

const currentRelayIssuer = /(?:발신자|발신인|발신처|메시지를\s*보낸\s*(?:사람|이)|보낸\s*(?:사람|이|쪽)|상대(?:방)?|상담원)(?:가|이|은|는)(?=\s|$)/u;
const issuerDestination = "(?:(?:발신인|발신자|발신처|자신|자기|본인|상대(?:방)?|보낸\\s*사람)(?:에게|한테|쪽으로)|" +
  "(?:자신|자기|발신자|상대|그쪽)(?:이|가)?\\s*(?:지정한|정한|지목한)\\s*" + assignedRecipient + "(?:에게|한테|쪽으로))";
const receivedCodePurpose = "(?:(?:제가|수신자가|수신자는|받은\\s*사람이)\\s*)?";
const relayOrderFromIssuer = new RegExp(currentRelayIssuer.source + "[^.!?\\n]{0,43}?" +
  oneTimeConfirmationValue + "(?:을|를|만)?\\s*" + receivedCodePurpose + issuerDestination +
  "\\s*(?:(?:구두로|그대로)\\s*)?(?:(?:전달|인계|전송)하|넘기|건네|알리)(?:라(?:고|는|며)|도록)" +
  "\\s*(?:요구|요청|지시)", "iu");

function reportsCodeHandoffToIssuer(clause) {
  if (inactiveReport.test(clause) || localEntry.test(clause) || otherRelayTopic.test(clause)) return false;
  const match = relayOrderFromIssuer.exec(clause);
  return Boolean(match && !valueDescriptorOnly.test(match[0]));
}

const relayReportLead = /^(?:발신자|발신인|보낸\s*(?:사람|이)|상대(?:방)?|상담원)(?:(?<subject>가|이|은|는)|의\s*(?<request>요구|요청|지시)(?:가|이|은|는))\s+/u;
const relayReportPredicate = /\s*(?:전달하|전송하|인계하|건네|넘기|전하|알리)(?:라(?:고|는|며)|도록)\s*(?<ending>[^.!?\n]*)[.!?]?$/u;
const relayRequestEnding = /^(?:요구|요청|지시)(?:를|을)?\s*(?:(?:했|하였)(?:다|습니다|어요|음)|(?:했|하였)다고\s*(?:적었|기록했)(?:다|습니다|어요|음)|한\s*(?:경우|내용)(?:이었|였)(?:다|습니다|어요|음))$/u;
const nominalRelayEnding = /^(?:것|내용)(?:이었|였)(?:다|습니다|어요|음)$/u;
const explicitStaffDestination = "(?:" + assignedRecipient + "|발신(?:인|자)|상대(?:방)?|보낸\\s*사람|(?:다른|지정한|지목한)\\s*(?:사람|분))(?:에게|한테|께|쪽으로)";
const relayArgument = new RegExp(
  "^\\s*(?:(?<agent>제가|내가|수신자가|받은\\s*사람이)|" +
  "(?<value>" + deliveredToRecipient.source + "\\s*(?:" + oneTimeConfirmationValue + "|" + credential + ")(?:을|를))|" +
  "(?<destination>" + explicitStaffDestination + "))(?=\\s|$)", "iu",
);
const withdrewCodeRelay = /^(?:그|같은|이|해당)\s*(?:요구|요청|지시)(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:(?:철회|취소)(?:됐|되었)|(?:발신자|발신인|상대(?:방)?)(?:가|이)\s*(?:철회|취소)(?:했|하였))/u;

function reportsRelayWithExplicitArguments(clause) {
  if (inactiveReport.test(clause) || localEntry.test(clause) || otherRelayTopic.test(clause)) return false;
  const lead = relayReportLead.exec(clause);
  if (!lead) return false;
  const request = clause.slice(lead[0].length);
  const predicate = relayReportPredicate.exec(request);
  if (!predicate) return false;
  const ending = predicate.groups.ending.trim();
  if (!(lead.groups.request ? nominalRelayEnding : relayRequestEnding).test(ending)) return false;

  const argumentsInQuote = relayArguments(request.slice(0, predicate.index), relayArgument);
  return argumentsInQuote?.size === 3;
}

function relayArguments(text, argument) {
  const roles = new Set();
  let rest = text.trim();
  while (rest) {
    const match = argument.exec(rest);
    if (!match) return null;
    const role = Object.keys(match.groups).find(name => match.groups[name] !== undefined);
    if (roles.has(role)) return null;
    roles.add(role);
    rest = rest.slice(match[0].length).trimStart();
  }
  return roles;
}

const speakerAsRecipient = "(?:자기|자신|발신자|발신인|상대(?:방)?)(?:에게|한테|쪽으로)";
const receiverOwnedCode = deliveredToRecipient.source + "\\s*(?:" + oneTimeConfirmationValue + "|" + credential + ")(?:을|를)";
const respondingParty = /^(?:발신(?:자|인)|상대(?:방)?|상담원|(?:(?:[\p{L}]{1,12}\s+){0,2}(?:문의|질문)(?:에|에는)\s*(?:(?:답(?:변)?|응답)(?:하던|한|하는|해\s*(?:준|주던|주는)))|답장(?:을)?\s*(?:쓴|쓰던|보낸|보내\s*(?:준|주던)))\s*(?:사람|담당자|쪽))(?:이|가|은|는)\s+/u;
const requiresPersonalReceipt = new RegExp("^" + receiverOwnedCode +
  "\\s+(?:자기가|자신이|본인이)\\s*(?:(?:직접|꼭)\\s*)?(?:(?:전달|인계|전송)\\s*)?받아야(?:만)?\\s*" +
  "(?:한다|된다)(?:고|며)\\s*(?:말했|설명했|밝혔|답했|했)(?:다|습니다|어요)[.。!]?\\s*$", "iu");

function claimsRecipientsCode(clause) {
  if (inactiveReport.test(clause) || supportIllustration.test(clause)) return false;
  const speaker = respondingParty.exec(clause);
  return Boolean(speaker && requiresPersonalReceipt.test(clause.slice(speaker[0].length)));
}

const receivedCodeAndDestination = new RegExp("^(?:" + receiverOwnedCode + "\\s+" + speakerAsRecipient +
  "|" + speakerAsRecipient + "\\s+" + receiverOwnedCode + ")\\s+", "iu");
const proceedsWhenIssuerReceives = /^(?:전달|인계|전송)받(?:아야(?:만)?|은\s*뒤에만)\s*(?:(?:접수|처리|신청|확인|상담)(?:\s*절차)?|절차)(?:가|이|는|은)?\s*(?:된다|가능하다|진행된다)(?:고|는|며)\s*(?:했|하였|말했|설명했|적었|알렸|안내했)/u;

function reportsIssuerContingentHandoff(clause) {
  if (inactiveReport.test(clause) || localEntry.test(clause) || otherRelayTopic.test(clause)) return false;
  const issuer = currentRelayIssuer.exec(clause);
  if (!issuer) return false;
  const request = clause.slice(issuer.index + issuer[0].length).trimStart();
  const argumentsInReport = receivedCodeAndDestination.exec(request);
  // 발신자가 받아야 일이 진행된다고 설명한 경우, 수신자에게 온 값이 발신자 쪽으로 이동한다.
  return Boolean(argumentsInReport && proceedsWhenIssuerReceives.test(request.slice(argumentsInReport[0].length)));
}

const supportOfferIssuer = /^(?:[\p{L}\p{N}·-]{1,12}\s+){0,3}(?:수리|기술|원격|기기|전산|고장|점검)\s*(?:상담|지원|점검|안내)(?:을|를|이라고|이라며)?\s*(?:내세운|자처한|사칭한|가장한|빙자한|표방한|제안한|권한|하겠다는|한다는|한다며|한다고\s*한|해\s*주겠다는|해\s*준다는|하던|한)\s*(?:사람|쪽|이)(?:이|가|은|는)\s+/u;
const displayedSupportCode = "(?:원격\\s*(?:지원|제어|접속|상담)\\s*(?:화면|창|도구|앱)(?:에|에서)\\s*" +
  "(?:표시된|나온|뜬|보이는|발급된|나타난|생성된)\\s*" +
  "(?:(?:일회용|1\\s*회용|일회성|1\\s*회성)\\s*)?(?:연결|접속|지원|인증)\\s*(?:코드|번호|값)|" +
  "(?:일회용|1\\s*회용|일회성|1\\s*회성)\\s*원격\\s*(?:지원|제어|접속)\\s*(?:코드|번호|값))";
const directAccessCode = "(?:(?:일회용|1\\s*회용|일회성)\\s*(?:접속|연결|인증|확인)\\s*(?:값|코드|번호|숫자)|" +
  "원격\\s*(?:지원|접속|제어|연결)\\s*(?:용\\s*)?(?:(?:인증|확인|검증|승인|보안|임시|등록)\\s*)?(?:값|코드|번호|암호))";
const ownedAccessDisplay = /(?:내|제|나의|저의|수신자(?:의)?)\s*(?:화면|표시창)(?:에|에서)\s*(?:나온|표시된|보이는|뜬)/u;
const helperOffer = /^(?:(?:[\p{L}]{1,12})(?:으로|로)\s+)?(?:도와\s*(?:준다는|주겠다는)|돕겠다는|(?:함께|같이)\s*봐\s*(?:준다는|주겠다는))\s*(?:사람|쪽|이)(?:이|가|은|는)\s+/u;
const accessValueOrigin = "(?:" + ownedAccessDisplay.source + "|" + deliveredToRecipient.source + "|(?:(?:방금|막|오늘|지금|새로|직접|문자로|알림으로)\\s*)?(?:받은|수신한|온|도착한|표시된|뜬))";
const hasReportedAccessCode = new RegExp(displayedSupportCode + "|" + directAccessCode, "iu");
const reportedAccessIssuer = /^(?:[\p{L}\p{N}·-]{1,12}\s+){0,4}[\p{L}\p{N}]{0,12}(?:하겠다는|한다는|한다며|한다고\s*한|해\s*준다는|해\s*주겠다는)\s*(?:사람|이|직원|상대)(?:이|가|은|는)\s+/u;
const deliveryToIssuer = "(?:자신|자기|본인|발신(?:자|인)|보낸\\s*사람|상대(?:방)?)(?:에게|한테|\\s*쪽(?:으로|에))";
const supportChatChannel = "(?:(?:이|같은|해당|상담|지원)\\s*)?(?:문자|메시지|채팅(?:방|창)?|대화방|메신저)(?:로|으로|에)";
const remoteRelayArgument = new RegExp(
  "^\\s*(?:(?<agent>제가|내가|수신자가|받은\\s*사람이)|" +
  "(?<value>(?:" + accessValueOrigin + "\\s*)?(?:" + displayedSupportCode + "|" + directAccessCode + ")(?:을|를|만))|" +
  "(?<destination>" + deliveryToIssuer + ")|(?<channel>" + supportChatChannel + "))(?=\\s|$)", "iu",
);
const supportRelayPredicate = /\s*(?:(?:전달하|전송하|인계하|건네|넘기|알리)(?:라(?:고|는|며)|도록)|(?:전달해|전송해|보내|전해|알려|넘겨|건네|읽어|불러|말해)\s*달(?:라고|라는|라며))\s*(?<ending>[^.!?\n]*)[.!?]?$/u;
const supportReportedEnding = /^(?:했|하였|말했|설명했|덧붙였)(?:다|습니다|어요|음)$/u;
const supportIllustration = /^(?:연습|예시|예제|사례|가상|훈련|모의)(?:로)?\s*(?:용|기록|자료|상황|사례|문구|대본|설명|[：:])/u;
const supportIssuerWithdrawal = /^(?:발신자|발신인|상담원|상대(?:방)?|보낸\s*사람)(?:이|가|은|는)\s*(?:(?:그|같은|해당)\s*)?(?:요구|요청|지시)(?:을|를)?\s*(?:이미\s*)?(?:취소|철회)(?:했|하였)/u;
const ownSupportBooking = /^(?:제가|저는|내가|나는|수신자(?:가|는))\s*[^,.!?\n]{0,32}(?:원격\s*지원|지원\s*상담|원격\s*상담|기술\s*지원)[^,.!?\n]{0,18}(?:(?:먼저|직접|미리)\s*)?(?:예약|신청|요청|접수)(?:을|를)?\s*(?:했(?:다|습니다|어요)|해\s*두었(?:다|습니다)|해\s*뒀(?:다|습니다)|하였(?:다|습니다))(?=[\s.!?。]|$)/u;
const earlierSupportBooking = /^(?:제가|저는|내가|나는|수신자(?:가|는))\s*(?:먼저|직접|미리)\s*(?:예약|신청|접수|요청)한\s*(?:원격\s*)?(?:지원|상담)(?:이었(?:다|습니다)|였(?:다|습니다)|입니다|임)(?=[\s.!?。]|$)/u;

function reportsSupportCodeToIssuer(clause) {
  if (inactiveReport.test(clause) || otherRelayTopic.test(clause) || supportIllustration.test(clause) || clause.endsWith("?")) return false;
  const lead = relayReportLead.exec(clause) ?? supportOfferIssuer.exec(clause) ?? reportedAccessIssuer.exec(clause) ??
    (ownedAccessDisplay.test(clause) ? helperOffer.exec(clause) : null);
  if (!lead) return false;
  const request = clause.slice(lead[0].length);
  const predicate = supportRelayPredicate.exec(request);
  if (!predicate) return false;
  const ending = predicate.groups.ending.trim();
  if (lead.groups?.request ? !nominalRelayEnding.test(ending) :
      !relayRequestEnding.test(ending) && !supportReportedEnding.test(ending)) return false;
  const roles = relayArguments(request.slice(0, predicate.index), remoteRelayArgument);
  return Boolean(roles?.has("value") && roles.has("destination"));
}

const otherBookingActor = /(?:발신자|상담원|담당자|직원|상대(?:방)?|다른\s*사람)(?:이|가|은|는)\s/u;

function receiverInitiatedSupport(text) {
  return !otherBookingActor.test(text) && (ownSupportBooking.test(text) || earlierSupportBooking.test(text));
}

function hasReceivedCredentialRequest(text, hasUnverifiedLink) {
  if (hasUnverifiedLink && reportsSecretInLinkedForm(text)) return true;
  const hasOwnedCode = deliveredToRecipient.test(text);
  const hasAccessCode = hasReportedAccessCode.test(text);
  if (hasOwnedCode || hasAccessCode) {
    const identifiesIssuer = clause => currentRelayIssuer.test(clause) || relayReportLead.test(clause) || readHandoff(clause).claimed ||
      (hasAccessCode && (supportOfferIssuer.test(clause) || reportedAccessIssuer.test(clause) ||
        ownedAccessDisplay.test(clause) && helperOffer.test(clause)));
    const observations = new Map();
    // 수신 문맥 판별 콜백에서 읽은 절은 결과를 채택할 때 다시 분석하지 않는다.
    function readHandoff(clause) {
      if (!observations.has(clause)) observations.set(clause, {
        owned: hasOwnedCode && (reportsRelayWithExplicitArguments(clause) || reportsIssuerContingentHandoff(clause)),
        claimed: hasOwnedCode && claimsRecipientsCode(clause),
        remote: hasAccessCode && reportsSupportCodeToIssuer(clause),
      });
      return observations.get(clause);
    }
    const identifiesHandoff = clause => {
      const handoff = readHandoff(clause);
      return handoff.owned || handoff.claimed || handoff.remote;
    };
    for (const { body, previous, next } of currentReceivedRequests(text, identifiesIssuer, identifiesHandoff)) {
      if (withdrewCodeRelay.test(next)) continue;
      const handoff = readHandoff(body);
      if (handoff.owned) return true;
      if (handoff.claimed && !supportIllustration.test(previous) && !supportIssuerWithdrawal.test(next)) return true;
      if (handoff.remote && !supportIssuerWithdrawal.test(next) && !supportIllustration.test(previous) &&
          ![previous, body, next].some(receiverInitiatedSupport)) return true;
    }
  }
  if (relayOrderFromIssuer.test(text)) {
    for (const { body } of currentReceivedRequests(text, value => currentRelayIssuer.test(value), reportsCodeHandoffToIssuer)) {
      if (reportsCodeHandoffToIssuer(body)) return true;
    }
  }
  for (const { body, next } of currentReceivedRequests(text)) {
    if (localEntry.test(body)) continue;
    if (senderRelay.test(body) || requiresHandoffToAssignedStaff(body) || requiresHandoffToAssignedStaff(next)) return true;
    if (!hasUnverifiedLink) continue;
    const form = remoteEntry.exec(body);
    const afterForm = form && body.slice(form.index + form[0].length);
    const asksForSecret = formEntryReport.test(body) || (form && (
      entryAfterValue.test(afterForm) || (valueBeforeForm.test(body.slice(0, form.index)) && entryAfterForm.test(afterForm))
    ));
    if (!asksForSecret) continue;
    const address = statedFormAddress.exec(body) ?? (continuedFormAddress.test(next) && statedFormAddress.exec(next));
    if (address && externalOnly(inspectLinkCandidates(address.groups.token))) return true;
  }
  return false;
}

const namedFinancialForm = /(?:(?:입력|확인|접수)\s*(?:양식|서식|폼|창)|(?:양식|서식|폼|입력창))(?:은|는|이|가|의)?\s*[:：]?\s*$/u;
const linkedFinancialForm = /^(?:(?:이며|이고|인데|였고|이었고)\s*[,，]?\s*)?(?:(?:에서|으로|에|로)\s+(?:(?:연결된|열린|열리는|제시된)\s+)?)?(?:(?:입력|확인|접수|외부|출처가|미확인|확인되지\s*않은)\s+)*(?:양식|서식|폼|입력\s*창)(?:에서|에는|이|가|은|는|의|에)?(?=\s|[.,!?]|$)/u;
const sameFinancialForm = /(?:그|해당|이|같은)\s*(?:입력\s*)?(?:양식|서식|폼|창|칸)(?:에|으로|에서)(?=\s|$)/u;
const sameFinancialAddress = /(?:그|해당|이|같은)\s*(?:(?:웹|접수|입력)\s*)?(?:주소|링크|화면)(?:에서|으로|에|로)(?=\s|$)/u;
const recordedAddressLabel = /(?:주소|링크)(?:은|는|이|가)?\s*[:：]?\s*$/u;
const financialFieldHeading = /^(?:필수\s*(?:(?:입력|기입)(?:\s*(?:항목|정보|값))?|항목|정보|값)|요구(?:한|하는)?\s*(?:입력\s*)?(?:항목|정보|값))(?:으로는|로는|에는|에서|으로|로|에|은|는|이|가)?\s*[:：]?\s*/u;
const financialFieldValue = new RegExp("^(?:" + bankAuthentication.source + ")" +
  "(?:(?:이었|였)(?:다|습니다)|(?:이?라고\\s*(?:적혀|써|표시)(?:\\s*있(?:었다|었습니다))?)|입니다|임|" +
  "(?:이|가)?\\s*(?:(?:포함|기재)(?:됐(?:다|습니다)|되었(?:다|습니다)|됨)|(?:들어\\s*)?있(?:음|다|습니다|었다|었습니다)))[.!?\\s]*$", "u");
const recordedFinancialRequest = /(?:받은|수신한|도착한|발신(?:자|처|인)|보낸\s*(?:사람|곳|쪽)|(?:안내|메시지|문자|알림|연락)(?:에|에는|의|에서)|(?:접수|신청|확인)\s*(?:절차|단계))/u;

function fieldRequiresFinancialValue(text) {
  const heading = financialFieldHeading.exec(text);
  return Boolean(heading && financialFieldValue.test(text.slice(heading[0].length)));
}

const formInputDirective = /^(?:입력|기입|작성)(?:하라(?:고|는|며)|해야|해\s*달라|을\s*요구)/u;
const valueWithFormInputDirective = new RegExp("^" + entryValue + "(?:직접\\s*)?" + formInputDirective.source.slice(1), "u");

function asksForValueInSameForm(text, addressOnly = false) {
  const reference = (addressOnly ? sameFinancialAddress : sameFinancialForm).exec(text);
  if (!reference || inspectLinkCandidates(text).candidates.length) return false;
  const prior = text.slice(0, reference.index);
  if (addressOnly && reference[0].includes("화면") && (!/^(?:입력|기입|작성)/u.test(prior) || /(?:다른|별도|새로)\s*(?:화면|앱|주소|링크)/u.test(prior))) return false;
  const following = text.slice(reference.index + reference[0].length).trimStart();
  return valueBeforeForm.test(prior) && formInputDirective.test(following) ||
    valueWithFormInputDirective.test(following);
}

const ancillaryFormAddress = /(?:문의|상담|참고|소개|미리보기|홍보)\s*(?:페이지|주소|링크|창구)(?:은|는|이|가)?\s*[:：]?\s*$/u;

function reportsSecretInLinkedForm(text) {
  const clauses = text.split(clauseBreak).map(clause => clause.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    const previous = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    const context = previous + " " + clause;
    if (formNotInUse.test(context) || inactiveReport.test(context) || localEntry.test(context) ||
        mereFormReference.test(context) || closedSubmission.test(next)) continue;
    const parsed = inspectLinkCandidates(clause);
    if (!externalOnly(parsed) || parsed.candidates.length !== 1) continue;
    const link = parsed.candidates[0];
    const position = clause.indexOf(link.raw);
    if (position < 0) continue;
    const before = clause.slice(0, position);
    const after = clause.slice(position + link.raw.length).trimStart();
    const linked = linkedFinancialForm.exec(after);
    const labelled = namedFinancialForm.test(before);
    const particle = applicationAddressParticle.exec(after);
    const labelledAddress = recordedAddressLabel.test(before);
    if (ancillaryFormAddress.test(before) ||
        (!linked && !labelled && !labelledAddress)) continue;
    const documentedForm = recordedFinancialRequest.test(context + " " + next);

    const requirement = after.slice(linked?.[0].length ?? particle?.[0].length ?? 0).trimStart();
    if (documentedForm && (linked || labelled && particle) && fieldRequiresFinancialValue(requirement)) return true;
    if (formBoundary.test(next) || inactiveReport.test(next) || localEntry.test(next) ||
        mereFormReference.test(next) || closedSubmission.test(clauses[index + 2] ?? "")) continue;
    if (documentedForm && (linked || labelled) && asksForValueInSameForm(next) ||
        labelledAddress && asksForValueInSameForm(next, true)) return true;
  }
  return false;
}

const receivedFormHeader = /(?:받은|수신한|도착한|전달받은)[^.!?\n]{0,42}(?:양식|서식|신청서|신청\s*화면|접수\s*(?:화면|안내|문구))/u;
const formBoundary = /^(?:다른|별개|이와\s*별개|그와\s*별개|한편|별도의?\s*(?:행사|신청|접수|양식|서식)|-{3})/u;
const formNotInUse = /(?:예방\s*교육|교육\s*(?:자료|용)|작성\s*예시|빈\s*서식|전시\s*사본|모의\s*(?:양식|신청))|(?:그|이|해당|같은)\s*(?:제출\s*)?(?:요구|요청|접수|신청)(?:[을를은는이가])?\s*(?:이미\s*)?(?:철회|거절|취소|종료|마감)|(?:해당|이|그)\s*(?:양식|서식)(?:[은는을를])?\s*사용하지\s*(?:않|말)/u;
const submissionField = /^(?:(?:(?:수신(?:한)?|받은)\s*)?(?:문자|안내|원문)(?:에\s*(?:적힌|표시된|있는))\s*)?(?:제출|접수|신청|양식|서식)\s*(?:용\s*)?(?:주소|링크|페이지|화면)(?:[은는이가])?\s*(?:[|:：]\s*|\s+)(.*)$/u;
const identityMaterial = "(?:" + identityCopy + "|신분\\s*확인(?:용)?\\s*(?:서류|자료))";
const bankMaterial = "(?:" + bankCopy + "|통장\\s*자료)";
const formPair = new RegExp("^(?:" + identityMaterial + together + bankMaterial + "|" + bankMaterial + together + identityMaterial + ")", "u");
const attachmentHeading = /^(?:(?:필수|요구)\s*(?:제출|첨부)?\s*(?:항목|서류|자료)?|함께\s*(?:제출|첨부))\s*[|:：]\s*/u;
const purposeHeading = /^(?:신청\s*(?:구분|유형|종류|목적)|명목|사업명|모집\s*(?:구분|유형))(?=[\s|:：])/u;
const requiredAfterPair = /^(?:[을를])?\s*(?:(?:함께|한꺼번에|모두|동시에)\s*)?(?:제출|첨부|전송)(?:하라(?:는|고)|해야|해\s*달라)/u;
const valueHeading = /^(?:(?:(?:양식|서식|원문|안내)(?:[이가]|에서)\s*)?(?:요구한|요구하는|입력해야\s*할)\s*(?:값|정보|항목)|필수\s*(?:입력|기입)(?:\s*(?:값|정보|항목))?)(?:[은는이가])?\s*(?:[|:：]\s*|\s+)/u;
const secretFieldValue = /^(?:(?:금융\s*)?(?:계좌|통장)\s*(?:접속\s*)?(?:비밀번호|비번|암호)|(?:복구|시드)\s*(?:문구|구문)|보안\s*카드\s*(?:번호\s*)?(?:전체|전부)|금융\s*비밀값)(?:\s*(?:에\s*해당(?:함|합니다|한다)|입니다|임))?[.\s]*$/u;
const secretEntryForbidden = /(?:암호|비밀번호|비밀값|복구\s*문구|시드\s*구문|보안\s*카드)[^.!?\n]{0,22}(?:입력|기입)(?:을|은)?\s*(?:금지|하지\s*(?:말|마|않))/u;

function requestsBothDocuments(row) {
  const heading = attachmentHeading.exec(row);
  const value = heading ? row.slice(heading[0].length) : row;
  const pair = formPair.exec(value);
  if (!pair || inactiveReport.test(row)) return false;
  const remainder = value.slice(pair[0].length);
  return heading ? /^[.\s]*$/u.test(remainder) : requiredAfterPair.test(remainder);
}

function addFormFields(rows, signals) {
  if (!rows.length || rows.some(row => formNotInUse.test(row))) return;
  const destinations = rows.map(row => submissionField.exec(row)?.[1]?.trim()).filter(value => value !== undefined);
  if (new Set(destinations).size !== 1) return;
  const [address] = destinations;
  if (!/^https?:\/\/\S+$/iu.test(address) || !externalOnly(inspectLinkCandidates(address))) return;

  const aidApplication = rows.some(row => (receivedFormHeader.test(row) || purposeHeading.test(row)) && hasApplicationPurpose(row));
  if (aidApplication && rows.some(requestsBothDocuments)) signals.add(SIG_DOCUMENT_BUNDLE);
  if (!rows.some(row => secretEntryForbidden.test(row)) && rows.some(row => {
    const heading = valueHeading.exec(row);
    return heading && secretFieldValue.test(row.slice(heading[0].length));
  })) signals.add(SIG_CREDENTIAL_DISCLOSURE);
}

// 표의 열 순서는 바뀔 수 있다. 한 양식 안의 제출처와 필수 값만 서로 연결한다.
function addReceivedFormFields(text, signals) {
  let rows = [];
  for (const line of text.split(/[\r\n;；]+|(?<=[.!?。])\s+/u)) {
    const row = line.trim();
    const header = receivedFormHeader.test(row);
    if (header || formBoundary.test(row)) {
      addFormFields(rows, signals);
      rows = header ? [row] : [];
    } else if (rows.length && row) {
      rows.push(row);
    }
  }
  addFormFields(rows, signals);
}

const introducedForm = /(?:신청|접수|확인|제출)\s*(?:확인\s*)?(?:양식|서식|폼)(?:의|은|는|이|가|으로|인|에\s*해당하는)?\s*(?:(?:주소|링크)(?:가|는|은|로)?\s*)?(?:(?:라고|로)\s*)?(?:제시(?:한|된|한\s*주소)|안내(?:한|된)|보낸|적힌)?\s*(?:다음|아래|여기)?\s*[:：]?\s*$/u;
const formRequestNamed = /^\s*(?:(?:그|해당|같은|이)\s*)?(?:양식|서식|폼)(?:에서|에는|에|의|은|는)?\s*(?:(?:요구(?:하는|한)|필수로)\s*)?제출\s*(?:요구(?:\s*(?:항목|내용|대상|서류|자료))?|대상|항목|서류|자료)(?:은|는|이|가)?\s*[:：]?\s*|^\s*(?:(?:그|해당|같은|이)\s*)?(?:양식|서식|폼)(?:에서|에는|에)\s*제출하라고\s*한\s*(?:것|자료|서류)(?:은|는|이|가|[:：])?\s*/u;
const identityPhoto = "(?:" + identityMaterial + "|신분\\s*확인(?:용)?\\s*(?:사진|사본))";
const formRequiredPair = new RegExp(
  "^(?:" + identityPhoto + together + "(?:계좌를\\s*확인하는\\s*)?" + bankMaterial +
  "|" + bankMaterial + together + identityPhoto + ")(?=$|[\\s.,!?]|(?:이|가|을|를|입니다|이라고|이라고는|라는))", "u",
);
const mereFormReference = /(?:참고|예시|가상|견본|교육용|양식\s*미리보기)(?:로만|로|의|를|은|는|\s*(?:항목|자료|사진|사본))|(?:제출하|올리|보내)지\s*(?:말|마|않)/u;

function reportsPairedSubmissionAtAddress(clause, previous, next) {
  const context = previous + " " + clause;
  if (!hasApplicationPurpose(context) || formNotInUse.test(context) || inactiveReport.test(context) ||
      mereFormReference.test(context + " " + next)) return false;
  const parsed = inspectLinkCandidates(clause);
  if (!externalOnly(parsed) || parsed.candidates.length !== 1) return false;
  const link = parsed.candidates[0];
  const start = clause.indexOf(link.raw);
  if (start < 0 || !introducedForm.test(clause.slice(0, start))) return false;
  const tail = clause.slice(start + link.raw.length).trimStart()
    .replace(/^(?:(?:이며|이고|였고|였으며|입니다|이었으며|로\s*표시되고|로\s*적혀\s*있고)\s*[,，]?\s*|[:：,，;；)）\/]\s*)/u, "");
  const requests = [tail, next].filter(text => !topicBoundary.test(text) && !inactiveReport.test(text));
  return requests.some(text => {
    const role = formRequestNamed.exec(text);
    return Boolean(role && formRequiredPair.test(text.slice(role[0].length)));
  });
}

const submissionAddressRole = /(?:(?:서류|자료)(?:를|을)\s*(?:제출|첨부)하는\s*(?:주소|링크|곳)|(?:신청|접수|제출|첨부)\s*(?:주소|링크|양식|서식|폼))(?:은|는|이|가)?\s*[:：]?\s*$/u;
const applicationDocumentNotice = /(?:신청\s*)?(?:서류|첨부|제출)\s*(?:안내|알림)(?:에는|에서|에|는)/u;
const applicationAddressParticle = /^(?:에서|으로|에|로)(?=\s)/u;
const theSameSubmissionForm = /(?:그|해당|같은|이)\s*(?:(?:신청|제출|접수)\s*)?(?:양식|서식|폼|주소|링크)(?:에서|으로|에|로)(?=\s|[,.!?]|$)/u;
const digitalIdentityMaterial = "(?:" + identityPhoto + "|(?:신분증|주민등록증|운전면허증|여권)(?:\\s*자료)?)";
const jointSubmissionPair = new RegExp("(?:" + digitalIdentityMaterial + together + bankMaterial + "|" +
  bankMaterial + together + digitalIdentityMaterial + ")(?=$|[\\s.,!?]|(?:은|는|이|가|을|를|이라고|라고))", "u");
const requiredDocumentField = /(?:필수\s*(?:제출|첨부)|제출\s*요구)\s*(?:항목|서류|자료)(?:은|는|이|가|[:：])?\s*$/u;
const submitsThePair = /^(?:을|를)?\s*(?:(?:함께|같이|둘\s*다|모두|한꺼번에|동시에)\s*)?(?:제출|첨부)\s*(?:해야|하라(?:고|는|며)|해\s*달라|하는\s*(?:항목|자료|서류)(?:이|가)?\s*(?:들어|있|적혀|표시|포함))/u;
const documentFieldStatement = /^(?:이?라고\s*(?:적혀|표시|써|기록)|입니다|(?:이|가)\s*(?:필수|요구))/u;
const closedSubmission = /^(?:그|해당|같은|이)\s*(?:서류\s*)?(?:요구|요청|지시)(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:철회|취소)/u;

function specifiesJointSubmission(text) {
  const pair = jointSubmissionPair.exec(text);
  if (!pair) return false;
  const before = text.slice(0, pair.index);
  const after = text.slice(pair.index + pair[0].length).replace(theSameSubmissionForm, " ").trimStart();
  return submitsThePair.test(after) ||
    requiredDocumentField.test(before) && documentFieldStatement.test(after);
}

function immediatelyPrecedesDestination(text) {
  const pair = jointSubmissionPair.exec(text);
  return Boolean(pair && /^(?:을|를)?\s*(?:(?:함께|같이|둘\s*다|모두|한꺼번에|동시에)\s*)?$/u
    .test(text.slice(pair.index + pair[0].length)));
}

function startsWithSubmissionObjects(text) {
  const pair = jointSubmissionPair.exec(text);
  return Boolean(pair && (pair.index === 0 || requiredDocumentField.test(text.slice(0, pair.index))));
}

function submitsToTheSameForm(text) {
  const destination = theSameSubmissionForm.exec(text);
  if (!destination || inspectLinkCandidates(text).candidates.length) return false;
  const before = text.slice(0, destination.index);
  const after = text.slice(destination.index + destination[0].length).trimStart();
  return immediatelyPrecedesDestination(before) && specifiesJointSubmission(before + " " + after) ||
    !before.trim() && startsWithSubmissionObjects(after) && specifiesJointSubmission(after);
}

function reportsJointSubmissionInApplication(clause, previous, next, afterNext) {
  const context = previous + " " + clause;
  if (!hasApplicationPurpose(context) || formNotInUse.test(context) || inactiveReport.test(context) ||
      mereFormReference.test(context) || closedSubmission.test(next)) return false;
  const parsed = inspectLinkCandidates(clause);
  if (!externalOnly(parsed) || parsed.candidates.length !== 1) return false;
  const link = parsed.candidates[0];
  const position = clause.indexOf(link.raw);
  if (position < 0) return false;
  const before = clause.slice(0, position);
  const tail = clause.slice(position + link.raw.length).trimStart();
  const labelledAddress = submissionAddressRole.test(before);
  const directAddress = applicationAddressParticle.exec(tail);
  if (directAddress) {
    const after = tail.slice(directAddress[0].length).trimStart();
    // URL에 붙은 조사가 같은 제출 동사의 목적지를 나타내는 경우만 본다.
    if (immediatelyPrecedesDestination(before) && specifiesJointSubmission(before + " " + after)) return true;
    if ((labelledAddress || applicationDocumentNotice.test(before)) &&
        startsWithSubmissionObjects(after) && specifiesJointSubmission(after)) return true;
  }

  return labelledAddress && !formBoundary.test(next) && !inactiveReport.test(next) &&
    !mereFormReference.test(next) && !closedSubmission.test(afterNext) &&
    submitsToTheSameForm(next);
}

export function addReportedProtectedRequests(text, signals, hasUnverifiedLink) {
  if (hasReceivedCredentialRequest(text, hasUnverifiedLink)) signals.add(SIG_CREDENTIAL_DISCLOSURE);
  if (hasUnverifiedLink) addReceivedFormFields(text, signals);
  const clauses = text.split(clauseBreak).map(clause => clause.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    if (inactiveReport.test(clause)) continue;
    if (hasCurrentReportedRelay(clause)) signals.add(SIG_CREDENTIAL_DISCLOSURE);
    if (!hasUnverifiedLink) continue;
    if (reportsPairedSubmissionAtAddress(clause, clauses[index - 1] ?? "", clauses[index + 1] ?? "") ||
        reportsJointSubmissionInApplication(clause, clauses[index - 1] ?? "", clauses[index + 1] ?? "", clauses[index + 2] ?? "")) {
      signals.add(SIG_DOCUMENT_BUNDLE);
    }
    const pair = documentPair.exec(clause);
    if (!pair || !requiredCopies.test(clause.slice(pair.index + pair[0].length))) continue;
    const previous = clauses[index - 1] ?? "";
    if (!hasApplicationPurpose(clause) && (!hasApplicationPurpose(previous) || inactiveReport.test(previous) || topicBoundary.test(clause))) continue;
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
    return hasApplicationPurpose(request) && !commentary.test(request) && docs.test(clause) && externalForm(clause, clauses[i + 1]);
  });
}
