import {
  SIG_APP_INSTALL, SIG_CREDENTIAL_DISCLOSURE, SIG_DELETE_APP, SIG_FAMILY_IMPERSONATION,
  SIG_GIFTCARD, SIG_ISOLATION, SIG_MONEY, SIG_NEW_NUMBER, SIG_PERSONAL_INFO,
  SIG_PREPAYMENT, SIG_SECRECY, SIG_THIRD_PARTY_ACCOUNT, SIG_URGENCY,
} from "./signals.js";

const relation = "(?:(?:큰|작은|맏|막내|첫째|둘째|친|외|사촌|여|남)\\s*)?" +
  "(?:아들|딸|손자|손녀|손주|엄마|어머니|아빠|아버지|할머니|할아버지|할매|할배|동생|언니|오빠|형님|형|누나|누님|배우자|남편|아내|삼촌|숙모|이모|고모|조카|사촌|친척|자매|형제|막내)";
const role = "(?<![\\p{L}\\p{N}_])" + relation;
const source = "(?:발신자|발신인|보낸\\s*(?:이|사람)|보내는\\s*사람|작성자|대화\\s*상대)";
const contact = "(?:연락처|(?:전화\\s*|발신\\s*)?번호)";
const message = "(?:글|연락|문자|메시지|대화|채팅|쪽지|답장)";
const nameDisplay = "(?:뜨|떴|떠|표시|적혀|나타|나왔|나와)";
const gap = (length = 28) => `[^.!?…\\n]{0,${length}}?`;
const claim = new RegExp(
  `${role}이?(?:라(?:는데|더니|더군|길래|며(?:서)?|는\\s*(?:발신인|사람)|고\\s*(?:온|연락해\\s*온|적혀|쓰여|소개|자처))|란(?=\\s))`, "u",
);
const display = new RegExp(
  `(?:${message}(?:방|창|목록)?|${source}|화면|미리보기)${gap(35)}(?:${role}(?:의)?\\s*이름|이름(?:이|은)?\\s*${role}(?:으)?로|${role}(?:으)?로)\\s*${nameDisplay}|` +
  `${role}(?:의)?\\s*이름(?:이|은)?\\s*${nameDisplay}`, "u",
);
const senderField = new RegExp(
  `^(?:${source}(?:\\s*(?:소개|역할|관계))?|보낸\\s*이\\s*소개)(?:은|는|이|가)?(?: *[:：=]\\s*|[\\t\\u3000 ]+)(?:[「『〈<【[]\\s*)?${relation}(?=$|[\\s」』〉>】\\]]|이?라(?:고|는|며)|(?:으)?로)`, "u",
);
const caption = new RegExp(`^(?:[〈《「『【[]\\s*)${relation}(?:\\s*[〉》」』】\\]]\\s*(?:미리보기|${message}|요약|일부|[·:：])|이?라고\\s*온\\s*${message})`, "u");
const newContact = new RegExp(
  `(?:새로운|새|처음\\s*(?:보는|쓰는)|모르는|낯선|임시|바뀐|다른|새로\\s*(?:받은|만든|개통한|쓰는|사용(?:하(?:는|게\\s*된)|\\s*중인)))\\s*${contact}|` +
  `${contact}(?:가|는|를)?\\s*(?:바뀌|바뀐|바꿨|변경됐|변경되었|변경했|달라졌)`, "u",
);
const sameContact = /(?:번호|연락처)(?:는|가)?\s*(?:그대로|바뀌지\s*않|바뀐\s*게\s*아니)/u;
const senderChange = /(?:^|[,，]\s*)(?:그와\s*별개로|한편|별도로|다른\s*(?:발신자|연락처|사람|번호)(?:가|에서|의)|(?:지인|친구|동료|이웃|담당자|상담원|판매자|직원)(?:가|이|은|는)\s|새로\s*(?:온|도착한)\s*(?:다른|별도의))/u;
const otherNotice = /^[\p{L}\p{N}·-]{1,22}에서\s*(?:보낸|발송한|게시한|올린)\s*(?:공지|안내|문자|메시지|쪽지|답장)/u;
const recipientAsks = /(?:^|[\s,，])(?:제가|내가|수신자(?:가|는))\s*(?:(?!(?:발신자|그\s*사람|받(?:은|았|고)|전달받|읽은|전한))[^,，.!?\n]){0,28}(?:요구|요청|부탁)(?:해|했|합|하(?:였|고|며|더|네요|는))/u;
const illustrative = /(?:예방|교육)\s*(?:안내|자료|교육|강의|용)|(?:사기|피해|피싱)\s*사례|(?:낭독극|연극|역할극|대본|극본|시나리오)(?:에서|에는|\s*속)|(?:농담|장난)(?:으)?로|(?:가상|연습용)\s*(?:문장|문자|상황|예시)/u;
const closed = /(?:요구|요청|부탁)(?:이|가|을|를|은|는)?\s*(?:(?:한\s*적(?:이|은)?|전혀|이미)\s*)?(?:없|아니|철회|취소|거절)|(?:취소|철회|거절)(?:한|된)\s*(?:요구|요청|부탁)|(?:요구|요청|부탁)(?:하지\s*않|한\s*적(?:이|은)?\s*없)|(?:할|낼|지울)\s*필요(?:가|는)?\s*없/u;
const verified = /(?:실제|진짜)\s*(?:친족|가족)(?:임|이었|이\s*맞음)|(?:기존|원래|평소(?:에)?\s*쓰던)\s*(?:번호|연락처)로\s*(?:전화|통화|연락)[^.!?\n]{0,25}(?:본인|맞는지|확인했)/u;
const actionNegation = /(?:보내|부치|빌리|사|받|내|넘기|주|깔|지우|없애|공유하|제출하|전달하|설치하|납부하|연락하)지\s*(?:말|마|않)/u;
const requestField = /^(?:요청|요구|부탁)(?:한)?\s*(?:항목|대상|물품|내용)(?:\s*[:：=]\s*|[\t\u3000 ]+)|^받고\s*싶다(?:고\s*한|는)\s*(?:항목|대상|물품)(?:\s*[:：=]\s*|[\t\u3000 ]+)/u;
const documentaryField = /(?:연락|문자|쪽지|대화|메시지|선물\s*요청)[^.!?\n]{0,13}(?:기록|분류|보관|알림|미리보기|일부|요약)/u;
const recipientField = /^(?:수신자|받는\s*(?:이|사람)|받은\s*(?:이|사람)|부르는\s*말)(?: *[:：=]\s*|[\t\u3000 ]+)/u;

const requestNoun = "(?:요구|요청|부탁)(?=$|[\\s.,!?…]|하|해|했|받|이|가|을|를|은|는|과|와)";
const indirect = "(?:[으이]?라(?:고|는|며|네)|달(?:라고|라는|라며|라네|라대|래|랬))";
const objectEnding = "(?:을|를|은|는|이|가|만|도)?\\s*";
const recipient = "(?:(?:자기|자신|본인|발신자|그\\s*사람)(?:에게|한테)\\s*)?";
const modifier = "(?:(?:좀|먼저|대신|곧바로|하나|한\\s*개)\\s*){0,2}";
const actionEnding = `(?:${indirect}|(?:것(?:을|이)?\\s*)?${requestNoun})`;
// 목적어와 요구 동사 사이에는 조사, 방향, 짧은 수식만 허용한다.
const directed = (object, action) => new RegExp(
  `${object}${objectEnding}${recipient}${modifier}(?:${requestNoun}|(?:${action})\\s*${actionEnding}|${indirect})`, "u",
);
const money = "(?:송금|입금|이체|대납|납부|지급|지불|결제|돈|금전|현금|대금|금액|자금|비용|생활비)";
const gift = "(?:상품권|기프트\\s*카드|기프티콘|교환권|충전\\s*카드)(?:의)?(?:\\s*(?:번호|코드|핀))?";
const privateInfo = "(?:주민\\s*(?:등록\\s*)?번호|신분증|(?:신분|신원)\\s*(?:확인|증명)\\s*(?:자료|서류|사진)|비공개\\s*(?:계정|로그인)\\s*정보|(?:인증|로그인|일회용)\\s*(?:번호|코드)|OTP)";
const deviceApp = "(?:앱|어플(?:리케이션)?|프로그램)";
const paymentAsk = directed(money, "보내|옮겨|부쳐|빌려|마련해|보태|내|(?:납부|대납|지급|송금|입금|이체)(?:하|할|해)?");
const giftAsk = directed(gift, "보내|내놓|넘겨|사|(?:구매|전달)(?:하|할|해)?");
const privateAsk = directed(privateInfo, "보내|알려|읽어|(?:공유|제시|제출|전달|입력)(?:하|할|해)?");
const installAsk = new RegExp(
  `${deviceApp}${objectEnding}${modifier}(?:설치(?:하|할|해)?|깔아|내려받아|다운로드(?:하|할|해)?)\\s*${actionEnding}`, "u",
);
const familySupport = "(?:다른\\s*)?(?:가족|식구|친척|친구|지인|주변\\s*사람)";
const isolationAction = "(?:연락|상의|대화|의논)(?:을|를|까지|도)?\\s*(?:(?:다|모두)\\s*)?" +
  "(?:끊(?:으?라(?:고|는|며)|어야|는\\s*것)|(?:하지\\s*않|피하|차단하)(?:으?라(?:고|는|며)|는\\s*것|아야|여야))";
const isolation = new RegExp(`${familySupport}${gap(12)}${isolationAction}`, "u");
const riskAppRemoval = new RegExp(
  `(?:보호|보안|안전|백신)\\s*${deviceApp}${objectEnding}${modifier}(?:(?:제거|삭제)(?:하|할|해)?|지우|없애)\\s*${actionEnding}`, "u",
);
const fakeApp = /(?:가짜|악성|사칭|위조된|감염된)\s*(?:보호|보안|안전|백신)|(?:보호|보안|안전|백신)[^.!?\n]{0,12}(?:사칭|위조)/u;
const credential = /(?:본인\s*)?(?:인증|로그인|일회용)\s*(?:번호|코드)|OTP/iu;
const recipientCredential = /(?:내|제|수신(?:자(?:의)?)?)\s*(?:전화기|휴대전화|휴대폰|핸드폰|폰|기기)|(?:내|제|수신(?:자(?:의)?)?)\s*(?:본인\s*)?(?:인증|로그인|일회용)\s*(?:번호|코드)/u;
const credentialDisclosure = /(?:(?:자기|자신|발신자|보낸\s*이|그\s*사람)(?:에게|한테)(?:는|도)?|(?:읽어|낭독|구두로\s*전달|불러\s*주))/u;
const urgency = /(?:지금\s*)?당장|즉시|곧바로|서두르|독촉|재촉/u;
const urgentRequirement = /(?:이어야|여야|해야|아니면\s*안|조건|전제|재촉|독촉|달라|달랬|달래)/u;
const secrecy = /(?:비밀로\s*(?:해|하|남겨|두)|(?:알리|말하|공유하)지\s*(?:않|말)|숨기)(?=[가-힣\s]|$)/u;
const secrecyRequirement = /(?:조건|전제|달라|달랬|달래|라고|라는|요청|요구|부탁)/u;
const advancedPayment = /선입금|선납|먼저\s*(?:[가-힣]{1,6}(?:을|를)\s*)?(?:송금|입금|이체|납부|지급)/u;
const personAccount = /(?:발신자|작성자|보낸\s*(?:이|사람))(?:의)?\s*(?:[가-힣]{1,8}\s+){0,2}(?:친구|지인|동료|제\s*[3삼]자)(?:의)?\s*개인(?:\s*명의)?\s*(?:계좌|통장)/u;
const request = new RegExp(`${requestNoun}|${indirect}`, "u");
const giftObject = new RegExp(gift, "u");

function isSource(clause) {
  return claim.test(clause) || display.test(clause) || senderField.test(clause) || caption.test(clause);
}

function isOtherSource(clause) {
  return senderChange.test(clause) || otherNotice.test(clause);
}

function requestsIn(context, fieldContext) {
  const found = new Set();
  for (const clause of context) {
    if (closed.test(clause) || recipientAsks.test(clause)) continue;
    const hasPositiveAction = !actionNegation.test(clause);
    const object = fieldContext ? requestField.exec(clause) : null;
    if (paymentAsk.test(clause) && hasPositiveAction) found.add(SIG_MONEY);
    if ((giftAsk.test(clause) && hasPositiveAction) ||
        (object && giftObject.test(clause.slice(object[0].length)))) found.add(SIG_GIFTCARD);
    if (privateAsk.test(clause) && hasPositiveAction) found.add(SIG_PERSONAL_INFO);
    if (installAsk.test(clause) && hasPositiveAction) found.add(SIG_APP_INSTALL);

    if (request.test(clause)) {
      if (isolation.test(clause)) found.add(SIG_ISOLATION);
      if (riskAppRemoval.test(clause) && !fakeApp.test(clause) && hasPositiveAction) found.add(SIG_DELETE_APP);
      if (credential.test(clause) && recipientCredential.test(clause) &&
          credentialDisclosure.test(clause) && hasPositiveAction) {
        found.add(SIG_CREDENTIAL_DISCLOSURE);
        found.add(SIG_PERSONAL_INFO);
      }
    }
  }
  return found;
}

/** 발신자를 표시한 명사구·간접인용과 같은 연락의 현재 요구만 결합한다. */
export function addFamilyRequestContextSignals(text, signals) {
  const clauses = text.split(/\.(?=\s|$)|[!?。…\r\n]+/u).map(clause => clause.trim()).filter(Boolean);
  for (const [index, start] of clauses.entries()) {
    if (!isSource(start) || isOtherSource(start) || illustrative.test(start)) continue;
    const previous = clauses[index - 1] ?? "";
    const context = [start];
    if (newContact.test(previous) && !isSource(previous) && !isOtherSource(previous) && !request.test(previous)) context.unshift(previous);
    for (const clause of clauses.slice(index + 1, index + 4)) {
      if (isOtherSource(clause) || isSource(clause)) break;
      context.push(clause);
    }
    if (context.some(clause => illustrative.test(clause) || verified.test(clause) || closed.test(clause))) continue;

    const heading = recipientField.test(previous) ? clauses[index - 2] ?? "" : previous;
    const fieldContext = senderField.test(start) && documentaryField.test(heading);
    const found = requestsIn(context, fieldContext);
    const changed = context.some(clause => newContact.test(clause)) && !context.some(clause => sameContact.test(clause));
    const pressure = found.has(SIG_MONEY) && context.some(clause => urgency.test(clause) && urgentRequirement.test(clause));
    const secret = found.has(SIG_MONEY) && context.some(clause => secrecy.test(clause) && secrecyRequirement.test(clause));
    if (found.has(SIG_MONEY)) {
      if (context.some(clause => advancedPayment.test(clause) && request.test(clause))) found.add(SIG_PREPAYMENT);
      if (context.some(clause => personAccount.test(clause))) found.add(SIG_THIRD_PARTY_ACCOUNT);
    }
    const highRiskRequest = [SIG_GIFTCARD, SIG_DELETE_APP, SIG_ISOLATION, SIG_CREDENTIAL_DISCLOSURE,
      SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT].some(signal => found.has(signal));
    if (!highRiskRequest && !pressure && !secret && !(changed && found.size)) continue;

    signals.add(SIG_FAMILY_IMPERSONATION);
    if (changed) signals.add(SIG_NEW_NUMBER);
    if (pressure) signals.add(SIG_URGENCY);
    if (secret) signals.add(SIG_SECRECY);
    for (const signal of found) signals.add(signal);
  }
}
