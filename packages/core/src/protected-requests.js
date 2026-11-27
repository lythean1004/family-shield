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

const bankAuthentication = /(?:금융\s*비밀(?:값|정보|자료)?|금융\s*인증\s*정보)(?:을|를|의)?\s*(?=입력)|(?:계좌|통장)\s*(?:비밀번호|비번|암호)|(?:복구|시드)\s*(?:문구|구문)|보안\s*카드\s*(?:번호\s*)?(?:전체|전부)/u;
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

  // 조사가 붙은 수신자 주어, 인증값 목적어, 사람 목적지가 동일한 인용문의 전달 동사에 걸려야 한다.
  const argumentsInQuote = new Set();
  let rest = request.slice(0, predicate.index).trim();
  while (rest) {
    const match = relayArgument.exec(rest);
    if (!match) return false;
    const { agent, value } = match.groups;
    const role = agent ? "agent" : value ? "value" : "destination";
    if (argumentsInQuote.has(role)) return false;
    argumentsInQuote.add(role);
    rest = rest.slice(match[0].length).trimStart();
  }
  return argumentsInQuote.size === 3;
}

function hasReceivedCredentialRequest(text, hasUnverifiedLink) {
  if (deliveredToRecipient.test(text)) {
    for (const { body, next } of currentReceivedRequests(text, clause => relayReportLead.test(clause), reportsRelayWithExplicitArguments)) {
      if (!withdrewCodeRelay.test(next) && reportsRelayWithExplicitArguments(body)) return true;
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

  const aidApplication = rows.some(row => (receivedFormHeader.test(row) || purposeHeading.test(row)) && aidOrWork.test(row));
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
  if (!aidOrWork.test(context) || formNotInUse.test(context) || inactiveReport.test(context) ||
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

export function addReportedProtectedRequests(text, signals, hasUnverifiedLink) {
  if (hasReceivedCredentialRequest(text, hasUnverifiedLink)) signals.add(SIG_CREDENTIAL_DISCLOSURE);
  if (hasUnverifiedLink) addReceivedFormFields(text, signals);
  const clauses = text.split(clauseBreak).map(clause => clause.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    if (inactiveReport.test(clause)) continue;
    if (hasCurrentReportedRelay(clause)) signals.add(SIG_CREDENTIAL_DISCLOSURE);
    if (!hasUnverifiedLink) continue;
    if (reportsPairedSubmissionAtAddress(clause, clauses[index - 1] ?? "", clauses[index + 1] ?? "")) {
      signals.add(SIG_DOCUMENT_BUNDLE);
    }
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
