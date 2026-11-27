import { SIG_DELETE_APP, SIG_ISOLATION } from "./signals.js";

const TOKEN_START = "(?<![\\p{L}\\p{N}_])";
const particles = "(?:와의|과의|랑의|에게서|한테서|으로부터|에게|한테|에서는|에서|으로|로|까지|에게만|하고|이나|에|은|는|이|가|을|를|도|만|께|의|와|과|랑|뿐)";
const CLAUSE = /(?<=[.!?。…])\s+|[\r\n]+|(?<=[,，;；])\s*(?=(?:다만|별도로|반면|한편|그러나|그런데|별개로))/u;
const BREAK = /(?:이와|그와|이와는|그와는)\s*별개|그와\s*무관|(?:한편|별건|별도로\s*(?:받|왔|온|발송|게시))|(?:이웃|지인|동료|친구)(?:에게|한테|이|가)\s*(?:온|보낸|게시한|남긴)/u;
const TEACHING = /(?:피해|피싱|사기|사칭)\s*(?:피해\s*)?(?:사례|교육|예방|주의)|(?:예방|교육|가상|훈련|예시)\s*(?:용|안내|자료|문구|프로그램|수업|사례|강의|연습)|(?:연극|시나리오|대본|역할극|소품|배역)/u;
const PAST_OR_REJECTED = /(?:이미|앞서|이전에|지난번)\s*[^.!?]{0,24}(?:처리|거절|종료|철회|완료|반납|확인했|가려)|(?:요청|요구|안내|부탁)(?:을|를|이|가|은|는)?\s*(?:거절|철회|취소|없|아니)|(?:말|뜻|조건|필수|의무|예정)(?:이|가|은|는)?\s*(?:아니|없)|(?:말했|요구했|요구한|요청한|부탁한|말한)\s*(?:적|사실|기억|일)(?:이|은|도|는)?\s*없|(?:해당|같은)\s*(?:안내|문자)(?:를|이|가)?\s*(?:받은\s*적\s*없|폐기했)/u;
const DIRECTIVE = /(?:요구|요청|시키|강요|(?:하|어|아)라(?:고|는|며)|하(?:지\s*(?:말라는|말라고|말라며)|게\s*(?:했다|한다|하는|함))|(?:해|될|할)\s*수\s*없|(?:보내|첨부해|지워|삭제해|하지\s*말아)\s*달라|하지\s*않(?:게|도록)|하(?:게|도록)\s*(?:요구|요청|시켰))/u;
const FORCE = /(?:필수|요건|조건|전제|의무|(?:한|하)\s*뒤에만|오직|으로만|로만|만\s*(?:가능|처리|접수)|해야만|하기\s*전에는|(?:하지|하지\s*않으)면\s*(?:없|불가|중단|안\s*된)|(?:받|신청하|접수하|계속하|진행하)려면)/u;
const PROHIBITED = /(?:지\s*(?:말|마|않)|못\s*(?:하|해)|하지\s*않|하(?:지\s*않고|면\s*안\s*된)|금지|차단|중단|끊|금할|피하|피해야)/u;
const NOT_REQUEST = /(?:하(?:지\s*(?:말|마|않)|면\s*안)|(?:할|할\s*것일)\s*필요(?:가|는)?\s*없|선택\s*(?:사항|입력)|(?:권한|필수|의무)(?:가|이|은|는)?\s*아니|요구(?:는|가)?\s*없|(?:공유|제출|기재|설치|접속|전송)\s*금지)/u;
const ARTIFACT = /(?:문자|연락|답장|답신|회신|메시지|쪽지|통지|알림|고지|안내(?:문)?|공문|본문|발신|수신)/u;
const REPORTED = /(?:받(?:은|았|고|은\s*적)|왔(?:다|어|습|는|으며|대|어요)|(?:도착|수신|전달)(?:한|했|됐|되었)|(?:에서|명의로)\s*온|보낸|발송|내건|문자에는|문자에|연락에는|적(?:혀|힌|었)|써\s*있|표시|(?:라는|이라는|이라고|라고|라며)\s*(?:밝|적|써|표시|쓰|설명|했|한|첫|되어|끝|연락|답|통지|안내|문자|쪽지))/u;
const COMMAND_ENDING = "(?:으?라(?:고|는|며|는지)|으?래(?:요|서|도)?|아?(?:야|달라))";
const CUT_CONTACT = new RegExp("(?:끊|막|피하|금하|금지하|중단하|단절하|그만두|말)\\s*" + COMMAND_ENDING, "u");
const COMPELLED_STOP = /(?:끊(?:을|어야|는\s*(?:일|게|것))|단절|중단|연락하지\s*않(?:고|는))[^.!?]{0,18}(?:요구|강요|전제|조건|필수)|(?:끊어|중단해|그만둬)\s*(?:달라고|달라는|달라며)|(?:연락|상의|대화|통화)(?:하|해)(?:지\s*)?(?:말아\s*달라고|말라고|말라며|말라는|말래)/u;
const NARROW_CONTEXT = /(?:가해자|괴롭힘|스토킹|스팸|사칭범|낯선\s*(?:번호|사람)|의심\s*번호|제[삼3]자(?:의)?\s*(?:번호|연락처)|전화\s*번호\s*차단)|(?:공연|상영|관람|수업|회의|운전|촬영|시험|치료|교육)\s*(?:중|시간|장소|현장|진행\s*동안)|(?:제가|내가|수신자가)\s*(?:나중|잠깐|당분간)\s*(?:연락|통화|대화)/u;
const SELF_REQUEST = /(?:제가|내가|수신자가)\s*(?:먼저|직접|별도로)?\s*(?:요구|요청|부탁)(?:했|한|하고)|(?:제가|내가|수신자가)\s*먼저\s*했(?:다는|다고)|(?:제가|내가|수신자가)\s*먼저\s*(?:차단|삭제)/u;
const DEVICE_ADMIN = /(?:업무용|회사\s*지급|공용|시험용|실습용|전시용|구형|사내|공동)\s*(?:[가-힣]{1,8}\s*)?(?:기기|노트북|단말|프로그램|앱|컴퓨터)|(?:정기|기기|전산)\s*(?:정비|교체|관리|폐기)|교체\s*설치|(?:대여|임대|지급|지원)\s*(?:기기|단말기|컴퓨터)(?:의)?\s*반납|반납(?:\s*(?:기한|절차|점검)|을\s*위해)/u;
const OTHER_APPLICATION = /(?:위장|사칭|가짜|위조|악성|감염|체험|시험|테스트|설치\s*실패)/u;

const nounPattern = vocabulary => new RegExp(
  TOKEN_START + "(?:" + vocabulary + ")(?<particle>" + particles + ")?(?=[,，.;:!?…·/|\\s]|$)", "gu",
);
const verbPattern = vocabulary => new RegExp(TOKEN_START + "(?:" + vocabulary + ")", "gu");
const person = nounPattern("가족|주변\\s*(?:인물|사람|인맥)|가까운\\s*(?:이|이들|사람)|친척|친구|지인|동료|이웃|(?:평소\\s*)?(?:상의|의논|상담|연락)(?:하는|해\\s*오던|해\\s*온|하던)\\s*(?:사람|이들)|(?:다른|제삼자|제3자)\\s*(?:사람|인물|상담원|직원)?");
const protection = nounPattern("(?:휴대폰|기기|컴퓨터)?\\s*(?:백신|보호|보안|안전|악성코드\\s*검사|위험\\s*차단)\\s*(?:용\\s*)?(?:앱|프로그램|어플|소프트웨어)");
const communication = verbPattern("연락|말하|통화|의논|상의|상담|메시지|대화|알리|전하|소통");
const deletion = verbPattern("삭제|지우|지웠|지워|제거|없애");
const removalDirective = /^(?:(?:삭제|제거)(?:를?\s*(?:요청|요구)|해\s*달라|하(?:라|래|도록))|(?:지워|없애)\s*달라|(?:지우|없애)(?:라|래))/u;
const requiredRemoval = /^(?:(?:삭제|제거)(?:가|를|부터)?\s*(?:필수|조건|전제|요건|해야|하여야)|(?:삭제하|제거하|지우|없애)는\s*(?:게|것|일)|(?:지워|없애)야)/u;

function related(text, noun, verb, action, parts) {
  const objects = [...text.matchAll(noun)];
  const predicates = [...text.matchAll(verb)];
  return objects.some(object => predicates.some(predicate => {
    if (predicate.index <= object.index || predicate.index - object.index > 45) return false;
    if (parts && !parts.includes(object.groups.particle ?? "")) return false;
    const before = text.slice(Math.max(0, object.index - 15), object.index);
    const between = text.slice(object.index + object[0].length, predicate.index);
    const after = text.slice(predicate.index, predicate.index + 35);
    return action({before, between, after, object});
  }));
}

function mandatesIsolation(text) {
  if (SELF_REQUEST.test(text) || NARROW_CONTEXT.test(text)) return false;
  return related(text, person, communication, ({after, between, object}) => {
    if (/^(?:다른|제[삼3]자)/u.test(object[0]) ||
        /(?:녹음|영상|촬영|내용을\s*공개|번호를\s*차단|단지|일시적으로|잠깐|잠시)/u.test(between + after) ||
        /(?:으?라는|라고\s*한)\s*(?:뜻|말|내용|요구)(?:이|가|은|는)?\s*아니/u.test(after)) return false;
    return CUT_CONTACT.test(after) || COMPELLED_STOP.test(after) ||
      PROHIBITED.test(between + after) && DIRECTIVE.test(after);
  }, ["", "과", "와", "과의", "와의", "랑의", "한테", "에게", "하고", "랑", "은", "는", "도", "의"]);
}
function mandatesDeletion(text) {
  if (DEVICE_ADMIN.test(text) || SELF_REQUEST.test(text)) return false;
  return related(text, protection, deletion, ({before, after}) => !OTHER_APPLICATION.test(before) &&
      (removalDirective.test(after) || FORCE.test(text) && requiredRemoval.test(after)) && !NOT_REQUEST.test(after), ["", "부터", "을", "를", "은", "는", "만"]);
}

/** 현재 받은 연락에서 대상과 명령, 말한 사람을 연결해 기존 R9 신호를 보강한다. */
export function addReportedContactRestrictions(text, signals) {
  const clauses = text.split(CLAUSE).map(value => value.trim()).filter(Boolean);
  if (clauses.some(clause => TEACHING.test(clause))) return;

  for (const [index, clause] of clauses.entries()) {
    if (PAST_OR_REJECTED.test(clause) || BREAK.test(clause)) continue;
    const previous = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    const sameTopic = value => value && !BREAK.test(value) && !PAST_OR_REJECTED.test(value);
    const reported = value => ARTIFACT.test(value) && REPORTED.test(value);
    const body = sameTopic(next) ? clause + " " + next : clause;
    // 간접명령이어도 받은 연락의 내용으로 적힌 경우만 연결한다.
    const narrates = reported(clause) || sameTopic(previous) && reported(previous);
    const indirect = ARTIFACT.test(body) && (DIRECTIVE.test(body) || CUT_CONTACT.test(body));
    if (!narrates && !indirect) continue;

    if (mandatesIsolation(body)) signals.add(SIG_ISOLATION);
    const administrative = sameTopic(previous) && DEVICE_ADMIN.test(previous);
    if (!administrative && mandatesDeletion(body)) signals.add(SIG_DELETE_APP);
  }
}
