/**
 * ① 코드로 신호 뽑기 (PRD 9-1 ①, 9-3, 9-4)
 *
 * extractCodeSignals(text, options?) → { signals: string[], domains: string[] }
 *
 * - 원문을 받는다(마스킹 전). 결과에는 원문을 담지 않는다.
 * - '요구' 표현만 잡는다. "보냈어", "출금", "결제 예정" 같은 알림·지난 일은 잡지 않는다.
 * - 코드는 놓쳐도 AI 신호와 합집합이 되므로, 오경보를 줄이는 쪽(정밀도)을 우선한다.
 *   키워드 정밀도는 평가 때 AI와 따로 잰다(PRD 15-2).
 * - domains: 평판 조회(F4-11)에 넘길 도메인 목록. 단축 URL 도메인은 넣지 않는다.
 *
 * options.senderLast4     : 부모님이 입력한 발신 번호 끝 4자리(F4-1, 선택)
 * options.shortUrlKeys    : 단축 주소 목록 키(시험용). 없으면 저장소 목록(content/phishing/kisa-short-urls.txt)
 * options.inputComplete   : 전체 입력을 받았는지. false면 공식 주소 예외를 켜지 않는다.
 * options.registeredLast4 : 사칭된 가족의 등록 번호 끝 4자리(P3에서 고른 뒤 알 수 있음)
 *   두 값이 모두 있고 다르면 SIG_NEW_NUMBER. 같아도 판정을 낮추지 않는다(발신번호 조작 가능).
 */
import { findLookalikes } from "./lookalike.js";
import {
  SIG_LINK, SIG_SHORT_URL, SIG_LOOKALIKE_DOMAIN, SIG_APP_INSTALL, SIG_MONEY,
  SIG_GIFTCARD, SIG_PERSONAL_INFO, SIG_NEW_NUMBER, SIG_AGENCY_IMPERSONATION, SIG_CALL_THIS_NUMBER,
  SIG_FAMILY_IMPERSONATION, SIG_AVOID_VOICE, SIG_SECRECY, SIG_ISOLATION, SIG_URGENCY, SIG_THIRD_PARTY_ACCOUNT, SIG_OFFICIAL_LINK,
  SIG_DECEPTIVE_URL, SIG_MALICIOUS_URL, SIG_CASH_HANDOVER, SIG_PREPAYMENT,
  SIG_CREDENTIAL_DISCLOSURE, SIG_DOCUMENT_BUNDLE, SIG_LOAN_CASH_PICKUP, SIG_FOREIGN_PAYMENT_CALLBACK,
} from "./signals.js";
import { findLinks, toDomain, isShortener } from "./links.js";
import { inspectLinkCandidates, linksForRiskChecks } from "./link-candidates.js";
import { allLinksOfficial, isOfficialLink } from "./official-links.js";
import { hasCardServiceRequest, hasVaccinationBooking } from "./card-sender.js";
import { classifyCallback } from "./callback-number.js";
import { hasSensitiveRequest, personalDisclosure } from "./personal-disclosure.js";
import { addReportedProtectedRequests, hasCredentialDisclosure, hasDocumentBundle } from "./protected-requests.js";
import { INVESTIGATIVE, hasInvestigativeCashHandover, hasLoanCashPickup } from "./cash-handover.js";
import { ACCOUNT_NUMBER, requestedPayments, requiresAdvancePayment } from "./payment-request.js";
import { reportedRequestSignals } from "./reported-requests.js";
import { addReportedContactRestrictions } from "./reported-contact-restrictions.js";
import { addReportedFamilySignals } from "./reported-family.js";
import { addFamilyRequestContextSignals } from "./family-request-context.js";
import { addReportedNoticeFields } from "./reported-notice-fields.js";
import { addInstitutionRequestContext } from "./institution-request-context.js";
import { createShortUrlMatcher, SHORT_URL_KEYS } from "./short-urls.js";

/** 기존 위험 신호 유지용. 공식 여부와 목적지 확인에는 별도의 전체 후보 파서를 쓴다. */
function hasUserinfo(link) {
  const authority = link.replace(/^(?:https?|ftp):\/\//i, "").split(/[/?#]/)[0];
  const at = authority.lastIndexOf("@");
  return at > 0 && at < authority.length - 1;
}

// 같은 문장 안(마침표·물음표·느낌표·줄바꿈 전)에서 최대 n글자 사이
const gap = (n) => `[^.!?\\n]{0,${n}}`;

// 요구 어미: 해 줘 / 해주세요 / 하세요 / 해라 / 부탁 / 바랍니다 / 좀
const ASK = "(?:해\\s*(?:줘|줄래|주세요|주실|주라|줄\\s*수)|하세요|해라|해\\s*달라|부탁|바랍니다|좀\\s*해)";
const AGENCY = '(?:대검찰청|검찰(?:청)?|경찰(?:청|서)?|지검|금융감독원|금감원|법원|수사관|수사팀|검사|국세청|세무서|관세청|보건소|출입국관리소)';
const PROTECTED_ACCOUNT = '(?:(?:국가\\s*)?안전(?:한)?\\s*계좌|보호\\s*계좌)';
const ACCOUNT_FIELD = '(?:계좌\\s*번호[ \\t]*[:：]?[ \\t]*)?' + ACCOUNT_NUMBER;
const LABELED_ACCOUNT = '(?:\\([ \\t]*' + ACCOUNT_FIELD + '(?:[ \\t]+예금주[ \\t]*[:：]?[ \\t]*[가-힣A-Za-z○●*]{1,16})?[ \\t]*\\)|' + ACCOUNT_FIELD + ')';
const NOT_PROHIBITION = '(?!\\s*(?:주)?(?:하)?지\\s*(?:마|않))';
const PHONE = '0\\d{1,2}[-\\s]?\\d{3,4}[-\\s]?\\d{4}';
const NOTICE = '(?:민원|전자|고객님|귀하|본인|대표\\s*(?:번호|연락처)|확인\\s*절차|환급|미환급|피해|고지|통지|송달|과태료|범칙금|신원|건강검진|예방접종|사건|수사|공문|알림|안내|압류|납부|지급|영장|출석|체포|구속)';

// 경찰청 메신저피싱 예방 자료의 가족 호칭·휴대폰 고장 수법.
// https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1007&q_bbscttSn=20211222092717359
const FAMILY_GREETING = /^\s*(?:엄마|아빠|어머니|아버지|할머니|할아버지|누나|누님|언니|형님|형|오빠|여보|자기야)(?=[\s,.!~]|$)[\s,.!~]*/;
const PHONE_DAMAGE = /(?:^\s*|(?:^|\s)(?:나|내|제)\s*)(?:(?:휴대폰|핸드폰|폰)(?:이|가)?\s*(?:액정(?:이)?\s*)?|액정(?:이)?\s*)(?:고장(?:이)?\s*(?:나서|났어|났는데)|깨(?:져서|졌어|졌는데))/;
const ALTERNATE_CONTACT = /번호(?:를|가)?\s*(?:바꿨어|바뀌었어|바뀌어서)|새\s*번호(?:야|예요|입니다)|(?:새\s*번호|임시\s*(?:번호|폰)|(?:빌린|친구)\s*(?:휴대폰|핸드폰|폰))(?:으로|로)\s*(?:문자|연락|메시지)(?:해|드려|한다)/;
const REPORTED_SPEECH = /[?‘“"'「]|(?:그때|지난번|예전에)|(?:다는|라는)\s*(?:말|문자|연락)|라고\s*(?:시작|말|하)|(?:었다|났다|다고)\s*(?:하더라|했)|(?:사칭|피싱)\s*(?:문자|예방|주의)|(?:하|되)?지\s*(?:마|말|않)/;
const SELF_RELATION = /^(?:(?:나|저)(?:는)?\s*)?(?:(?:큰|작은|막내)?(?:아들|딸)|손자|손녀|손주|동생)(?:인데|이야|야|이에요|예요|입니다)/;
const FIRST_PERSON = /^(?:나야|저예요|저에요|나|저)(?=[\s.,!~]|$)/;
const REPLACED_DEVICE = /(?:휴대폰|핸드폰|폰)(?:을)?\s*바꿨어/;
const OWN_OPENING = /^(?:(?:이거|이게|이건)\s*)?(?:나야|내다|나는|내가|제가|저는|저예요|저에요|접니다|나|저|내|제)(?=[\s,.!~ㅠㅜ]|$)/;
const OTHER_SUBJECT = /(?:친구|동생|언니|형|기사님|아이|직원)(?:는|은|가|이)\s+/;
const NEW_CONTACT = /새로\s*(?:받은|만든|개통한)\s*번호(?:예요|야|입니다|니까|인데|\s*저장)/;
const BORROWED = "(?:임시\\s*(?:번호|폰)|(?:빌린|친구|동생|지인|동료)\\s*(?:휴대폰|핸드폰|폰))";
const USING_BORROWED = new RegExp(BORROWED + "(?:으로|로)\\s*(?:문자(?:를)?\\s*)?(?:보냅니다|보낸다|보내요|보내)" +
  "(?!\\s*(?:줘|주|달|보라))(?=[\\s,.!~ㅠㅜ]|$)|" + BORROWED + "(?:이야|예요|입니다)[\\s.!~,]*이\\s*번호로");
const SAVE_CONTACT = /이\s*번호(?:를|로)?\s*저장(?:해|하세)/;
const OWN_DEVICE_EVENT = /(?:휴대폰|핸드폰|폰)(?:이|가|을)?\s*(?:떨어뜨려|떨어트려|잃어버려|물에\s*빠[져졌지]|배터리(?:가)?\s*(?:나가|방전))|새\s*(?:휴대폰|핸드폰|폰)\s*개통\s*(?:전이라|중이|하는데)/;
const ACTIVATING_ELSEWHERE = /새\s*(?:휴대폰|핸드폰|폰)\s*개통\s*(?:전이라|중이라)[^.!?\n]{0,16}이\s*번호로\s*(?:문자|보내)(?!\s*(?:주|줘|달))/;
const CONFIRMS_CALL = /^(?:방금|아까|조금\s*전(?:에)?)\s*(?:전화|통화)(?:드린|한)\s*(?:사람|거|건|게)?\s*(?:나|저)(?:야|예요|\s*맞(?:아|습니다))/;
const SENDING_FROM_LOANED_PHONE = /(?:친구|동료|지인|동생|옆\s*사람)\s*(?:휴대폰|핸드폰|폰)(?:을)?\s*빌(?:려(?:서)?|리가)\s*(?:(?:문자|메시지)(?:를)?\s*)?(?:보낸다|보내요?|보냅니다|연락(?:드려요|해요))(?!\s*(?:줘|주|달|보라))(?=[\s,.!~]|$)/;
const USING_OTHERS_DEVICE = /(?:친구|동료|지인|동생)\s*(?:꺼|거)(?:로|라)\s*(?:(?:문자|메시지)(?:를)?\s*)?보내(?:요)?(?!\s*(?:줘|주|달))(?=[\s,.!~]|$)/;
const CLOSED_NUMBER_ROUTE = /^이\s*번호로\s*(?:문자|연락)(?:해요?|주세요)[\s.!~,]*(?:원래|예전|전에\s*쓰던)\s*번호(?:는|가|를)?\s*해지(?:했|됐|되었)(?:어요?|습니다)(?=[\s.!~,]|$)/;
const LOANED_PHONE_NO_CALL = /^(?:지금(?:은)?\s*)?(?:전화|통화)(?:는|가|를|도)?\s*(?:빌린|남의|친구|동료|지인)\s*(?:휴대폰|핸드폰|폰|거|꺼)(?:이?라(?:서)?|여서)\s*(?:(?:못|몬)\s*받(?:는다|아요?|습니다)|받을\s*수(?:가)?\s*없(?:어요?|습니다))[\s.!~]*$/;

function senderStatement(opening) {
  if (!OWN_OPENING.test(opening)) return "";
  const contact = opening.split(/(?:근데|그런데|그나저나)/, 1)[0];
  const clauses = (contact.match(/[^.!?\n]+[.!?]?/g) ?? []).slice(0, 3);
  const stop = clauses.findIndex(clause => REPORTED_SPEECH.test(clause) || OTHER_SUBJECT.test(clause));
  return (stop < 0 ? clauses : clauses.slice(0, stop)).join(" ");
}

function addFamilySignals(input, signals) {
  const greeting = FAMILY_GREETING.exec(input);
  if (!greeting) return;
  const opening = input.slice(greeting[0].length, greeting[0].length + 100);
  const statement = senderStatement(opening);
  const ownDamage = Boolean(statement) && PHONE_DAMAGE.test(statement.replace(OWN_OPENING, "").trimStart());
  // 발신자가 다른 사람의 기기를 빌려 연락했다는 설명과, 그 기기로는 통화하지 못한다는 자기 진술이 모두 있어야 한다.
  const openingClauses = opening.match(/[^.!?\n]+[.!?]?/g) ?? [];
  const cutMidClause = input.length > greeting[0].length + opening.length && !/[.!?\n]$/.test(opening);
  const completeClauses = cutMidClause ? openingClauses.slice(0, -1) : openingClauses;
  if (SENDING_FROM_LOANED_PHONE.test(statement) &&
      completeClauses.some(clause => LOANED_PHONE_NO_CALL.test(clause.trim()))) {
    signals.add(SIG_FAMILY_IMPERSONATION);
    signals.add(SIG_AVOID_VOICE);
  }
  if (!/번호(?:는|가)?\s*(?:그대로|같아)/.test(opening) &&
      (NEW_CONTACT.test(statement) || USING_BORROWED.test(statement) || ACTIVATING_ELSEWHERE.test(statement) ||
       SENDING_FROM_LOANED_PHONE.test(statement) || (ownDamage && USING_OTHERS_DEVICE.test(statement)) || CLOSED_NUMBER_ROUTE.test(opening) ||
       (REPLACED_DEVICE.test(statement) && SAVE_CONTACT.test(statement)))) {
    signals.add(SIG_FAMILY_IMPERSONATION);
    signals.add(SIG_NEW_NUMBER);
  }
  const clauses = openingClauses.slice(0, 2);
  const first = clauses[0]?.trim() ?? "";
  if (ownDamage || OWN_DEVICE_EVENT.test(statement) || (CONFIRMS_CALL.test(first) &&
      !REPORTED_SPEECH.test(first) && !/라고\s*(?:적힌|쓰인)/.test(first))) signals.add(SIG_FAMILY_IMPERSONATION);
  if (!REPORTED_SPEECH.test(first) && SELF_RELATION.test(first)) signals.add(SIG_FAMILY_IMPERSONATION);
  const self = !REPORTED_SPEECH.test(first) && FIRST_PERSON.test(first);
  for (const clause of clauses) {
    if (REPORTED_SPEECH.test(clause)) continue;
    const changedContact = ALTERNATE_CONTACT.test(clause);
    const selfContact = self && (REPLACED_DEVICE.test(clause) || PATTERNS[SIG_AVOID_VOICE].some(re => re.test(clause)));
    if (changedContact || PHONE_DAMAGE.test(clause) || selfContact) signals.add(SIG_FAMILY_IMPERSONATION);
    if (changedContact) signals.add(SIG_NEW_NUMBER);
  }
}

const PATTERNS = {
  [SIG_AGENCY_IMPERSONATION]: [
    // A sender claim, not proof the sender is the real institution.
    new RegExp("^\\s*(?:\\[Web발신\\]\\s*)?\\[[가-힣]{0,12}" + INVESTIGATIVE + "[ \\t]+[가-힣0-9]{1,16}(?:과|부|팀)\\]", "i"),
    new RegExp(`${AGENCY}${gap(12)}(?:입니다|소속|담당|발신|통보)`),
    new RegExp(`(?:\\[|\\(|【)\\s*[가-힣]{0,12}${AGENCY}\\s*(?:\\]|\\)|】)`),
    // A leading institutional sender + formal notice topic; ordinary mentions are not claims.
    new RegExp(`^(?:\\s*\\[Web발신\\])?\\s*[가-힣]{0,12}${AGENCY}(?:에서)?\\s+${NOTICE}`, 'i'),
    new RegExp(`${AGENCY}에서\\s*(?:보낸|연락|알려|안내)`),
    /(?:귀하|본인|당신|고객님).{0,25}(?:사건\s*번호|계좌\s*동결|명의\s*도용)/,
    // 기관명으로 시작해 앱 설치·접속·입력을 요구(TEST-B077 유형). "홈페이지를 찾아 확인하세요" 같은 안내는 제외
    new RegExp(`^(?:\\s*\\[Web발신\\])?\\s*[가-힣]{0,12}${AGENCY}${gap(20)}(?:설치|접속|입력|제출)\\s*(?:해|하세요|하십시오|바랍|부탁)`, 'i'),
  ],
  [SIG_CALL_THIS_NUMBER]: [
    new RegExp(`(?:아래|위|이|해당|담당자)\\s*(?:전화\\s*)?(?:번호|연락처)${gap(20)}(?:전화|연락|회신)(?:해|하|주|\\s*바랍|\\s*부탁)${NOT_PROHIBITION}`),
    new RegExp(`${PHONE}(?:로|으로|에|를|을)?\\s*(?:(?:담당\\s*)?상담원?\\s*)?(?:(?:즉시|지금|바로|오늘\\s*중)\\s*)?(?:연결|전화|연락|문의|회신)\\s*(?:해|하|주|바랍|부탁|요망|[.!?]|$)${NOT_PROHIBITION}`),
    new RegExp(`(?:문의|상담|담당(?:자)?(?:\\s*(?:번호|연락처))?)\\s*:?\\s*${PHONE}(?:\\s*[.!?]|\\s*$)`),
    new RegExp(`(?:문의|상담)(?:는|은)?\\s*${PHONE}(?:로|으로)\\s*(?:부탁|연락|전화)${NOT_PROHIBITION}`),
    // 고지 끝에 번호만 남김(TEST-B065 유형): "…마지막 안내. 010-…"
    new RegExp(`(?:안내|통보|고지|통지|확인|연락\\s*바람)\\s*[.!]?\\s*${PHONE}\\s*[.!]?\\s*$`),
    new RegExp(`(?:임시|직통|담당자)\\s*(?:전화\\s*)?(?:번호|연락처)${gap(5)}${PHONE}${gap(5)}(?:이용|사용)\\s*(?:해|하|바랍|부탁)${NOT_PROHIBITION}`),
  ],
  [SIG_MONEY]: [
    // 송금해 줘, 입금 부탁, 이체하세요, 결제해 주세요
    new RegExp(`(?:송금|입금|이체|결제|계좌\\s*이체)\\s*(?:좀\\s*)?${ASK}`),
    // 돈 좀 보내 줘, 50만 원만 빌려줘, 돈 부쳐 줘
    new RegExp(`(?:돈|만\\s*원|천\\s*원|원만|금액)${gap(10)}(?:보내|부쳐|빌려|넣어)\\s*(?:줘|주세요|주라|줄래|줄\\s*수|달)`),
    new RegExp(`(?:송금|입금|이체|납부|결제)(?:을|를)?\\s*(?:진행|처리)?\\s*(?:해\\s*(?:주시|주셔|주십|주세요)|하시기|하십시오|하셔야|해야)`),
    new RegExp(`(?:돈|현금|금액|보증금|수수료|인증금)${gap(15)}(?:보내|옮겨|넣어|빌려)\\s*(?:주십시오|주시기|주세요|줘)`),
  ],
  [SIG_GIFTCARD]: [
    // 상품권 사서 사진 찍어 보내, 구글 기프트카드 구매해 줘
    new RegExp(`(?:상품권|기프트\\s*카드|기프티콘|플레이\\s*카드|구글\\s*카드)${gap(20)}(?:사\\s*(?:줘|서|다|와|주)|구매|결제|보내|찍어|핀\\s*번호)`),
    // 핀번호 보내 줘
    new RegExp(`핀\\s*번호${gap(10)}(?:보내|알려|찍어)`),
  ],
  [SIG_PERSONAL_INFO]: [
    new RegExp(
      `(?:인증\\s*번호|비밀\\s*번호|비번|주민\\s*(?:등록\\s*)?번호|신분증|보안\\s*카드|OTP|카드\\s*번호|계좌\\s*번호)` +
      `${gap(15)}(?:알려|보내|입력\\s*(?:해|하세요|부탁)|찍어|불러|말해)${NOT_PROHIBITION}`,
      "i",
    ),
    new RegExp(`(?:인증\\s*번호|비밀\\s*번호|주민등록증|신분증|보안\\s*카드|OTP|카드\\s*번호|계좌\\s*번호)${gap(20)}(?:제출|전송|회신|기재|등록)${NOT_PROHIBITION}`, 'i'),
  ],
  // 2026-11-12: 아래 압박 표현은 R13이 코드 신호만 보도록 하면서 추가(SUP-A03·SUP-D01). 정밀도 우선
  [SIG_AVOID_VOICE]: [
    // 전화는 못 받아 / 통화가 안 돼 / 통화 어려워 — "못 받아서 미안", "안 됐네" 같은 지난 일은 제외
    /(?:전화|통화)(?:는|가|를|도)?\s*(?:지금\s*)?(?:못\s*받(?:아|는다|아요)(?!서)|안\s*(?:돼|되)(?!었|서)|어려|힘들|곤란|불가)/,
    /(?:전화|통화)(?:는|를)?\s*하지\s*말고/,
    /문자로만/,
  ],
  [SIG_SECRECY]: [
    /(?:아빠|엄마|아버지|어머니|누나|언니|형|오빠|동생|가족|아무|누구)(?:한테|에게)(?:는|도)?\s*(?:절대\s*)?(?:말하지|얘기하지|알리지)\s*(?:마|말)/,
    /비밀로\s*(?:해|하|좀)/,
  ],
  [SIG_ISOLATION]: [
    /(?:다른\s*사람|아무|가족|은행\s*직원)(?:과|하고|에게|한테)(?:도|는)?\s*(?:연락|통화|상의)(?:를|도)?\s*하지\s*(?:마|말)/,
  ],
  [SIG_URGENCY]: [
    // 강한 재촉만: 급해·급하게·지금 당장·빨리 보내. "오늘 중 수령" 같은 정상 안내는 제외
    /급(?:해|하게|한데|함|합니다)/,
    /당장/,
    new RegExp(`(?:빨리|얼른|서둘러)${gap(10)}(?:보내|입금|송금|이체|부쳐|결제|해\\s*줘|해\\s*주세요)`),
    // 돈을 내거나 보내야 하는 기한 압박(SUP-A04 유형): "오늘까지 내야 돼", "내일까지 보내 줘야 해"
    new RegExp(`(?:오늘|내일|지금|이따)\\s*까지${gap(10)}(?:내야|보내\\s*(?:줘|야)|입금|송금|이체)`),
  ],
  [SIG_THIRD_PARTY_ACCOUNT]: [
    // 개인 계좌로 이체 요구(TEST-E198 유형). "개인 계좌 요구는 사기입니다" 같은 경고는 요구 어미가 없어 제외
    new RegExp(`개인\\s*(?:명의\\s*)?계좌${gap(25)}(?:이체|입금|송금|보내)\\s*(?:해\\s*(?:주|줘)|하세요|하십시오|바랍|부탁)${NOT_PROHIBITION}`),
    // D50: 수사기관 + ‘안전계좌·보호계좌’로 옮기라는 요구. 수사기관은 돈을 다른 계좌로 옮기라고 하지 않는다.
    // 기관 이름 뒤 80자 안에서 본다(문장이 나뉘어도 됨). 경고문(“요구하지 않습니다”, “사기입니다”)은 요구 어미가 없어 제외
    new RegExp(
      `${INVESTIGATIVE}[\\s\\S]{0,80}?${PROTECTED_ACCOUNT}${gap(15)}` +
      `(?:이체|입금|송금|옮기|옮겨|보내)\\s*(?:해\\s*(?:주|줘)|하세요|하십시오|바랍|부탁|주세요|셔야)${NOT_PROHIBITION}`,
    ),
    // D50 계좌 필드 뒤의 조사와 실제 요구를 연결한다. 임의의 설명·다음 문장까지 거리를 늘리지 않는다.
    new RegExp(INVESTIGATIVE + '[\\s\\S]{0,80}?' + PROTECTED_ACCOUNT + '[ \\t]*' + LABELED_ACCOUNT +
      '[ \\t]*(?:으로|로)[ \\t]*(?:(?:(?:금일|오늘|내일)[ \\t]*(?:중|까지)|즉시|바로)[ \\t]*)?' +
      '(?:이체|입금|송금|옮겨|보내)[ \\t]*(?:하시기[ \\t]*바랍니다|해[ \\t]*(?:주세요|줘)|하세요|하십시오|주세요|바랍니다)' +
      '(?![.!?…\\s]*[‘’“”"\\x27」])(?=[.!?…\\s]|$)'),
  ],
  [SIG_APP_INSTALL]: [
    new RegExp(
      `(?:앱|어플|애플리케이션|프로그램|팀뷰어|애니\\s*데스크|원격|보안\\s*프로그램)` +
      `${gap(15)}(?:설치\\s*(?:해|하세요|부탁|바랍|좀)|깔아|다운\\s*(?:받아|로드\\s*(?:해|하세요))|받아\\s*(?:줘|주세요|주시|봐))`,
    ),
  ],
};

/**
 * @param {string} text
 * @param {{ senderLast4?: string, registeredLast4?: string, inputComplete?: boolean, shortUrlKeys?: Set<string> }} [options]
 * @returns {{ signals: string[], domains: string[], localHealthClaim?: boolean, healthRoutingSignals?: string[] }}
 */
export function extractCodeSignals(text, options = {}) {
  const signals = new Set();
  const domains = new Set();
  const input = typeof text === "string" ? text : "";

  // 링크
  const inspection = inspectLinkCandidates(input, { inputComplete: options.inputComplete !== false });
  const links = linksForRiskChecks(findLinks(input), inspection);
  for (const link of links) {
    signals.add(SIG_LINK);
    const domain = toDomain(link);
    if (!domain) continue;
    if (isShortener(domain)) signals.add(SIG_SHORT_URL);
    else domains.add(domain);
    if (/\.apk(?:$|[?#])/i.test(link)) signals.add(SIG_APP_INSTALL); // 설치 파일 링크
    // https://공식주소@가짜주소: 브라우저는 @ 뒤로 간다. 앞부분으로 공식 주소인 척하는 속임수(D48)
    if (hasUserinfo(link)) signals.add(SIG_DECEPTIVE_URL);
  }
  // 전체 구문이 확인된 목적지를 기존 검사 입력에 보강한다. 이전 도메인은 삭제하지 않는다.
  for (const candidate of inspection.candidates) {
    if (candidate.complete && candidate.host && !isShortener(candidate.host)) domains.add(candidate.host);
  }
  // KISA 목록에 있던 단축 주소와 그대로 같으면 목록 일치(D48 ①). 펼치지 않고 글자만 대조한다
  if (createShortUrlMatcher(options.shortUrlKeys ?? SHORT_URL_KEYS)(links)) signals.add(SIG_MALICIOUS_URL);
  // 링크가 모두 공식 주소면 R7(링크만으로 주의)에서 뺀다. 판정은 ‘확인 필요’에 머문다
  if (allLinksOfficial(inspection.candidates.map((c) => c.raw), { complete: inspection.complete })) signals.add(SIG_OFFICIAL_LINK);
  // 공식 주소를 흉내 낸 도메인(D40 ②). 단축 URL은 이름이 없으므로 대상 아님
  if (findLookalikes([...domains]).length) signals.add(SIG_LOOKALIKE_DOMAIN);

  // 요구 키워드
  for (const [signal, patterns] of Object.entries(PATTERNS)) {
    if (signal === SIG_CALL_THIS_NUMBER) continue;
    const found = signal === SIG_PERSONAL_INFO || signal === SIG_APP_INSTALL
      ? hasSensitiveRequest(input, patterns) : patterns.some(re => re.test(input));
    if (found) signals.add(signal);
  }

  const callback = classifyCallback(input, PATTERNS[SIG_CALL_THIS_NUMBER]);
  const payments = requestedPayments(input);
  if (requiresAdvancePayment(input)) signals.add(SIG_PREPAYMENT);
  if (payments.money) signals.add(SIG_MONEY);
  if (payments.gift) signals.add(SIG_GIFTCARD);
  if (payments.thirdPartyAccount) signals.add(SIG_THIRD_PARTY_ACCOUNT);
  if (hasInvestigativeCashHandover(input)) signals.add(SIG_CASH_HANDOVER);
  if (hasLoanCashPickup(input)) signals.add(SIG_LOAN_CASH_PICKUP);
  if (callback.foreignPayment) signals.add(SIG_FOREIGN_PAYMENT_CALLBACK);
  if (callback.signal) signals.add(SIG_CALL_THIS_NUMBER);
  const disclosure = personalDisclosure(input);
  if (disclosure.requested) signals.add(SIG_PERSONAL_INFO);
  const outside = inspection.candidates.filter(c => c.complete && !isOfficialLink(c.raw));
  const unverifiedLink = signals.has(SIG_LINK) && outside.length > 0;
  if (hasCredentialDisclosure(input, unverifiedLink)) signals.add(SIG_CREDENTIAL_DISCLOSURE);
  if (hasDocumentBundle(input, unverifiedLink)) signals.add(SIG_DOCUMENT_BUNDLE);
  const externalLink = unverifiedLink && outside.some(c => !isShortener(c.host));
  if ((unverifiedLink || callback.directed || disclosure.reply) && hasCardServiceRequest(input, {
    externalLink, unverifiedLink, directedCallback: callback.directed, personalReply: disclosure.reply,
    sensitiveRequest: signals.has(SIG_APP_INSTALL) || signals.has(SIG_PERSONAL_INFO),
  })) {
    signals.add(SIG_AGENCY_IMPERSONATION);
  }
  addFamilySignals(input, signals);
  const localHealthClaim = !signals.has(SIG_AGENCY_IMPERSONATION) && signals.has(SIG_SHORT_URL) &&
    hasVaccinationBooking(input, outside.filter(c => isShortener(c.host)).map(c => c.raw));
  if (localHealthClaim) signals.add(SIG_AGENCY_IMPERSONATION);

  // 끝 4자리 비교
  const { senderLast4, registeredLast4 } = options;
  const isLast4 = (v) => typeof v === "string" && /^\d{4}$/.test(v);
  if (isLast4(senderLast4) && isLast4(registeredLast4) && senderLast4 !== registeredLast4) {
    signals.add(SIG_NEW_NUMBER);
  }

  const directSignals = [...signals];
  if (options.inputComplete !== false) addReportedContactRestrictions(input, signals);
  addReportedProtectedRequests(input, signals, unverifiedLink);
  for (const signal of reportedRequestSignals(input)) signals.add(signal);
  addReportedFamilySignals(input, signals);
  addFamilyRequestContextSignals(input, signals);
  addReportedNoticeFields(input, signals, { unverifiedLinks: outside.map(candidate => candidate.raw) });
  addInstitutionRequestContext(input, signals);
  return {
    signals: [...signals], domains: [...domains], ...(localHealthClaim && { localHealthClaim }),
    // 수신자가 옮겨 적은 요구는 로컬 판정에만 보탠다. 기존 건강정보 전송 판단에는 직접 검출한 신호를 사용한다.
    ...(directSignals.length !== signals.size && { healthRoutingSignals: directSignals }),
  };
}
