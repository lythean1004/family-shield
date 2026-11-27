import {
  SIG_APP_INSTALL, SIG_AVOID_VOICE, SIG_FAMILY_IMPERSONATION, SIG_GIFTCARD,
  SIG_MONEY, SIG_NEW_NUMBER, SIG_PERSONAL_INFO, SIG_SECRECY, SIG_URGENCY,
} from "./signals.js";

const RELATION = "(?:(?:큰|작은|맏|막내|첫째|둘째|친|사촌)\\s*(?:아들|딸|동생|오빠|누나|언니|형님|형)|(?:외|친)\\s*(?:손자|손녀|손주)|아들|딸|손자|손녀|손주|자녀|아이|막내|어머니|어머님|엄마|어무이|아버지|아버님|아빠|아부지|부모님|할머니|할아버지|할매|할배|오빠|오라버니|누나|누님|언니|형님|형아|형|동생|남편|아내|배우자|(?:외|친)?삼촌|숙모|이모|고모|조카|사촌|형제|자매|가족)";
// 친족 명사가 다른 단어 안의 글자와 일치하는 경우를 제외한다.
const CLAIMED_RELATION = `(?<![\\p{L}\\p{N}_])(?:우리\\s*)?${RELATION}[’”"'」』]?`;
const CLAUSE = /(?:[^.!?。…\r\n]|\.(?!\s|$))+(?:[.!?。…]|$)?/gu;
const REPORTED_CLAIM = new RegExp(
  `${CLAIMED_RELATION}(?:(?:이?라(?:고|는|며|면서)|인\\s*)` +
  `(?:[‘’“”"'」』]\\s*)?\\s*(?:스스로\\s*)?` +
  `(?:소개|주장|자처|밝|말|했|해|적|썼|쓴|보내|하더|하는|하네|하며|하면서|합니다|하고|한\\s*(?:뒤|다음|발신|사람)|연락|문자|메시지|발신|쪽지|사람)|` +
  `(?:이?래(?:요|서)|이?라(?:면서|며)(?=\\s)|을?\\s*자처|인\\s*척|\\s*행세))`,
  "gu",
);
const ROLE_SETTING = /(?:낭독극|연극|역할극|대본|극본|시나리오)(?:에서(?:는)?|\s*속(?:에서|의)?)[^,，.!?\n]{0,20}$/u;
const ROLE_ACTOR = /^(?:하(?:는|며|고|면서)|되는|한|된)?\s*(?:배역|등장인물|인물|주인공|역할)(?:[이가은는을를의도](?=\s|$)|[\s.!?]|$)/u;
const ATTRIBUTED_CLAIM = new RegExp(
  `${CLAIMED_RELATION}(?:이|가)\\s*(?:썼|적었|보냈|남겼|전했)(?:다는|다고\\s*한)[^.!?\\n]{0,12}?(?:쪽지|연락|메시지|문자|답장)|` +
  `${CLAIMED_RELATION}이?라고[^.!?\\n]{0,12}(?:새(?:로운)?|낯선|모르는|다른)\\s*(?:번호|연락처)[^.!?\\n]{0,10}(?:에서|발신|문자|연락)`,
  "u",
);
const RECORD_LABEL = new RegExp(
  `(?:논문|보고서|도감|분류표|기록)(?:에는|에서|에|은|는|이|가)[^.!?\\n]{0,26}?` +
  `(?:명칭|분류명?|용어|형태|종류|표기|제목)[^.!?\\n]{0,9}?${CLAIMED_RELATION}이?라(?:고|는)`,
  "u",
);
const SELF_CLAIM = new RegExp(
  `^(?:${RELATION}(?=[,，\\s])[,，\\s]+)?(?:나|저)(?:는)?\\s*${RELATION}` +
  `(?:이야|야|이에요|예요|입니다|인데)(?=[.!?…\\s,，~]|$)`,
  "u",
);
const SPURIOUS_REPORT = /(?:피해|사기|피싱)\s*(?:사례|예방|교육)|예방\s*(?:안내|자료|강의|교육)|교육\s*(?:자료|용)|(?:예시|가정|가상)\s*(?:문장|문자|상황|사례)|수업에서\s*(?:읽|배)|(?:사례|예시)(?:를|로)\s*(?:읽|소개|다뤘|배)|지난\s*(?:사건|사례|해|달|주|번)|(?:작년|재작년|예전)\s*(?:에|이야기)|(?:신고|사건\s*처리)(?:를)?\s*마쳤/u;
const CLOSED_REQUEST = /(?:요구|요청|부탁)(?:을|를|은|는|에)?\s*(?:이미\s*)?(?:거절(?:했|하고)|(?:취소|철회)(?:했|됐|되었))|(?:저는|제가|나는|내가)\s*(?:그\s*)?(?:거절했|응하지\s*않)/u;
const VERIFIED_FAMILY = /(?:본인|실제\s*가족)(?:임|이\s*맞는지|이었다는\s*것)(?:을|를)?\s*(?:직접\s*)?확인(?:했|했습니다)|(?:원래|평소(?:에)?\s*쓰던|기존)\s*(?:번호|연락처)로\s*(?:전화|통화|연락)(?:해(?:서)?|했)[^.!?\n]{0,24}확인(?:했|했습니다)/u;
const OTHER_ACTOR = new RegExp(
  `(?:^|\\s)(?:별도로|한편|그와\\s*별개로|화제를\\s*바꿔|이번엔\\s*다른|또\\s*다른\\s*(?:사람|발신자|번호|연락처)|` +
  `다른\\s*(?:사람|발신자|번호|연락처)(?:가|에서|의)|(?:이웃|지인|동료|친구|담당자|상담원|판매자|직원)(?:가|이|은|는)\\s|` +
  `(?:마트|매장|판매점|학교|회사|기관|도서관)에서\\s*(?:보낸|발송한|게시한|올린)|` +
  `(?:이웃|지인|동료|친구)(?:에게|한테)\\s*(?:왔|도착|발생|접근|보냈)|(?:실제|진짜|이미\\s*확인한)\\s*${RELATION}(?:이|가|은|는)\\s)`,
  "u",
);
const INSTITUTION_NOTICE = /^[\p{L}\p{N}·-]{0,18}(?:관|센터|실|장|점|원|팀|부서|학교|회사|기관)에서\s*(?:보낸|발송한|게시한|올린)\s*(?:공지|안내|문자|메시지|쪽지|답장)/u;
const DEVICE_NOTICE = /^(?:[\p{L}\p{N}·-]{1,18}\s*)?(?:단말기|키오스크|안내판|게시판)(?:에는|에서는|에|에서)\s*[^.!?\n]{0,80}(?:표시(?:됐|되|한|해)|게시(?:됐|되|한|해)|적혀)/u;
const DENIAL = /(?:한|했다는)\s*(?:적|일)(?:은|이|도)?\s*(?:없|아니)|(?:라|다)고\s*(?:한|했다는|요구한|요청한|부탁한)\s*(?:적(?:은|이)?\s*없|건\s*아니)|(?:라|다)는\s*(?:뜻|내용|요구|말)(?:이|은|는)?\s*아니|(?:요구|요청|부탁)(?:하지|한\s*적(?:이|은)?)\s*(?:않|없)|(?:할|해|했을)\s*필요(?:가|는)?\s*없/u;
const NEGATED_CONTACT = /(?:번호|연락처)(?:는|가)?\s*(?:그대로|같|바뀌지\s*않|바뀐\s*게\s*아니)|(?:바꾸|교체하)지\s*않/u;
const NEW_CONTACT = /(?:처음\s*(?:보는|쓰는)|낯선|모르는|새(?:로운|로\s*받은)?|임시|바뀐|다른|저장(?:되지\s*않은|한\s*적\s*없는))\s*(?:발신\s*|전화\s*)?(?:번호|연락처)|(?:번호|연락처)(?:가|를|는|도)?\s*(?:낯설|처음|바뀌|바꿨|바꿔서|변경했|변경됐|달라졌|저장되지\s*않)|(?:^|[/·|])\s*(?:발신\s*)?(?:번호|연락처)\s*변경(?=\s*[/·|:]|$)|(?:빌린|남의)\s*(?:휴대폰|핸드폰|기기|폰)/u;
const RECIPIENT_REFUSAL = /(?:저는|제가|나는|내가|수신자(?:는|가))[^.!?\n]{0,16}(?:거절|응하지\s*않)|거절(?:한|했던)\s*(?:적(?:이|은)?\s*없|건\s*아니)/u;
const VOICE = /(?:통화|전화|음성|목소리)/u;
const VERIFY = /(?:확인|본인|신원|진짜|목소리)/u;
const VOICE_REFUSAL = /거절(?:해|하|했)|(?:회피|피하|피했|피해)|(?:응하지|답하지)\s*않|(?:확인|전화|통화|답변)(?:을|를)?\s*(?:하지|해\s*주지)\s*않|(?:문자|채팅|메시지)(?:로|만|로만)\s*(?:하자고\s*)?(?:고집|강요)|(?:통화|전화|음성)(?:로|으로)?\s*(?:(?:신원|본인)\s*)?확인(?:은|을|하는\s*(?:것|건|일))?\s*(?:안\s*(?:하겠|돼|된)|하지\s*않겠다)/u;
const SECRET = /(?:비밀로\s*(?:해|하|남겨|두)|(?:알리지|말하지|얘기하지|전하지|공유하지)\s*(?:말|마)|(?:알리면|말하면|전하면)\s*안\s*된)(?:라는|다고|라고|달라|리라|\s*(?:요구|요청|부탁))|(?:알리|말하|전하|공유하)지\s*(?:않는|않을|말라는)\s*(?:것|걸)(?:을)?\s*(?:조건|전제)|숨기(?:라고|라는|래(?:요|서)|는\s*(?:(?:것|걸)(?:을)?\s*)?(?:조건|전제))/u;
const PRESSURE = /재촉(?:해|하|했|하며|한다|도)|(?:반복|거듭)\s*(?:독촉|재촉)|기다(?:려|릴)\s*(?:주지\s*않|수\s*없)/u;

const PROHIBITED_ACTION = /(?:(?:보내|부치|빌리|사|받|내|깔|넘기|주|공유하|제출하|작성하|전달하|결제하|구매하|송금하|입금하|이체하|설치하)지|(?:송금|입금|이체|결제|구매|설치|제출|공유)(?:은|는|을|를)?\s*하지)\s*(?:말|않)/u;
const RECIPIENT_REQUEST = /(?:^|[\s,，])(?:제가|내가|수신자가)\s*(?:(?!(?:발신자|그\s*사람|요구|요청|부탁|받(?:은|았|고)|보낸|읽은|전한))[^,，.!?\n]){0,26}(?:요구|요청|부탁)(?:하[가-힣]{0,3}|해[가-힣]{0,2}|했|합)$/u;
const REQUEST = "(?:요구|요청|부탁)(?:하(?:고|여|면서|는|며|더|니|네요|는데|기)|해(?:요|서|도)?|했|합|이|도|을|은|만|\\s*(?:내|문|메|쪽|부|했|있|뿐|사|이|담|적)|(?=[.!?\\s]|$))";
const ASK_ENDING = "(?:[으이]?라(?:고|는|며)|달(?:라(?:고|는|며)?|랬)|줘야\\s*(?:한|한다며))";
const PAYMENT = "(?:송금|입금|이체|결제|돈|금전|현금|비용|금액)";
const GIFT_ITEM = "(?:상품권|기프트\\s*카드|기프티콘|교환권|충전\\s*카드)";
const GIFT_CODE = "(?:의)?\\s*(?:번호|코드|핀)";
const GIFT = GIFT_ITEM + "(?:" + GIFT_CODE + ")?";
const GIFT_WITH_CODE = new RegExp("^" + GIFT_ITEM + GIFT_CODE, "u");
const PROP_GIFT = /(?:무대|연극|공연|촬영|연습|전시)\s*소품(?:인|으로\s*쓰는)?\s*(?:종이|모형|인쇄(?:한|된))?\s*$/u;
const PRIVATE = "(?:비공개\\s*(?:계정|로그인)\\s*(?:정보|자료)|민감\\s*정보|개인(?:의)?\\s*(?:정보|신분)|신상\\s*정보|신분증|신분(?:을|를)?\\s*(?:정보|자료|사진|증명|확인)|가족\\s*관계\\s*증명서|가족의\\s*(?:[가-힣]{1,8}\\s+){0,2}(?:서류|증명서)|(?:신원|신분|가족\\s*관계)(?:을|를|의)?\\s*(?:관련|확인|증명|입증)(?:용|을|를|할|하는)?\\s*(?:수\\s*있는\\s*)?서류|주민\\s*(?:등록\\s*)?(?:증|번호)|인증\\s*(?:코드|번호)|일회용\\s*(?:코드|비밀번호)|(?:카드|계좌)\\s*번호|비밀\\s*번호|OTP)";
const APPLICATION = "(?:앱|어플(?:리케이션)?|(?:원격|보안)\\s*프로그램)";
const INSTALL = "(?:설치|다운로드|내려받기)";
const REQUIREMENT = "[^.!?\\n]{0,14}?(?:조건|전제|필수)(?:라|이|에|입|인)";
const PAYMENT_DEADLINE = new RegExp(`${PAYMENT}[^.!?\\n]{0,12}?(?:오늘|내일|지금)[^.!?\\n]{0,12}?아니면\\s*안\\s*(?:된대|된다고|된다며)`, "u");

const REQUESTS = [
  [SIG_MONEY, requestPattern(PAYMENT, "(?:모아|보내|옮겨|부쳐|빌려|보태|내|내놓으|대납해|마련해|(?:결제|이체|입금|송금)해)")],
  [SIG_GIFTCARD, requestPattern(GIFT, "(?:사|구매해|결제해|보내|전달해|공유해|알려)")],
  [SIG_PERSONAL_INFO, requestPattern(PRIVATE, "(?:보내|보여|제출해|제시해|전달해|공유해|알려|적어|입력해|촬영해|넘겨)")],
  [SIG_APP_INSTALL, requestPattern(APPLICATION, "(?:설치해|깔아|설치하|내려받아|다운로드해)",
    { reported: `${INSTALL}\\s*(?:해야(?:만)?\\s*(?:한다(?:는|고)|한대|된대)|${REQUEST}|(?:하는\\s*(?:게|것)|하기가?)${REQUIREMENT})`, allowBare: false })],
];

function requestPattern(subject, verb, { reported = REQUEST, allowBare = true } = {}) {
  const bareRequest = "(?:을|를|이|가|은|는)?\\s*(?:(?:자기|자신|본인|그)(?:에게|한테)\\s*)?(?:(?:좀|먼저|바로|잠깐|대신|지금|당장|별도로)\\s*)?달(?:라고|라는|라며|랬)";
  const directedRequest = `${subject}[^.!?\\n]{0,22}?(?:${reported}|${verb}\\s*${ASK_ENDING})`;
  return new RegExp(allowBare ? `${directedRequest}|${subject}${bareRequest}` : directedRequest, "giu");
}

function describesRole(clause, match) {
  const start = match.index;
  const end = start + match[0].length;
  return ROLE_SETTING.test(clause.slice(0, start)) && ROLE_ACTOR.test(clause.slice(end));
}

function isClaim(clause) {
  if (DENIAL.test(clause) || RECORD_LABEL.test(clause) || clause.endsWith("?")) return false;
  if (ATTRIBUTED_CLAIM.test(clause) || SELF_CLAIM.test(clause)) return true;

  for (const match of clause.matchAll(REPORTED_CLAIM)) {
    if (!describesRole(clause, match)) return true;
  }
  return false;
}

function hasOtherSource(clause) {
  if (OTHER_ACTOR.test(clause) || INSTITUTION_NOTICE.test(clause) || DEVICE_NOTICE.test(clause)) return true;
  return [...clause.matchAll(REPORTED_CLAIM)].some(match => describesRole(clause, match));
}

function hasCurrentRequest(clause, signal, pattern) {
  for (const match of clause.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (PROHIBITED_ACTION.test(match[0]) || RECIPIENT_REQUEST.test(clause.slice(0, end))) continue;
    if (signal === SIG_GIFTCARD && !GIFT_WITH_CODE.test(match[0]) && PROP_GIFT.test(clause.slice(0, start))) continue;
    return true;
  }
  return false;
}

function hasVoiceRefusal(clause) {
  return VOICE.test(clause) && VERIFY.test(clause) && VOICE_REFUSAL.test(clause) &&
    !RECIPIENT_REFUSAL.test(clause);
}

/** 같은 연락에 묶인 가족 발신 주장과 현재 요구를 기존 판정 규칙에 전달한다. */
export function addReportedFamilySignals(text, signals) {
  if (typeof text !== "string" || SPURIOUS_REPORT.test(text)) return;
  const clauses = (text.match(CLAUSE) ?? []).map(clause => clause.trim()).filter(Boolean);
  for (let i = 0; i < clauses.length; i++) {
    const claim = clauses[i];
    if (!isClaim(claim) || OTHER_ACTOR.test(claim)) continue;

    // 직전 문장은 그 연락의 전화번호·연락처를 설명할 때만 포함한다.
    const preceding = clauses[i - 1] ?? "";
    const context = [claim];
    if (NEW_CONTACT.test(preceding) && !isClaim(preceding) && !hasOtherSource(preceding) &&
        !REQUESTS.some(([signal, pattern]) => hasCurrentRequest(preceding, signal, pattern))) context.unshift(preceding);
    for (const next of clauses.slice(i + 1, i + 4)) {
      if (hasOtherSource(next) || isClaim(next)) break;
      context.push(next);
    }
    if (context.some(clause => VERIFIED_FAMILY.test(clause) || (CLOSED_REQUEST.test(clause) && !hasVoiceRefusal(clause)))) continue;

    const active = context.filter(clause => !DENIAL.test(clause) && !clause.endsWith("?"));
    const newContact = active.some(clause => NEW_CONTACT.test(clause)) &&
      !active.some(clause => NEGATED_CONTACT.test(clause));
    const requested = new Set(REQUESTS.filter(([signal, pattern]) =>
      active.some(clause => hasCurrentRequest(clause, signal, pattern))).map(([signal]) => signal));
    if (active.some(clause => PAYMENT_DEADLINE.test(clause))) requested.add(SIG_MONEY);
    const voice = active.some(hasVoiceRefusal);
    const secret = requested.has(SIG_MONEY) && active.some(clause => SECRET.test(clause));
    const pressured = requested.has(SIG_MONEY) && active.some(clause => PRESSURE.test(clause));

    if (!voice && !requested.has(SIG_GIFTCARD) && !secret && !pressured && !(newContact && requested.size)) continue;
    signals.add(SIG_FAMILY_IMPERSONATION);
    if (newContact) signals.add(SIG_NEW_NUMBER);
    if (voice) signals.add(SIG_AVOID_VOICE);
    if (secret) signals.add(SIG_SECRECY);
    if (pressured) signals.add(SIG_URGENCY);
    for (const signal of requested) signals.add(signal);
  }
}
