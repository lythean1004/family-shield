import { currentReceivedRequests } from "./received-message.js";
import { INVESTIGATIVE } from "./cash-handover.js";
import { isCardCallbackNumber, isCardSenderName, isCardSenderService } from "./card-sender.js";
import { hasOpenInstallationReport, startsOtherOrganizer } from "./reported-notice-fields.js";
import {
  SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER, SIG_CASH_HANDOVER,
  SIG_FOREIGN_PAYMENT_CALLBACK, SIG_LOAN_CASH_PICKUP, SIG_PERSONAL_INFO,
} from "./signals.js";

// 발신자가 내세운 역할만 인식한다. 정식 연락처인지 확인할 때는 근거 카드를 사용한다.
const investigator = new RegExp("(?:" + INVESTIGATIVE + "|(?:^|\\s)수사\\s*기관)$");
const institutionalRole = /(?:기관|회사|은행|카드사|보험사|택배사|금융사|건강\s*보험|(?:시|구|군|도)청|세무서|공단|공사|학교|도서관|보건소|병원|우체국|관공서)$/;
const department = /\s+(?:(?:고객|보관)\s*센터|[가-힣]{0,10}(?:실|부서|담당자?|직원|창구|센터|팀))$/;
const senderField = /^(?:발신(?:처|자|\s*(?:이름|표시|표기))|발행처|보낸\s*(?:곳|이)(?:\s*(?:표시|소개))?)(?:은|는|가|이)?[\s:：\u3000]+/;
const fieldEnd = /[,，/;|]|(?:이라고|라고)\s*(?:쓰|적|표시|밝)|(?:이?다|예요|이에요|입니다)$/;
const claim = /^(.{1,42}?)(?:이라고|라고|이라는|라는|이라네요|라네요|이래|래요?|이라며|라며|명의(?:의|로))(?=$|[\s,，])/;
const senderReport = /^(.{1,42}?)\s*(?:쪽)?에서\s*(?:보냈|연락(?:이)?\s*왔|(?:문자|답장|답신|회신)(?:가|이)?\s*왔|(?:[가-힣]+\s*){1,4}(?:있|남았)다(?:고|나))/;
const clearAttribution = /^(?:\[\s*)?(?:수신한\s*|받은\s*)?/;
const requestReport = /(?:라고\s*(?:했|하더|요구|부탁|표시|써|적)|(?:라고|라는|다는)\s*(?:내용|문구|대목|요구|조건|뜻|설명)|(?:이라고|라고)?\s*(?:표시됐|표시됨|적혔|적혀|써\s*있|기재)|(?:달랬|하랬)|(?:달라고|달라는|달래|하래|라네|라네요))|(?:되|끝나|처리된|열람된)다고/;
const separateSource = /(?:이와\s*별개로|이전에는|지난번에는|그보다\s*앞서|별개(?:의|로)|별도로\s*(?:온|받은|보낸)|한편|다른\s*(?:사람|단체|기관|업체|번호|문서|발신처|쪽지)|(?:별도|다른)\s*\S+\s*(?:운영자|담당자)|(?:온라인|종이)\s*서식\s*예시)/;
const teachingOrWithdrawn = /(?:예방\s*(?:교육|자료|안내|수업)|(?:피싱|사기|사칭|피해)\s*(?:교육|사례|주의)|(?:연극|드라마|영화)\s*(?:대본|배역|장면)|요구(?:를|는)?\s*(?:이미\s*)?(?:철회|취소|거절)|(?:이미\s*)?(?:거절했|거절했었|거절하고|거절함)|(?:발송|보낸)\s*적(?:이)?\s*없)/;
const noObligation = /(?:선택\s*(?:사항|이에요|입니다|이고|인)|(?:필수|요건|조건)(?:은|는|이|가)?\s*아니|(?:할\s*)?필요(?:는|가)?\s*없|(?:(?:제출|전송|입력|기입|회신|설치|통화|연락|전화)\s*하지|보내지|적지|알리지)\s*(?:말|마|않|말고)|(?:설치|답장|회신|전송|제출)\s*없이|(?:했|하였)던\s*(?:접수|신청)|(?:대신|참고용|예시(?:용)?|표준\s*서식|공란|빈\s*서식))/;
const obligation = /(?:해야(?:만)?(?!\s*(?:하는지|하는\s*건지|할지))|하도록|하라(?:는|고)|하래|해\s*달라|(?:적어|넣어|보내|내|올려)\s*(?:달라|달래|야)|필요(?=[\s,，.)\]]|하|라|$)|필수|요건)/;
const requestField = /(?:필수\s*(?:입력|회신|제출|요구)?\s*(?:항목|사항|자료)|(?:입력|회신|제출|요청|요구)\s*(?:항목|자료)|(?:수신자|제가|내가)\s*(?:해야|보내야|입력해야)\s*(?:할)?\s*일)(?:은|는|이|가)?[\s:：]+/;
const actionBefore = /(?:입력|기입|작성|회신|전송|제출|첨부|보내|적어|넣어|알려|달라)/;
const replyChannel = /(?:답장|회신(?:란)?|(?:문자|메시지)\s*답장|(?:이|같은|해당)\s*(?:대화|채팅|문자|메시지))(?:로|으로|란에|에|[ \t]+(?:안|칸)에)/;
const credentialForm = /(?:양식|서식|입력란|입력\s*칸)[’”」\]]?(?:의|에|에는|란에|에서)/;
const secret = /(?:카드|계좌|통장|(?:공동\s*)?현관(?:\s*(?:출입문?|문))?|자택\s*출입(?:문)?|집\s*(?:현관|출입문?)|출입문?)\s*(?:비밀번호|비번|암호)/;
const identity = /주민\s*등록\s*번호|(?:금융\s*)?계좌\s*번호|신분\s*(?:증(?:\s*(?:사진|사본))?|자료)|(?:개인\s*)?신상\s*(?:자료|정보)/;
const privateValue = new RegExp(`(?:${secret.source}|${identity.source})(?=(?:[을를은는이가와과]|이랑|랑)?(?:$|[\\s,，.\\]’”]))`);
const locallyEntered = /(?:공식\s*(?:앱|스토어|웹사이트|홈페이지|서비스)|(?:자기|본인|자신)(?:의)?\s*(?:기기|앱)에서|창구에서\s*(?:제시|확인)|직접\s*방문)/;
const noDisclosure = /(?:비식별|가명\s*처리|익명\s*처리|(?:개인정보|신상\s*(?:자료|정보))(?:를|가)?\s*(?:제거|삭제|가림)|자료(?:를|가)?\s*(?:제외|빼)|[를을은는]\s*(?:제외|기록하지|보내지|가려|보관만))/;
const extraSoftware = /(?:별도(?:의)?|외부(?:의)?|추가(?:\s*설치할)?)\s*(?:앱|어플|애플리케이션|프로그램)(?:을|를)?\s*(?:추가로?\s*)?설치/;
const onRecipientDevice = /(?:내|제|본인|수신자(?:의)?|개인)\s*(?:휴대\s*(?:폰|전화)|스마트폰|기기|컴퓨터)(?:에|에서)/;
const softwareInstall = /(?:앱|어플|애플리케이션|프로그램)(?:을|를)?\s*(?:추가로?\s*)?설치/;
const softwarePrerequisite = /(?:열람|본인\s*확인|확인|접수|신청|등록|처리)(?:\s*(?:전|을\s*위한|하려면))?(?:.{0,12})?(?:요건|조건|필수(?:\s*항목)?)(?:은|는|이|가|[:：])?/;
const conditionField = /^.{0,36}?(?:요건|조건|필수\s*항목)(?:은|는|이|가)?(?:\s*[:：]|[ \t]{2,}|\u3000|\t)/;
const staffDevice = /(?:운영|직원용?|업무|업무용|관리|전산)\s*(?:기기|컴퓨터|휴대\s*(?:폰|전화))|직원\s*교육|운영자(?:가|는)/;
const embeddedContact = /(?:(?:같은|그|해당|이)\s*)?(?:(?:문자|문서|답장|회신|답신|안내문?|쪽지|메시지|본문)(?:\s*속|에\s*(?:적힌|있는|나온|나와\s*있는|실린|표시된))|(?:전용|별도|지정된?))\s*(?:전화\s*)?(?:번호|연락처)?\s*/;
const contactNumber = /(?<![\d-])(?:0\d{1,2}[ -]?\d{3,4}[ -]?\d{4}|1[568]\d{2}[ -]?\d{4}|1\d{2,3})(?![\d-])/;
const directedCall = /^\s*(?:[:：]\s*)?(?:\([^)]{1,24}\)\s*)?(?:으로|로|에)(?:만)?\s*(?:먼저\s*|직접\s*)?(?:전화|통화|연락)(?:를|을)?\s*(?:하(?:래|라(?:고|는)?|도록|여야)|해야(?:만)?(?!\s*(?:하는지|하는\s*건지|할지))|해\s*달라|걸어야)/;

const directHandover = /(?:현금|현찰)(?:을|은|만)?\s*(?:(?:찾아|방문하러|받으러|가지러)\s*오는\s*(?:사람|직원|담당자)|(?:방문|수사|경찰)\s*(?:직원|담당자|수사관|대리인)|방문자|수사관|대리인)(?:에게|한테)\s*(?:직접\s*)?(?:건네|넘기|전달|인계)(?:라(?:고|네|는)|래|야|는\s*(?:방식|방법)|(?:\s*(?:요구|조건|필수))?$)/;
const cashField = /(?:항목(?:명)?|업무|인계\s*(?:항목|대상)|전달\s*(?:수단|항목))\s*[:：]?\s*(?:현금|현찰)(?:\s*(?:인계|전달))?$/;
const assignedCollector = /(?:(?:받으러|수거하러|가지러)\s*(?:온다는|오는)\s*(?:쪽|사람|직원)|(?:수령|수거|인수)(?:인|\s*담당자))\s*[:：]?\s*(?:경찰|검찰|수사|담당|방문)/;
const inPersonHandover = /(?:제가|내가|수신자(?:가|는))?\s*직접\s*(?:건네|넘기|인계하|전달하)는\s*(?:방식|방법|절차)/;
const recovery = /(?:분실물|습득물|유실물|반환|돌려받|돌려주|거절|상담만|이미\s*(?:종료|수령|수거|상환|취소))|(?:명목|내용)(?:이|은|가)?\s*아니/;
const repayment = /(?:대출(?:금)?|융자금)(?:의|을)?\s*상환|(?:상환\s*(?:접수|안내)|상환금\s*(?:징수|수령|받는\s*방법|회수|수거))/;
const lenderEmployee = /(?:은행|금융\s*(?:사|회사)|대출\s*(?:기관|회사)|금융\s*기관)(?:의|에서\s*온)?\s*(?:담당\s*)?직원(?:이|의)?/;
const residentialVisit = /(?:(?:집|자택|댁)(?:에|으로)?\s*(?:직접\s*)?방문|방문(?:해|하여|해서)?\s*(?:집|자택|댁))/;
const loanCollection = /(?:현금(?:으로|을|의)?\s*(?:수령|수거|징수|회수|받)|(?:수령|수거|징수|회수)(?:\s*[:：]?\s*|\s*[(（]\s*)현금)/;

const foreignHeader = /^\s*(?:\[Web발신\]\s*)?(?:\[(?:국외|국제|해외)\s*발신\]|(?:국외|국제|해외)\s*발신\s*[:：])/i;
const approvedPayment = /(?:(?:결제|거래|카드)(?:\s*(?:건|내역))?\s*(?:승인|완료)|(?:결제|거래)(?:가|는|이)?\s*승인됐)(?!\s*(?:예정|대기|실패|보류|취소))/;
const unauthorizedPayment = /(?:(?:내가|제가|본인이)\s*(?:쓴|산|한|승인한|요청한)\s*적(?:이)?\s*없(?:는|던)|(?:내가|제가|본인이)\s*(?:하지|결제하지|승인하지|신청하지)\s*않(?:은|았던)|(?:미승인|미사용|미결제)\s*)(?:[^!?\n]{0,16})(?:결제|거래|승인)/;
const designatedCancellation = /취소(?:할\s*때\s*(?:쓰|이용하|사용하)라는\s*|\s*시\s*|\s*(?:접수|신청|문의|전용|상담)?\s*)(?:전화\s*)?(?:번호|연락처)(?:는|가|로|이)?\s*(?:[:：]|로)?\s*$/;
const cancellationComplete = /(?:취소(?:가)?\s*(?:됐|되었|완료|결과)|이미\s*취소|취소하지|배송\s*문의)/;

function senderIn(clause) {
  const opening = clause.replace(clearAttribution, "");
  const field = senderField.exec(opening);
  const attribution = field ? null : claim.exec(opening) ?? senderReport.exec(opening);
  const text = field ? opening.slice(field[0].length).split(fieldEnd, 1)[0] : attribution?.[1];
  if (!text) return null;
  const name = text.trim().replace(department, "");
  if (investigator.test(name) || institutionalRole.test(name) || isCardSenderName(name)) {
    return { name, offset: field ? clause.length : clause.length - opening.length + attribution[0].length };
  }
  return null;
}

function requestedValue(text, pattern) {
  for (const field of text.matchAll(new RegExp(pattern.source, "g"))) {
    const after = text.slice(field.index + field[0].length);
    // '신분증 분실 여부'는 예/아니요로 답하는 항목이고 신분증 제출을 요구하지 않는다.
    if (!/^(?:의|을|를)?\s*(?:(?:분실|변경|재발급|발급|교체|수령|갱신|만료|제출)\s*)?(?:여부|유무|일정|날짜|일자|시기|방법|절차|횟수|기한|상태)/.test(after)) return field;
  }
  return null;
}

function hasPersonalRequest(clause) {
  if (locallyEntered.test(clause) || noDisclosure.test(clause)) return false;
  const entry = requestField.exec(clause);
  if (entry) {
    const value = clause.slice(entry.index + entry[0].length);
    const toReply = /회신|답장/.test(entry[0]);
    if (requestedValue(value, toReply ? privateValue : secret)) return true;
  }
  const subject = replyChannel.test(clause) ? privateValue : credentialForm.test(clause) ? secret : null;
  if (!subject) return false;
  const value = requestedValue(clause, subject);
  if (!value || !obligation.test(clause) || !actionBefore.test(clause.slice(value.index))) return false;
  // 정보 제출 동작과 정보가 같은 절에 있어야 한다.
  return !/^(?:에\s*(?:관한|대한)|의\s*(?:설명|정의)|(?:은|는)?\s*(?:가리|보관))/.test(clause.slice(value.index + value[0].length));
}

function hasPrivateCallback(clause) {
  const contact = embeddedContact.exec(clause);
  if (!contact) return false;
  const rest = clause.slice(contact.index + contact[0].length).replace(/^\s*[:：]\s*/, "");
  const number = contactNumber.exec(rest);
  if (number?.index === 0 && isCardCallbackNumber(number[0])) return false;
  return (number?.index === 0 || /(?:번호|연락처)\s*$/.test(contact[0])) &&
    directedCall.test(number?.index === 0 ? rest.slice(number[0].length) : rest);
}

function hasSoftwareRequest(clause) {
  const outsideApp = extraSoftware.test(clause) || (onRecipientDevice.test(clause) && softwareInstall.test(clause));
  return outsideApp && !staffDevice.test(clause) && !locallyEntered.test(clause) &&
    (softwarePrerequisite.test(clause) || obligation.test(clause));
}

function hasLoanCollection(clause) {
  const staff = lenderEmployee.exec(clause);
  if (!staff || recovery.test(clause)) return false;
  const action = clause.slice(staff.index + staff[0].length);
  const visit = residentialVisit.exec(action);
  if (!visit) return false;
  const collection = action.slice(visit.index + visit[0].length);
  return /^(?:해|해서|하여|하여서)?\s*(?:직접\s*)?(?:현금|수령|수거|징수|회수)/.test(collection) && loanCollection.test(collection);
}

function hasPaymentCallback(text, clauses) {
  if (!foreignHeader.test(text)) return false;
  const [header, body = ""] = clauses;
  return !!header && approvedPayment.test(header) && [header, body].some(clause => {
    if (!unauthorizedPayment.test(clause) || cancellationComplete.test(clause) || separateSource.test(clause)) return false;
    const number = contactNumber.exec(clause);
    if (!number || isCardCallbackNumber(number[0])) return false;
    return designatedCancellation.test(clause.slice(0, number.index));
  });
}

const senderRole = "(?:" + INVESTIGATIVE + "|(?:금융|수사|공공)\\s*기관|금융\\s*(?:회사|감독(?:원|\\s*기관|\\s*부서)?)|은행|보험(?:사|기관)|민원\\s*(?:안내|창구|접수(?:처|\\s*부서)|담당(?:자|\\s*부서)?)|카드사|건강\\s*보험(?:공단)?|(?:시|구|군|도)청|세무서|등기소|공단|우체국)";
const roleInReport = new RegExp(
  "(?<role>" + senderRole + ")(?:\\s*(?:쪽|직원|사람|담당자|민원\\s*창구|업무\\s*담당))?" +
    "(?:에서\\s*(?:보낸|보냈|연락|문자)|(?:이|가)\\s*(?:보낸|보냈)|(?:이?라고|라는|으로|로|이?라며)\\s*(?:적힌|표시|쓰[인였]|기재|밝힌|(?:자기(?:를)?\\s*)?소개))|" +
    "(?:발신처|발신자|보낸\\s*(?:곳|이))[^,.!?\\n]{0,18}(?<named>" + senderRole + ")", "u");
const explicitServiceActor = new RegExp(
  "(?<![\\p{L}\\p{N}])(?<role>" + senderRole + ")\\s+업무(?:(?:를\\s*)?(?:맡은|담당하는)|\\s*담당)\\s*" +
    "(?:곳|기관|부서|팀)(?:이?라고|이라며)\\s*(?:자신|자기)(?:들)?(?:을|를)?\\s*(?:설명|소개|밝)", "u");
const reportedLevyDispatch = /(?<service>교통\s*(?:범칙금|과태료))\s*(?:(?:처리|징수|부과)\s*)?담당\s*(?:부서|기관|팀|자)(?:에서|이|가)\s*(?:연락|통지|안내|알렸|발송|보냈)(?:했|하였)?다고/u;
const sourceSelectedApp = /(?:그\s*쪽|발신(?:자|인|처)|상대(?:방)?|보낸\s*(?:사람|쪽))(?:이|가|는|은)?\s*(?:소개한|지정한|정한|보낸|알려\s*준)\s*$/u;
const reportedActionInquiry = /^\s*(?:하는지|하는\s*건지|할지|할\s*필요|하는\s*여부)/u;

const levyOfficer = /(?<role>(?:과태료|범칙금|과징금)(?:\s*(?:부과|납부|징수|처리))?\s*담당(?:자|부서|팀|관)?)\s*(?:(?:[을를]\s*)?(?:자처|사칭)|이?라(?:면서|며|고)(?=$|\s|요|했|하|해))/u;
const levyReceiver = /(?:제게|저에게|저한테|내게|나에게|나한테|수신자(?:에게|한테)|받은\s*사람(?:에게|한테))/u;
const requestedLevyInstall = new RegExp(
  "(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를|이|가)?\\s*" +
    "(?:" + onRecipientDevice.source + "\\s*)?(?:(?:따로|먼저|별도(?:로)?|추가(?:로)?|새로)\\s*)?" +
    "설치(?:하(?:라(?:고|는)?|래|도록|여야)|해야|해\\s*달라|\\s*(?:요구|요청|지시))", "gu");
const beforeInstallationRecipient = /(?:^|[\s,，])(?<party>받(?:은|는)\s*사람|받은\s*이|[\p{L}\p{N}]{1,16})(?:에게|한테)(?:만|는|도)?\s*$/u;
const afterInstallationRecipient = /^\s*(?:지시|요구|요청|부탁|안내)(?:을|를|은|는|이|가|도)?\s*(?:[\p{L}\p{N}]{1,12}\s+){0,2}(?<party>받(?:은|는)\s*사람|받은\s*이|[\p{L}\p{N}]{1,16})(?:에게|한테)(?:만|는|도)?(?=$|\s)/u;
const levyReportRecipient = /^(?:저|나|수신자|받(?:은|는)\s*사람|받은\s*이)$/u;

// 수신자가 옮겨 적은 자칭 기관·담당자와 동일 연락의 행동을 연결한다.
const declaredSender = new RegExp(
  "(?<role>" + senderRole + ")(?:\\s*(?:팀|직원|담당자|창구|사람|부서))?\\s*(?:[을를]\\s*자처|(?:이?라고|라는|이라며)[^,.!?\\n]{0,26}(?:발신(?:자|처)|보낸\\s*사람))", "u");
const senderConversation = /(?:발신처|발신자|보낸\s*사람)(?:와|과|에게|한테|가|는)?(?:의)?\s*(?:그|현재|같은|이|해당)?\s*(?:대화(?:창|방)?|채팅(?:창|방)?)(?:으로|로|에)/u;
const bypassesOfficialContact = /(?:대표\s*(?:전화|연락처|번호)|공식\s*(?:연락처|번호))(?:를|을|가|이)?\s*[^,.!?\n]{0,19}(?:대신|말고|아니라)\s*$/u;
const reportReplyChannel = /(?:답장|회신|(?:문자|메시지)\s*답변)(?:으로|로|에)/u;
const reportSource = /(?:그|해당|같은|이)\s*(?:발신처|발신자|보낸\s*곳|상대(?:방)?|문자|메시지|채팅|대화(?:창|방)?)|발신(?:처|자)(?:에게|한테|로|에|가|이)?\s*(?:직접|답장|회신|받겠)/u;
const sensitiveObject = /(?:신분증|주민\s*등록증|주민\s*등록\s*번호|여권\s*(?:사진|사본|번호)|(?:개인\s*)?신상\s*(?:자료|정보)|개인(?:의)?\s*(?:정보|자료|서류)|(?:카드|계좌|통장|현관)\s*(?:번호|비번|비밀번호|암호))/u;
const handIn = /(?:보내|전송해?|제출해?|회신해?|첨부해?|붙여|넘겨|올려|내)\s*(?:달라|달래|야|라(?:고|는)|하라|하래|해야)|(?:같은|그|해당)\s*발신(?:처|자)[^,.!?\n]{0,14}받겠|발신(?:처|자)(?:가|는|이|은)?[^,.!?\n]{0,20}받겠/u;
const inspectOrRedact = /(?:분실|변경|수령|재발급|발급|갱신|첨부|제출)(?:했는지|\s*(?:여부|유무|날짜|이력))|(?:가리고|가려진|지운|가린|삭제한|제외한|뺀|마스킹|익명\s*처리|비식별)|개인\s*정보(?:는|가)?\s*(?:제외|삭제)|(?:공식\s*앱|자기\s*기기|본인\s*기기|영업점|창구)에서/u;
const appObject = /(?:별도(?:의)?|추가(?:로)?|외부(?:의)?|기존[^,.!?\n]{0,16}(?:없던|없는))\s*(?:앱|프로그램|어플|소프트웨어)(?:[을를이가])?.{0,18}?설치(?:가\s*)?(?:필요|필수|해야|하라|하래|하도록|안내|요구|요청)/u;
const appOnReceiver = /(?:수신자(?:의)?|제가|내가|받은\s*사람|(?:개인|제|내)\s*(?:기기|휴대\s*(?:폰|전화)|단말))|설치하라는\s*(?:요구|내용|대목|문자|메시지)/u;
const addressedInstallation = /(?:설치|프로그램\s*추가)(?:\s*(?:안|항목|절차))?[가이]?[^,.!?\n]{0,22}(?:수신자|받은\s*사람|제가|내가)(?:가|이|는)?[^,.!?\n]{0,20}(?:진행|담당|수행|하기로|하라는|해야|하는\s*(?:일|몫|역할))/u;
const objectTransition = /[,，;]\s*|(?:했고|했으며|하고|하면서|했지만|하지만|받고|봤고|됐고|되고)(?=\s)\s*/u;
const distinctObject = /(?:^|\s)(?<phrase>[가-힣]+(?:\s+[가-힣]+){0,3})[을를](?=\s|$)/gu;
const objectReference = /(?:(?:그|이|해당|같은|앞의)\s*(?:것|자료|정보|서류|사본|사진|파일|내용)|그것|이를|원본|사본|복사본)$/u;

function hasSeparateDeliveryObject(modifiers) {
  if (/(?:와|과)는?\s*(?:별개로|무관하게)/u.test(modifiers)) return true;
  const clauses = modifiers.split(objectTransition);
  if (clauses.length === 1) return false;
  return [...clauses.at(-1).matchAll(distinctObject)].some(({ groups }) => !objectReference.test(groups.phrase));
}

function hasReportedPrivateDelivery(body) {
  if ((!reportSource.test(body) && !senderConversation.test(body) && !reportReplyChannel.test(body)) || inspectOrRedact.test(body) ||
      separateSource.test(body) || noObligation.test(body)) return false;
  const value = sensitiveObject.exec(body);
  if (!value) return false;
  const end = value.index + value[0].length;
  const followup = body.slice(end, end + 48);
  const delivery = handIn.exec(followup);
  return delivery !== null && !reportedActionInquiry.test(followup.slice(delivery.index + delivery[0].length)) &&
    !hasSeparateDeliveryObject(followup.slice(0, delivery.index)) &&
    !/^(?:의|을|를|은|는)?\s*(?:직접\s*)?(?:조회|확인하고|확인한|확인용|발급|유무|여부|일정)/u.test(followup);
}

const staffApp = /(?:공식\s*(?:앱|스토어|마켓)|업무용|직원용|운영용|공용|버전\s*확인|설치된\s*(?:앱|어플|프로그램))|(?:직원|운영자)(?:만|이|가|는)\s*[^,.!?\n]{0,24}설치/u;
const reportedNumber = /(?:문자|메시지|통지|문서|알림|안내문?|본문)(?:에|\s*속)(?:\s*(?:적힌|있는|기재된|나온|들어\s*있는|실린|표시된))?\s*(?:전화\s*)?(?:번호|연락처)(?:로|으로|에)(?:만)?\s*(?:별도\s*(?:로|의)?\s*)?(?:통화|전화)(?:를|을)?\s*(?:하라|하래|해야|해\s*달라|걸어야)/u;
const fromReceiver = /(?:제게서|저에게서|저한테서|내게서|나에게서|수신자(?:에게서|한테서|의)|(?:제가|내가|수신자가)\s*[^,.!?\n]{0,22}(?:현금|현찰))/u;
const mobileCollector = /(?:방문|찾아[오와가]|댁(?:에|으로)|집(?:에|으로)|자택(?:에|으로))/u;
const activeCash = /(?:현금|현찰)(?:[을를은는이가]|으로)?[^,.!?\n]{0,44}(?:받아\s*간|받겠|받으러|가지러|가져\s*간|수거|넘겨|건네|인계|징수|회수|찾아[오와가])|(?:받|가지|수거)으?러\s*[^,.!?\n]{0,18}(?:현금|현찰)/u;
const endedOrDeniedVisit = /(?:수거|징수|회수|방문|인계)(?:는|은|을|를|가|이)?\s*(?:없다|아니다|취소|철회|하지\s*않)|(?:약정|회신)(?:서|만)|모의|가상/u;
const relativeRepayment = /(?:대출(?:금)?\s*)?상환(?:금|액|을|은|하는|할|과|\s*(?:받|수거|회수))|(?:대출|금융)\s*상담[^,.!?\n]{0,16}(?:갚|상환)/u;
const removedTransfer = /(?:분실물|습득물|유실물|돌려받|반환|보관함|연습|보증금|예치금|영수증|기록만)/u;

const hasLevyIssuer = clause => levyReceiver.test(clause) && levyOfficer.test(clause);

function hasReportedLevyDispatch(clause) {
  const service = reportedLevyDispatch.exec(clause)?.groups.service;
  return Boolean(service && isCardSenderService(service));
}

function directsInstallationToLevyRecipient(notice, requiresDesignatedApp = false) {
  if (staffApp.test(notice) || startsOtherOrganizer(notice)) return false;
  for (const action of notice.matchAll(requestedLevyInstall)) {
    const before = notice.slice(0, action.index);
    const after = notice.slice(action.index + action[0].length);
    if (requiresDesignatedApp && (noObligation.test(notice) || reportedActionInquiry.test(after) ||
        !sourceSelectedApp.test(before) || !onRecipientDevice.test(action[0]))) continue;
    const recipient = beforeInstallationRecipient.exec(before) ?? afterInstallationRecipient.exec(after);
    if (!recipient || levyReportRecipient.test(recipient.groups.party)) return true;
  }
  return false;
}

function addLevyInstallation(text, signals) {
  const claimsLevyRole = clause => hasLevyIssuer(clause) || hasReportedLevyDispatch(clause);
  const asksInstallation = clause => directsInstallationToLevyRecipient(clause, true);
  for (const { body, previous, next } of currentReceivedRequests(text, claimsLevyRole, asksInstallation)) {
    const localIssuer = claimsLevyRole(body);
    if (!localIssuer && (!claimsLevyRole(previous) || declaredSender.test(body) || roleInReport.test(body))) continue;
    const issuerClause = localIssuer ? body : previous;
    const installation = hasOpenInstallationReport(body, next, notice =>
      directsInstallationToLevyRecipient(notice, !hasLevyIssuer(issuerClause)));
    if (!installation) continue;
    signals.add(SIG_AGENCY_IMPERSONATION);
    signals.add(SIG_APP_INSTALL);
  }
}

function addReceivedInstitutionRequests(text, signals) {
  for (const { body, previous, next } of currentReceivedRequests(text, clause => explicitServiceActor.test(clause),
      hasReportedPrivateDelivery)) {
    const serviceReply = reportReplyChannel.test(body) && hasReportedPrivateDelivery(body);
    const source = clause => declaredSender.exec(clause) ??
      (serviceReply ? explicitServiceActor.exec(clause) : null) ?? roleInReport.exec(clause);
    const localSender = source(body);
    const priorSender = source(previous);
    const attribution = localSender ?? priorSender;
    const name = attribution?.groups.role ?? attribution?.groups.named;
    const installation = hasOpenInstallationReport(body, next, notice =>
      !staffApp.test(notice) && (addressedInstallation.test(notice) || appObject.test(notice) && appOnReceiver.test(notice)));
    if (installation) signals.add(SIG_APP_INSTALL);

    const indirectCallback = reportedNumber.exec(body);
    if (indirectCallback && bypassesOfficialContact.test(body.slice(0, indirectCallback.index))) {
      if (name) signals.add(SIG_AGENCY_IMPERSONATION);
      signals.add(SIG_CALL_THIS_NUMBER);
    }
    if (!name) continue;

    if (installation) signals.add(SIG_AGENCY_IMPERSONATION);
    if (hasReportedPrivateDelivery(body)) {
      signals.add(SIG_AGENCY_IMPERSONATION);
      signals.add(SIG_PERSONAL_INFO);
    }
    const fromCustomer = /수신자|제게서|저한테서|제\s*자택/.test(body);
    if (/은행|금융\s*(?:기관|회사)/.test(name) && /직원|담당/.test(attribution[0] + " " + previous) &&
        relativeRepayment.test(body) && mobileCollector.test(body) && activeCash.test(body) &&
        fromCustomer && !endedOrDeniedVisit.test(body) && !removedTransfer.test(body)) {
      signals.add(SIG_LOAN_CASH_PICKUP);
    }
    if (!removedTransfer.test(body) && activeCash.test(body) && fromReceiver.test(body) && investigator.test(name)) {
      signals.add(SIG_CASH_HANDOVER);
    }
  }
}

export function addInstitutionRequestContext(text, signals) {
  addReceivedInstitutionRequests(text, signals);
  addLevyInstallation(text, signals);
  if (teachingOrWithdrawn.test(text)) return;
  const clauses = text.split(/[.!?。]+(?=\s|$)|[\r\n;]+|[,，]\s*(?=(?:한편|다른|별개|이와\s*별개))/u)
    .map(clause => clause.trim()).filter(Boolean);
  if (hasPaymentCallback(text, clauses)) signals.add(SIG_FOREIGN_PAYMENT_CALLBACK);
  for (const [index, clause] of clauses.entries()) {
    if (separateSource.test(clause) || noObligation.test(clause)) continue;
    const previous = clauses[index - 1] ?? "";
    if ((repayment.test(clause) || (!separateSource.test(previous) && repayment.test(previous))) && hasLoanCollection(clause)) {
      signals.add(SIG_LOAN_CASH_PICKUP);
    }
    const sender = senderIn(clause);
    if (!sender) continue;
    const next = clauses[index + 1];
    const actions = [clause.slice(sender.offset).trim()];
    if (next && !separateSource.test(next) && !startsOtherOrganizer(next) && !senderIn(next)) actions.push(next);
    for (const [offset, action] of actions.entries()) {
      if (noObligation.test(action)) continue;
      const reported = requestReport.test(action) || requestField.test(action) || softwarePrerequisite.test(action) || conditionField.test(action) ||
        /(?:통지|문자|안내|쪽지|답장|문서|회신)|[:：]/.test(clause);
      if (reported && hasPersonalRequest(action)) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(SIG_PERSONAL_INFO);
      }
      if (reported && hasOpenInstallationReport(action, clauses[index + offset + 1] ?? "", hasSoftwareRequest)) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(SIG_APP_INSTALL);
      }
      if (hasPrivateCallback(action)) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(SIG_CALL_THIS_NUMBER);
      }
      if (investigator.test(sender.name) && !recovery.test(clause + " " + action) && directHandover.test(action)) {
        signals.add(SIG_CASH_HANDOVER);
      }
    }
    if (investigator.test(sender.name) && next && cashField.test(next)) {
      const fields = clauses.slice(index + 1, index + 4);
      if (fields.length === 3 && fields.every(field => !separateSource.test(field) && !recovery.test(field)) &&
          assignedCollector.test(fields[1]) && inPersonHandover.test(fields[2])) signals.add(SIG_CASH_HANDOVER);
    }
  }
}
