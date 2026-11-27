import {
  SIG_APP_INSTALL, SIG_AVOID_VOICE, SIG_CREDENTIAL_DISCLOSURE, SIG_DELETE_APP, SIG_FAMILY_IMPERSONATION,
  SIG_GIFTCARD, SIG_ISOLATION, SIG_MONEY, SIG_NEW_NUMBER, SIG_PERSONAL_INFO,
  SIG_PREPAYMENT, SIG_SECRECY, SIG_THIRD_PARTY_ACCOUNT, SIG_URGENCY,
} from "./signals.js";
import { findLinks } from "./links.js";
import { hasAmountObjectAsk } from "./payment-request.js";
import { receivedFieldLines } from "./received-message.js";
import { identifiesReportedThirdPerson, reportedFamilyVoiceResponse } from "./reported-family.js";

const relation = "(?:(?:큰|작은|맏|막내|첫째|둘째|친|외|사촌|여|남)\\s*)?" +
  "(?:아들|딸|손자|손녀|손주|엄마|어머니|아빠|아버지|할머니|할아버지|할매|할배|동생|언니|오빠|형님|형|누나|누님|배우자|남편|아내|삼촌|숙모|이모|고모|조카|사촌|친척|자매|형제|막내)";
const role = "(?<![\\p{L}\\p{N}_])" + relation;
const source = "(?:발신자|발신인|보낸\\s*(?:이|사람)|보내는\\s*사람|작성자|(?:대화|채팅)\\s*상대)";
const contact = "(?:연락처|(?:전화\\s*|발신\\s*)?번호)";
const message = "(?:글|연락|문자|메시지|대화|채팅|쪽지|답장)";
const nameDisplay = "(?:뜨|떴|떠|표시|적혀|나타|나왔|나와)";
const gap = (length = 28) => `[^.!?…\\n]{0,${length}}?`;
const claim = new RegExp(
  `${role}이?(?:라(?:는데|더니|더군|길래|며(?:서)?|는\\s*(?:발신인|사람)|고\\s*(?:온|연락해\\s*온|적혀|쓰여|소개|자처))|란(?=\\s))`, "u",
);
const displayedName = `${role}(?:의)?\\s*이름(?:이|은|는)?`;
const display = new RegExp(
  `(?:${message}(?:\\s*(?:방|창|목록|화면|미리보기)){0,2}|${source}|화면|미리보기)(?:에는|에서는|에|에서|이|가|은|는)?\\s*` +
  `(?:${displayedName}|(?:(?:${source}(?:의)?\\s*)?이름(?:이|은|는)?\\s*)?${role}(?:으)?로)\\s*${nameDisplay}|` +
  `^${displayedName}\\s*${nameDisplay}`, "u",
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
const otherActor = /(?:^|[,，]\s*)(?:[\p{L}\p{N}·-]{1,12}\s+){0,4}(?:(?:담당자|상담원|판매자|직원|운영자|관리자|주최자|관계자)(?:가|이|은|는)\s|(?:단말기|키오스크|안내판|게시판)(?:에는|에서는|에|에서)\s)/u;
const recipientAsks = /(?:^|[\s,，])(?:제가|내가|수신자(?:가|는))\s*(?:(?!(?:발신자|그\s*사람|받(?:은|았|고)|전달받|읽은|전한))[^,，.!?\n]){0,28}(?:요구|요청|부탁)(?:해|했|합|하(?:였|고|며|더|네요|는))/u;
const illustrative = /(?:예방|교육)\s*(?:안내|자료|교육|강의|용)|(?:사기|피해|피싱)\s*사례|(?:낭독극|연극|역할극|대본|극본|시나리오)(?:에서|에는|\s*속)|(?:농담|장난)(?:으)?로|(?:가상|연습용)\s*(?:문장|문자|상황|예시)/u;
const closed = /(?:요구|요청|부탁)(?:이|가|을|를|은|는)?\s*(?:(?:한\s*적(?:이|은)?|전혀|이미)\s*)?(?:없|아니|철회|취소|거절)|(?:취소|철회|거절)(?:한|된)\s*(?:요구|요청|부탁)|(?:요구|요청|부탁)(?:하지\s*않|한\s*적(?:이|은)?\s*없)|(?:할|낼|지울)\s*필요(?:가|는)?\s*없/u;
const verified = /(?:실제|진짜)\s*(?:친족|가족)(?:임|이었|이\s*맞음)|(?:기존|원래|평소(?:에)?\s*쓰던)\s*(?:번호|연락처)로\s*(?:전화|통화|연락)[^.!?\n]{0,25}(?:본인|맞는지|확인했)/u;
const actionNegation = /(?:보내|부치|빌리|사|받|내|넘기|주|깔|지우|없애|공유하|제출하|전달하|설치하|납부하|연락하)지\s*(?:말|마|않)/u;
const requestField = /^(?:요청|요구|부탁)(?:한)?\s*(?:항목|대상|물품|내용)(?:\s*[:：=]\s*|[\t\u3000 ]+)|^받고\s*싶다(?:고\s*한|는)\s*(?:항목|대상|물품)(?:\s*[:：=]\s*|[\t\u3000 ]+)/u;
const documentaryField = /(?:연락|문자|쪽지|대화|메시지|선물\s*요청)[^.!?\n]{0,13}(?:기록|분류|보관|알림|미리보기|일부|요약)/u;
const recipientField = /^(?:수신자|받는\s*(?:이|사람)|받은\s*(?:이|사람)|부르는\s*말)(?: *[:：=]\s*|[\t\u3000 ]+)/u;

const requestNoun = "(?:요구|요청|부탁)(?=$|[\\s.,!?…]|하|한|해|했|받|이|가|을|를|은|는|과|와)";
const indirect = "(?:[으이]?라(?:고|는|며|네)|달(?:라고|라는|라며|라네|라대|래|랬))";
const objectEnding = "(?:을|를|은|는|이|가|만|도)?\\s*";
const recipient = "(?:(?:자기|자신|본인|발신자|그\\s*사람)(?:에게|한테)\\s*)?";
const modifier = "(?:(?:좀|먼저|대신|곧바로|하나|한\\s*개)\\s*){0,2}";
const actionEnding = `(?:${indirect}|(?:것(?:을|이)?\\s*)?${requestNoun})`;
// 목적어와 요구 동사 사이에는 조사, 방향, 짧은 수식만 허용한다.
const directed = (object, action, flags = "u") => new RegExp(
  `${object}${objectEnding}${recipient}${modifier}(?:${requestNoun}|(?:${action})\\s*${actionEnding}|${indirect})`, flags,
);
const money = "(?:송금|입금|이체|대납|납부|지급|지불|결제|돈|금전|현금|대금|금액|자금|비용|생활비)";
const gift = "(?:상품권|기프트\\s*카드|기프티콘|교환권|충전\\s*카드)(?:의)?(?:\\s*(?:번호|코드|핀))?";
const credential = "(?:(?:본인\\s*)?(?:인증|로그인|일회용)\\s*(?:번호|코드)|OTP)";
const privateInfo = `(?:주민\\s*(?:등록\\s*)?번호|신분증|(?:신분|신원)\\s*(?:확인|증명)\\s*(?:자료|서류|사진)|비공개\\s*(?:계정|로그인)\\s*정보|${credential})`;
const deviceApp = "(?:앱|어플(?:리케이션)?|프로그램)";
const paymentAsk = directed(money, "보내|옮겨|부쳐|빌려|마련해|보태|내|(?:납부|대납|지급|송금|입금|이체)(?:하|할|해)?");
const giftAsk = directed(gift, "보내|내놓|넘겨|사|(?:구매|구입|확보|전달)(?:하|할|해)?", "gu");
const voucherUse = "(?:모바일\\s*)?(?:상품권|기프트\\s*카드|금액권|충전권|교환권)(?:의)?\\s*" +
  "(?:(?:사용|교환|충전|등록)\\s*)?(?:사용\\s*값|코드|핀|PIN|번호|바코드)";
const toSender = "(?:(?:자기|자신|본인|그쪽|발신자|그\\s*사람)(?:에게|한테|에게로|으로|로)\\s*)?";
const voucherRelay = new RegExp(
  voucherUse + objectEnding + toSender + modifier +
  "(?:알려|보내|읽어|불러|넘겨|(?:전송|전달|공유)(?:하|해|할)?)\\s*" + actionEnding, "giu",
);
const voucherReportDenial = /(?:주|하|보내|알리|전하)(?:면\s*안|지\s*(?:말|마|않))|(?:번호|코드|핀)[^.!?]{0,18}(?:필요|요구)(?:가|는)?\s*없/iu;
const privateAsk = directed(privateInfo, "보내|알려|읽어|(?:공유|제시|제출|전달)(?:하|할|해)?");
const installAsk = new RegExp(
  `${deviceApp}${objectEnding}${modifier}(?:설치(?:하|할|해|를)?|깔아|내려받아|다운로드(?:하|할|해|를)?)\\s*${actionEnding}`, "u",
);
const familySupport = "(?:다른\\s*)?(?:가족|식구|친척|친구|지인|주변\\s*사람)";
const supportContact = `${familySupport}${gap(12)}(?:연락|상의|대화|의논)(?:을|를|까지|도)?\\s*(?:(?:다|모두)\\s*)?`;
const isolationVerb = "(?:끊|하지\\s*않|피하|차단하)";
const obligation = "(?:한다고|한다는|한다며|한대|하는\\s*(?:것이|게)\\s*(?:조건|전제|필수))";
const isolation = new RegExp(
  `${supportContact}${isolationVerb}(?:으?라(?:고|는|며)|(?:어야|아야|여야)\\s*${obligation})|` +
  `(?:요구|요청|부탁)(?:은|는|이)\\s*${gap(18)}${supportContact}${isolationVerb}는\\s*것(?:이었|입니|이래|이란|이라고)`, "u",
);
const riskAppRemoval = new RegExp(
  `(?:보호|보안|안전|백신)\\s*${deviceApp}${objectEnding}${modifier}(?:(?:제거|삭제)(?:하|할|해)?|지우|없애)\\s*${actionEnding}`, "u",
);
const fakeApp = /(?:가짜|악성|사칭|위조된|감염된)\s*(?:보호|보안|안전|백신)|(?:보호|보안|안전|백신)[^.!?\n]{0,12}(?:사칭|위조)/u;
const credentialOwner = "(?:내|제|수신(?:자(?:의)?)?)\\s*";
const ownerDevice = "(?:(?:전화기|휴대전화|휴대폰|핸드폰|폰|기기)(?:의|(?:에|에서)\\s*(?:온|뜬|도착한|표시된))?\\s*)?";
const disclosedCredential = new RegExp(
  `${credentialOwner}${ownerDevice}${credential}(?:${objectEnding}${recipient}${modifier}` +
  `(?:읽어|알려|불러(?:\\s*주)?|말해|구두로\\s*전달(?:하|할|해)?)\\s*${actionEnding}|` +
  `(?:의)?\\s*(?:낭독|구두\\s*전달)(?:을|를)?\\s*(?:발신자가\\s*)?${requestNoun})`, "iu",
);
const urgency = /(?:지금\s*)?당장|즉시|곧바로|서두르|독촉|재촉/u;
const urgentRequirement = /(?:이어야|여야|해야|아니면\s*안|조건|전제|재촉|독촉|달라|달랬|달래)/u;
const secrecy = /(?:비밀로\s*(?:해|하|남겨|두)|(?:알리|말하|공유하)지\s*(?:않|말)|숨기)(?=[가-힣\s]|$)/u;
const secrecyRequirement = /(?:조건|전제|달라|달랬|달래|라고|라는|요청|요구|부탁)/u;
const advancedPayment = /선입금|선납|먼저\s*(?:[가-힣]{1,6}(?:을|를)\s*)?(?:송금|입금|이체|납부|지급)/u;
const personAccount = /(?:발신자|작성자|보낸\s*(?:이|사람))(?:의)?\s*(?:[가-힣]{1,8}\s+){0,2}(?:친구|지인|동료|제\s*[3삼]자)(?:의)?\s*개인(?:\s*명의)?\s*(?:계좌|통장)/u;
const request = new RegExp(`${requestNoun}|${indirect}`, "u");
const giftObject = new RegExp(gift, "gu");
const absentObject = /^\s*(?:은|는|이|가)?\s*(?:해당\s*)?(?:없|미기재|불필요|제외)/u;
const displayProp = /(?:공연|연극|무대|전시|촬영)\s*소품(?:인|으로\s*쓰는)?\s*(?:모형|종이|인쇄(?:한|된))?\s*$|(?:모형|가짜|연습용)\s*$/u;

const familyClaim = /(?:가족|식구)(?:의)?\s*(?:구성원|일원)(?:을|임을)?\s*(?:자처|사칭)/u;
const speaker = /(?:발신자|발신인|연락처|번호|연락.{0,8}사람|대화.{0,8}사람)/u;
const reflexive = new RegExp(source + "(?:는|은|이|가)\\s*(?:자신|자기|본인)(?:을|이)?\\s*(?:(?:제|내|우리)\\s*)?" +
  relation + "이?라고\\s*(?:밝|했|소개|말)", "u");

const framedRoleLabel = new RegExp(role + "[’”'」』]?(?:\\s*(?:이야|야|이에요|예요|입니다|이?라고))?\\s*$", "u");
const framedSourceHead = new RegExp(
  "^(?:" + source + "|상대(?:방)?|문자(?:를)?\\s*(?:쓴|보낸)\\s*(?:사람|이))" +
  "(?:의|이|가|은|는)?\\s*[^,，.!?\\n]{0,16}(?:자기\\s*소개|소개|관계|정체|신분|역할|자칭|호칭|표시(?:\\s*이름)?)" +
  "[^,，.!?\\n]{0,8}$", "u",
);

const displayedRoleHead = /^(?:표시\s*(?:된\s*)?이름|표기된\s*이름|표시\s*호칭|(?:신분|정체|역할|관계|자칭)\s*(?:표기|표시|이름|소개))(?:(?:은|는|이|가))?\s*[:：=]?\s*[‘“'「『]?\s*$/u;
const unrelatedIdentityHead = /수신자|받는\s*사람|별명|추정|비유|흉내\s*예시|모르|아니|역할극|배역|연극/u;
const receivedSynopsis = /(?:받은|수신한)\s*(?:쪽지|연락|메시지|문자)|(?:연락|메시지|문자|쪽지|수신)[^.!?\n]{0,12}(?:기록|요약|정리|분류|검토)/u;
const familyMessageClaim = new RegExp("^" + role + "(?:의|이|가)?\\s*[^,，.!?\\n]{0,8}?" + message + "이?라고", "u");
const labeledSenderBoundary = new RegExp("^" + source + "(?:의)?\\s*(?:자기\\s*소개|소개|이름|관계|역할)?(?:은|는|이|가)?\\s*[:：=]", "u");
const contactChangeField = /(?:연락처|(?:전화|발신)\s*번호|^번호)(?:가|는|를)?\s*[:：]?\s*(?:(?:이전|기존|원래)(?:과|와)?\s*)?(?:전환|교체|변경|바뀜|바뀐|달라|다름|미등록|미저장)|(?:바꾼|교체한|전환한)\s*(?:발신\s*|전화\s*)?(?:번호|연락처)/u;
const unchangedContactField = /(?:번호|연락처)[^,.!?\n]{0,10}(?:전환|교체|변경|바뀐)(?:이|는|은|가)?\s*(?:없|아니|않)/u;

const pretendedFamilySource = new RegExp(
  "^(?:(?:제|내|우리|저희)\\s*)?" + role + "(?:인\\s*(?:척|양|듯)|인\\s*것처럼|(?:의)?\\s*(?:흉내|행세|사칭))", "u",
);

const reportedRecipient = "(?:수신(?:자|인)|받(?:은|는)\\s*(?:사람|쪽|이))";
const senderDisplayKinship = new RegExp(
  "(?:^|\\s)(?:발신(?:자|인)?|보낸\\s*(?:이|사람|쪽))(?:의)?\\s*" +
  "(?:(?:본인|자기|자신)\\s*)?(?:표시|표기|소개)(?:는|은|이|가)?\\s*[:：=]?\\s*[「『“\"']?" +
  reportedRecipient + "의\\s*" + role + "(?=$|[\\s\\p{P}]|이?라고)", "u",
);

const exampleReceiptHeading = /^(?:낭독극|연극|역할극|대본|극본|수업|교육|예방)\s*(?:자료|안내|연습|대본|예시)/u;

const receivedArtifact = new RegExp(
  message + "(?:가|이|를|을)?\\s*(?:왔|받|도착|들어왔|수신)|(?:받은|수신한|도착한)\\s*" + message, "u",
);
const selfClaimInReceipt = new RegExp(
  "(?:^|\\s)(?:본인|자신|자기)(?:은|는|이|가)\\s*(?:(?:제|내|우리)\\s*)?" +
  role + "(?:이야|야|이에요|예요|입니다|이고|인데|이라고|이라며)(?=[\\s\\p{P}]|$)", "u",
);
const disputedRole = /(?:본인|가족)(?:이|가)?\s*(?:아니|아닌|맞는지\s*모르)|(?:관계|발신자|친족)(?:이|가)?\s*(?:확인되지|불명확)/u;

function hasFramedFamilySource(clause, previous) {
  if (recipientField.test(clause) || closed.test(clause)) return false;
  if (receivedArtifact.test(clause) && selfClaimInReceipt.test(clause) && !disputedRole.test(clause) &&
      !exampleReceiptHeading.test(clause) && !exampleReceiptHeading.test(previous)) return true;
  if (senderDisplayKinship.test(clause) && !exampleReceiptHeading.test(clause) && !exampleReceiptHeading.test(previous)) return true;
  if ((familyMessageClaim.test(clause) || pretendedFamilySource.test(clause)) &&
      newContact.test(clause) && !/(?:아닌|아니라고|가족이\s*아니)/u.test(clause)) return true;
  const label = framedRoleLabel.exec(clause);
  if (!label) return false;
  const head = clause.slice(0, label.index);
  return !unrelatedIdentityHead.test(head) && framedSourceHead.test(head) ||
    displayedRoleHead.test(head) && receivedSynopsis.test(previous);
}

const reportedVerbField = /^(?<verb>전달|전송|제출|제시|첨부|입력|기입|공유|알림|회신|송금|이체|입금|구매|구입|설치|보내(?:기)?|넘겨(?:주기)?)\s*(?:을|를)?\s*(?:요청|요구|부탁)\s*[:：=]\s*/u;
const reportedVerbObject = /^(?<verb>보내|전해|전달해|부쳐|옮겨|넘겨|알려|불러|읽어|보여|내|사|구매해|제출해|설치해)\s*(?:달(?:라(?:고|는|며)?|랬|래)|라(?:고|는|며))\s*(?:(?:한|하는)\s*)?(?:것|건|항목|대상|물품|자료|내용)(?:은|는|이|가)?\s*[:：]?\s*/u;
const listedRecipient = /^(?:(?:이|그|해당|같은|새)\s*(?:번호|연락처|대화|문자|메시지)(?:에|로|으로)|(?:발신자|보낸\s*사람|자기|자신)(?:에게|한테))\s*/u;
const listedMoney = new RegExp("^(?:" + money + "|경비|잔금|소액|용돈|여윳돈)" + "(?=$|[\\s은는이가을를이])", "u");
const listedGift = new RegExp("^(?<prefix>(?:[\\p{L}\\p{N}]{1,10}\\s+){0,2}(?:[가-힣]{1,8})?)" + gift + "(?=$|[\\s은는이가을를이])", "u");
const listedPrivate = new RegExp("^(?:(?:수신자|받(?:은|는)\\s*사람|내|제)(?:의)?\\s*)?" + privateInfo + "(?=$|[\\s은는이가을를이])", "u");
const privateDocumentStatus = /^\s*(?:의|은|는|이|가)?\s*(?:발급|재발급|갱신|등록|분실|처리|제출|신청)(?:\s*(?:예정|여부|유무|일정|일자|날짜|이력)|했는지)/u;
const listedDeviceApp = new RegExp("^" + deviceApp + "(?=$|[\\s은는이가을를이])", "u");
const nonPaymentGiftLabel = /^(?:비(?:금전|상품권)|가짜|모형|종이|소품|장식용|연습용|예시)\s*/u;
const framedMoneyOnObject = new RegExp(
  "^(?:" + money + "|경비|잔금|소액|용돈|여윳돈)\\s*(?:을|를|은|는)?\\s*(?:보내|전해|부쳐|부치|옮겨|옮기|전달|전송|입금|이체|송금)(?:하|해|할)?\\s*" +
  "(?:달(?:라|래|랬)|라(?:고|는)|요청|요구|부탁)", "u",
);

const negativeFieldMark = /^[×✕✖✗✘⊗☒❌]/u;
const fieldDivider = /^(?:[\p{P}\p{S}]{1,3}\s+|[:：=]\s*)/u;
const fieldTransfer = /^(?:전달|전송|제출|제시|첨부|입력|기입|공유|알림|회신|보내|넘겨|전해|알려|불러|읽어|보여)/u;
const fieldPayment = /^(?:보내|전해|전달|부쳐|옮겨|넘겨|내|입금|이체|송금)/u;
const fieldPurchase = /^(?:사|구매|구입)/u;

function reportedFieldSignal(clause) {
  const field = reportedVerbField.exec(clause) ?? reportedVerbObject.exec(clause);
  if (!field) return null;
  const payload = clause.slice(field[0].length).trimStart();
  if (negativeFieldMark.test(payload)) return null;
  const value = payload.replace(fieldDivider, "").replace(listedRecipient, "").trimStart();
  const verb = field.groups.verb;
  if (verb.startsWith("설치")) return listedDeviceApp.test(value) ? SIG_APP_INSTALL : null;

  const voucher = listedGift.exec(value);
  if ((fieldTransfer.test(verb) || fieldPurchase.test(verb)) && voucher &&
      !nonPaymentGiftLabel.test(value) && !displayProp.test(voucher.groups.prefix) &&
      !absentObject.test(value.slice(voucher[0].length))) return SIG_GIFTCARD;
  if (fieldPayment.test(verb) && listedMoney.test(value)) return SIG_MONEY;
  const personal = listedPrivate.exec(value);
  if (fieldTransfer.test(verb) && personal && !privateDocumentStatus.test(value.slice(personal[0].length))) {
    return SIG_PERSONAL_INFO;
  }
  return null;
}

function isSource(clause) {
  return claim.test(clause) || display.test(clause) || senderField.test(clause) || caption.test(clause) ||
    reflexive.test(clause) || (speaker.test(clause) && familyClaim.test(clause));
}

function isOtherSource(clause) {
  return senderChange.test(clause) || otherNotice.test(clause) || otherActor.test(clause);
}

function hasActiveGiftObject(value, pattern) {
  return [...value.matchAll(pattern)].some(item =>
    !displayProp.test(value.slice(0, item.index)) &&
    !absentObject.test(value.slice(item.index + item[0].length)));
}

const directedInstallation = new RegExp(
  deviceApp + objectEnding + modifier +
  "(?:설치하|다운로드하|깔|내려받)(?:도록|게(?:끔)?)\\s*(?:지시|요청|요구|명령|유도|시키|시켰|했|하)", "u",
);
const installationAuthor = /^(?:발신(?:자|인)|상대(?:방)?|보낸\s*(?:사람|이)|그\s*사람)(?:가|이|는|은)\s*/u;
const reporter = "(?:수신자|받(?:은|는)\\s*(?:이|사람)|저|나)";
const phoneOrDevice = "(?:휴대전화|휴대폰|전화기|단말기|기기|폰)";
const installationRecipient = new RegExp(
  "(?:^|\\s)(?:" + reporter + "(?:에게|한테|를)\\s+|" +
  "(?:(?:수신자|받(?:은|는)\\s*(?:이|사람))(?:의)?\\s*|(?:제|내)\\s+)" +
  phoneOrDevice + "(?:에(?:다(?:가)?)?|으로)\\s+)", "gu",
);
const otherInstallationTarget = new RegExp(
  "(?:에게|한테)(?=\\s|$)|" + phoneOrDevice + "(?:에(?:다(?:가)?)?|으로)(?=\\s|$)", "u",
);
const installationNotDirected = /(?:지시|요청|요구|명령|유도|시키)(?:하지\s*않|한\s*적(?:은|이)?\s*없)|(?:않|아니)하도록|(?:했|했는지)(?:는|도)?\s*(?:불확실|확인되지\s*않)/u;

const installedProgramReceipt = new RegExp(
  "(?:설치|다운로드)(?:를|을)?\\s*(?:요구|요청|부탁|지시)(?:을|를)?\\s*받은\\s*(?:사람|쪽|이)(?:은|는|이|가)\\s*" +
  reportedRecipient + "(?:임|이고|이며|고|다|(?:으)?로)?\\s*[,，·;:/|]?\\s*(?:(?:그|해당|같은)\\s+)?" +
  deviceApp + "(?:의)?\\s*(?:주소|링크|이름|파일)(?=$|[\\s\\p{P}]|[을를이가은는])", "u",
);

const unrelatedProgramReference = /^(?:[을를이가은는]\s*)?(?:별개|별도|다른|예시|가상|연습용)(?=[\s\p{P}]|$)/u;

function hasProgramReceipt(clause) {
  const installation = installedProgramReceipt.exec(clause);
  return Boolean(installation && senderDisplayKinship.test(clause) &&
    !unrelatedProgramReference.test(clause.slice(installation.index + installation[0].length).trimStart()));
}

function hasBoundInstallation(clause) {
  const action = directedInstallation.exec(clause);
  if (!action || installationNotDirected.test(clause)) return false;
  const prefix = clause.slice(0, action.index);
  const [receiver] = prefix.matchAll(installationRecipient);
  return Boolean(receiver && (receiver.index === 0 || installationAuthor.test(prefix)) &&
    !otherInstallationTarget.test(prefix.replace(installationRecipient, " ")));
}

function requestsIn(context, fieldContext, numberMismatch, framed = false) {
  const found = new Set();
  for (const clause of context) {
    if (closed.test(clause) || recipientAsks.test(clause)) continue;
    const hasPositiveAction = !actionNegation.test(clause);
    const object = fieldContext ? requestField.exec(clause) : null;
    if (framed && hasPositiveAction) {
      const slot = reportedFieldSignal(clause);
      if (slot) found.add(slot);
      if (hasBoundInstallation(clause) || hasProgramReceipt(clause)) {
        found.add(SIG_APP_INSTALL);
      }
      if (framedMoneyOnObject.test(clause) || hasAmountObjectAsk(clause)) {
        found.add(SIG_MONEY);
      }
    }
    if (paymentAsk.test(clause) && hasPositiveAction || numberMismatch && hasAmountObjectAsk(clause)) found.add(SIG_MONEY);
    if ((hasPositiveAction && hasActiveGiftObject(clause, giftAsk)) ||
        (!voucherReportDenial.test(clause) && hasActiveGiftObject(clause, voucherRelay)) ||
        (object && hasActiveGiftObject(clause.slice(object[0].length), giftObject))) found.add(SIG_GIFTCARD);
    if (privateAsk.test(clause) && hasPositiveAction) found.add(SIG_PERSONAL_INFO);
    if (installAsk.test(clause) && hasPositiveAction) found.add(SIG_APP_INSTALL);

    if (isolation.test(clause)) found.add(SIG_ISOLATION);
    if (riskAppRemoval.test(clause) && !fakeApp.test(clause) && hasPositiveAction) found.add(SIG_DELETE_APP);
    if (disclosedCredential.test(clause) && hasPositiveAction) {
      found.add(SIG_CREDENTIAL_DISCLOSURE);
      found.add(SIG_PERSONAL_INFO);
    }
  }
  return found;
}

const normalizedField = /^(?<key>[^:：|]{1,30}):\s*(?<value>.+)$/u;
const tableSender = /^(?:발신(?:자|인|처)|보낸\s*(?:이|사람)|자칭)(?:의)?\s*(?:소개|주장|신분|관계|역할|표시|표기)?$|^(?:(?:발신\s*)?(?:관계|역할|신분)\s*(?:주장|표시|표기|소개)|(?:주장|표시|표기)(?:된|한)?\s*(?:관계|역할|신분))$/u;
const tableContact = /^(?:발신\s*)?(?:연락\s*(?:처|경로|수단)|(?:전화\s*)?번호)(?:의)?\s*(?:상태|변경|정보|상황|설명)?$|^발신\s*(?:경로|채널|번호|연락처)(?:\s*정보)?$/u;
const tableAction = /^(?:현재\s*)?(?:요구|요청|부탁|지시|회신\s*요청)(?:한)?\s*(?:한\s*일|사항|항목|내용|행위|행동)?$/u;
const structuredKinClaim = new RegExp(
  "(?:본인|자기|자신)(?:을|를|이|은)?\\s*[^,，.!?\\n]{0,12}" + role + "이?라(?:고|며|는)", "u",
);
const tablePersonalRequest = new RegExp(
  "(?:" + privateInfo + "|(?:신분|신상|신원)\\s*(?:확인\\s*)?(?:자료|정보|서류|사진|사본))" +
  "(?<modifiers>[^,，.!?\\n]{0,20}?)" +
  "(?:(?:전달|전송|제출|첨부|입력|회신|공유|보내|올리|넘기|제시|쓰|적으|전하|내)(?:하|해)?\\s*)" +
  "(?:[으이]?라(?:고|는|며)|달(?:라|라고|라는)|요청|지시|요구)", "u",
);
const privateRecordRequest = new RegExp(
  privateInfo + "(?:\\s*(?:사본|사진))?(?:가|이|는)?\\s*" +
  "(?:적힌|기재된|쓰인|담긴|포함된)\\s*(?:자료|정보|서류)(?:을|를)?\\s*달(?:라고|라는|라며|랬)", "u",
);
const tableInactive = /(?:기존|예전|이전|종료|보관)\s*(?:요청|안내|통지|기록)|(?:지시|요구|요청)(?:를|을)?\s*(?:철회|종료)|(?:할|낼)\s*필요\s*없|(?:날짜|일정|여부|유무|이력)만/u;

function tableBindsPrivateRequest(rows, heading) {
  if (illustrative.test(heading) || closed.test(heading) || tableInactive.test(heading) || rows.some(({ value }) =>
    illustrative.test(value) || closed.test(value) || verified.test(value))) return false;
  const actors = rows.filter(({ key }) => tableSender.test(key));
  const contacts = rows.filter(({ key }) => tableContact.test(key));
  const actions = rows.filter(({ key }) => tableAction.test(key));
  if (actors.length !== 1 || contacts.length !== 1 || actions.length !== 1) return false;
  const [actor] = actors;
  const [contactField] = contacts;
  const [action] = actions;
  const privateRequest = tablePersonalRequest.exec(action.value);
  const disclosure = Boolean(privateRequest && !privateDocumentStatus.test(privateRequest.groups.modifiers)) ||
    privateRecordRequest.test(action.value);
  return structuredKinClaim.test(actor.value) &&
    (newContact.test(contactField.value) || contactChangeField.test(contactField.value)) &&
    !sameContact.test(contactField.value) && !unchangedContactField.test(contactField.value) &&
    disclosure &&
    !tableInactive.test(action.value) && !isOtherSource(action.value) &&
    !recipientAsks.test(action.value) && !actionNegation.test(action.value);
}

function addTableFamilyDisclosure(text, signals) {
  if (!text.includes("|")) return;
  let heading = "";
  let previous = "";
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    if (!line.startsWith("|")) {
      previous = heading;
      heading = line;
      continue;
    }
    const start = index;
    while (lines[index + 1]?.trimStart().startsWith("|")) index++;
    // 연속한 표 줄만 공통 파서에 넘겨 평문 필드가 표의 데이터와 섞이지 않게 한다.
    const rows = [];
    for (const field of receivedFieldLines(lines.slice(start, index + 1).join("\n"))) {
      const parsed = normalizedField.exec(field);
      if (parsed) rows.push(parsed.groups);
      if (field) continue;
      if (tableBindsPrivateRequest(rows, previous + " " + heading)) {
        signals.add(SIG_FAMILY_IMPERSONATION);
        signals.add(SIG_NEW_NUMBER);
        signals.add(SIG_PERSONAL_INFO);
        return;
      }
      rows.length = 0;
    }
  }
}

// 주체, 관계를 붙이는 인용, 요청 목적물을 따로 읽어 접수 보고의 어순에 의존하지 않는다.
const reportSender = "(?:(?:(?:문자|메시지|쪽지|글)(?:을|를)?\\s*)?보낸\\s*(?:사람|이)|" +
  "(?:문자\\s*|쪽지\\s*)?발신(?:자|인)|(?:(?:대화|채팅)\\s*)?상대(?:방)?)";
const roleQuoted = "(?:(?:제|내|우리|저희)\\s*)?" + relation + "이?라(?:고|며|는)";
const reflexiveObject = "(?:자기|자신|본인|스스로)(?:을|를|이|가|은|는)?\\s*";
const claimPredicate = "(?:소개(?:했|하|한)|밝(?:혔|히|힌)|주장(?:했|하|한)|말(?:했|하|한)|(?:했|하|한))";
const receiptPossessor = "(?:(?:받은|수신한)\\s*" + message + "(?:의)?\\s*)?";
const senderThenRole = new RegExp(
  "^" + receiptPossessor + reportSender + "(?:이|가|은|는)\\s*(?:" + reflexiveObject + ")?" +
  roleQuoted + "\\s*(?:" + reflexiveObject + ")?" + claimPredicate, "u",
);
const roleThenSender = new RegExp(
  "^(?:" + reflexiveObject + ")?" + roleQuoted + "\\s*(?:" + reflexiveObject + ")?" +
  "(?:소개한|밝힌|주장한|말한|했던|한)\\s*" + reportSender + "(?:가|이|은|는)\\s*", "u",
);
const conditionalOrQuotedRole = /^(?:다고|다는|다며|는지|냐고|느냐고|고\s*(?:가정|상상)|면|는\s*(?:경우|예시)|던\s*(?:기록|예시))/u;
const shiftedReport = /(?:^|[,，;]\s*)(?:한편|별도(?:로|의)?|그와\s*별개로|(?:다른|또\s*다른)\s*(?:발신자|번호|연락|사람|문자|기관)|(?:이전|예전|지난번|지난\s*(?:달|해|주))\s*(?:종료|완료|정리|보관|사건|기록|상담))/u;
const documentaryPast = /(?:지난(?:번|달|해|주)|이전|예전|보관)[^.!?\n]{0,12}(?:완료|종료|종결|폐기|백업|보관)|(?:가정|상상)(?:했|하)|(?:접수|발신|요청)한\s*적(?:은|이)?\s*없/u;
const payer = "(?:(?:제가|내가|저더러|나더러|수신자(?:가|에게|더러))\\s*)?";
const statedFee = "(?:등록|예약|수강|학원|교육|이용|대관|수리|진료|통신|교통|숙박|수업)(?:비|료)|수수료|요금|대금|비용|경비";
const askedToPay = new RegExp(
  "(?<![\\p{L}\\p{N}_])(?:" + statedFee + ")" + objectEnding + payer +
  "(?:(?:대신|먼저)\\s*)?(?:내|치러|납부해|결제해|지급해|부쳐|보내)\\s*(?:줄\\s*)?" +
  "수\\s*(?:있|없)(?:는지|을지|(?:겠)?느?냐고)\\s*[^,，.!?\\n]{0,14}(?:묻|물었|문의|질문)", "u",
);
const askerIsReporter = /(?:^|[,，;]\s*)(?:제가|내가|저는|나는|수신자(?:가|는))\s*[^.!?\n]{0,45}(?:물었|문의했|질문했|요청했)|(?:제가|내가|저는|나는|수신자(?:가|는))\s*(?:(?:따로|직접)\s*)?(?:(?:다른|별도의)\s*)?(?:사람|친구|회사|기관|담당자|창구|상대)(?:에게|에|한테)\s*(?:묻|물었|문의|질문|요청)/u;

const chatRoute = "(?:채팅|대화|메신저|연락)\\s*(?:주소|경로|계정|아이디)";
const announcedChatRoute = new RegExp(
  "(?:새(?:로운)?|바뀐|이전과\\s*다른|새로\\s*(?:쓰는|옮긴|만든))\\s*" + chatRoute +
  "[^,，.!?\\n]{0,44}(?:알려|적어|적었|표시|사용|쓴다|남겼|안내|옮겼|바꿨)|" +
  chatRoute + "(?:가|는|를)?\\s*(?:바꿨|바뀌|옮겼|변경했|전환했|교체했)", "u",
);
const incidentalChannel = /(?:기관|업체|학교|단체|상담|교육기관|행사)(?:의|에|에서|용|\s*자료)|(?:발신|연락|대화)\s*(?:경로|주소|계정)(?:의|은|는|이|가)?\s*(?:그대로|같아|바뀌지\s*않|변경(?:은|이)?\s*없)/u;
const recipientPrivateNeed = new RegExp(
  "(?:^|[\\s,，;])(?:제|내|수신자(?:의)?|받은\\s*사람의)\\s*" + privateInfo +
  "(?:\\s*(?:사본|사진|원본))?(?:이|가|을|를)?\\s*필요하(?:다는|다고|다며)\\s*" +
  "(?:(?:그런|그와\\s*같은)\\s*)?(?:말|요구|요청|했|하|적|밝)", "u",
);
const documentForOwnUse = /(?:직접|각자|본인(?:이|은|만)?)\s*(?:지참|보관|사용|확인)|(?:지참|보관|확인)할\s*(?:서류|자료|목록)|(?:사본|번호|사진)(?:을|를)?\s*(?:보내|넘기|알리|제출하|공유하)지\s*(?:않|말)|(?:말|뜻|요구)(?:이|은|는)?\s*아니/u;

function attributedSpeaker(clause) {
  const actor = senderThenRole.exec(clause) ?? roleThenSender.exec(clause);
  return actor && !conditionalOrQuotedRole.test(clause.slice(actor[0].length)) ? actor : null;
}

function mentionsChangedContact(clause) {
  // 주소 속 마침표는 보고의 절 경계가 아니므로 연락 경로를 읽을 때만 링크를 자리표시자로 바꾼다.
  const contactText = findLinks(clause).reduce((text, link) => text.replaceAll(link, "[주소]"), clause);
  return (newContact.test(contactText) || announcedChatRoute.test(contactText)) && !incidentalChannel.test(contactText);
}

function addAttributedFamilySignals(parts, signals) {
  const requested = requestsIn(parts, false, false);
  const changed = parts.some(mentionsChangedContact) &&
    !parts.some(part => sameContact.test(part) || unchangedContactField.test(part));
  const payment = requested.has(SIG_MONEY) || parts.some(part =>
    !actionNegation.test(part) && askedToPay.test(part));
  const privateRequest = requested.has(SIG_PERSONAL_INFO) || parts.some(part =>
    !documentForOwnUse.test(part) && recipientPrivateNeed.test(part));
  const giftRequest = requested.has(SIG_GIFTCARD);
  const appRequest = requested.has(SIG_APP_INSTALL);
  const pressure = payment && parts.some(part => urgency.test(part) && urgentRequirement.test(part));
  const secret = payment && parts.some(part => secrecy.test(part) && secrecyRequirement.test(part));
  const voice = parts.some(reportedFamilyVoiceResponse);
  if (!(giftRequest || voice || pressure || secret || changed && (payment || privateRequest || appRequest))) return;

  signals.add(SIG_FAMILY_IMPERSONATION);
  if (voice) signals.add(SIG_AVOID_VOICE);
  if (changed) signals.add(SIG_NEW_NUMBER);
  if (giftRequest) signals.add(SIG_GIFTCARD);
  if (payment && (changed || pressure || secret || voice)) signals.add(SIG_MONEY);
  if (privateRequest && changed) signals.add(SIG_PERSONAL_INFO);
  if (appRequest && changed) signals.add(SIG_APP_INSTALL);
  if (pressure) signals.add(SIG_URGENCY);
  if (secret) signals.add(SIG_SECRECY);
}

/** 발신자를 표시한 명사구·간접인용과 같은 연락의 현재 요구만 결합한다. */
export function addFamilyRequestContextSignals(text, signals, { numberMismatch = false } = {}) {
  addTableFamilyDisclosure(text, signals);
  const segments = text.split(/\.(?=\s|$)|(?<=\?)|[!。…\r\n]+/u)
    .map(text => text.trim()).filter(text => text.replace(/\?$/u, "").trim());
  const clauses = segments.map(segment => segment.replace(/\?$/u, "").trim());
  for (const [index, start] of clauses.entries()) {
    const previous = clauses[index - 1] ?? "";
    if (identifiesReportedThirdPerson(start) || illustrative.test(previous) || exampleReceiptHeading.test(previous)) continue;
    const actor = attributedSpeaker(start);
    if (actor && !segments[index].endsWith("?") && !documentaryPast.test(previous)) {
      const parts = [start.slice(actor[0].length).trimStart()];
      for (let offset = 1; offset <= 3 && index + offset < clauses.length; offset++) {
        const clause = clauses[index + offset];
        if (segments[index + offset].endsWith("?") || shiftedReport.test(clause) || isOtherSource(clause) || isSource(clause) || attributedSpeaker(clause)) break;
        parts.push(clause);
      }
      if (!parts.some(part => closed.test(part) || documentaryPast.test(part) || verified.test(part) ||
          illustrative.test(part) || shiftedReport.test(part) || isOtherSource(part))) {
        addAttributedFamilySignals(parts.filter(part => !askerIsReporter.test(part)), signals);
      }
    }
    const framed = hasFramedFamilySource(start, previous);
    if ((!isSource(start) && !framed) || isOtherSource(start) || illustrative.test(start)) continue;
    const context = [start];
    if (newContact.test(previous) && !isSource(previous) && !isOtherSource(previous) && !request.test(previous)) context.unshift(previous);
    for (const clause of clauses.slice(index + 1, index + 4)) {
      if (isOtherSource(clause) || isSource(clause) || framed && labeledSenderBoundary.test(clause)) break;
      context.push(clause);
    }
    if (context.some(clause => illustrative.test(clause) || verified.test(clause) || closed.test(clause))) continue;

    // 발신 표시와 거절은 같은 수신 보고 안에서만 대응시킨다.
    const followup = clauses[index + 1];
    if (context.includes(followup) && !segments[index].endsWith("?") &&
        reportedFamilyVoiceResponse(segments[index + 1])) {
      signals.add(SIG_FAMILY_IMPERSONATION);
      signals.add(SIG_AVOID_VOICE);
    }

    const heading = recipientField.test(previous) ? clauses[index - 2] ?? "" : previous;
    const fieldContext = senderField.test(start) && documentaryField.test(heading);
    const found = requestsIn(context, fieldContext, numberMismatch, framed);
    const changed = context.some(clause => newContact.test(clause) || framed && contactChangeField.test(clause)) &&
      !context.some(clause => sameContact.test(clause) || framed && unchangedContactField.test(clause));
    const pressure = found.has(SIG_MONEY) && context.some(clause => urgency.test(clause) && urgentRequirement.test(clause));
    const secret = found.has(SIG_MONEY) && context.some(clause => secrecy.test(clause) && secrecyRequirement.test(clause));
    if (found.has(SIG_MONEY)) {
      if (context.some(clause => advancedPayment.test(clause) && request.test(clause))) found.add(SIG_PREPAYMENT);
      if (context.some(clause => personAccount.test(clause))) found.add(SIG_THIRD_PARTY_ACCOUNT);
    }
    const highRiskRequest = [SIG_GIFTCARD, SIG_DELETE_APP, SIG_ISOLATION, SIG_CREDENTIAL_DISCLOSURE,
      SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT].some(signal => found.has(signal));
    if (!highRiskRequest && !pressure && !secret && !(changed && found.size) && !(numberMismatch && found.has(SIG_MONEY))) continue;

    signals.add(SIG_FAMILY_IMPERSONATION);
    if (changed) signals.add(SIG_NEW_NUMBER);
    if (pressure) signals.add(SIG_URGENCY);
    if (secret) signals.add(SIG_SECRECY);
    for (const signal of found) signals.add(signal);
  }
}
