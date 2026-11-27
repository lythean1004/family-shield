import { INVESTIGATIVE } from "./cash-handover.js";
import { isCardCallbackNumber, isCardSenderName } from "./card-sender.js";
import { startsOtherOrganizer } from "./reported-notice-fields.js";
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

export function addInstitutionRequestContext(text, signals) {
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
    for (const action of actions) {
      if (noObligation.test(action)) continue;
      const reported = requestReport.test(action) || requestField.test(action) || softwarePrerequisite.test(action) || conditionField.test(action) ||
        /(?:통지|문자|안내|쪽지|답장|문서|회신)|[:：]/.test(clause);
      if (reported && hasPersonalRequest(action)) {
        signals.add(SIG_AGENCY_IMPERSONATION);
        signals.add(SIG_PERSONAL_INFO);
      }
      if (reported && hasSoftwareRequest(action)) {
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
