import { classifyCallback } from "./callback-number.js";
import { SIG_DELETE_APP, SIG_ISOLATION } from "./signals.js";

const TOKEN_START = "(?<![\\p{L}\\p{N}_])";
const particles = "(?:와의|과의|랑의|에게는|한테는|에게도|한테도|하고는|와는|과는|에게서|한테서|으로부터|에게|한테|에서는|에서|으로|로|부터|까지|에게만|하고|이나|에|은|는|이|가|을|를|도|만|께|의|와|과|랑|뿐)";
const CLAUSE = /(?<=[.!?。…])\s+|[\r\n]+|(?<=[,，;；])\s*(?=(?:다만|별도로|반면|한편|그러나|그런데|별개로))/u;
const BREAK = /(?:이와|그와|이와는|그와는)\s*별개|그와\s*무관|(?:한편|별건|별도로\s*(?:받|왔|온|발송|게시))|(?:이웃|지인|동료|친구)(?:에게|한테|이|가)\s*(?:온|보낸|게시한|남긴)/u;
const TEACHING = /(?:피해|피싱|사기|사칭)\s*(?:피해\s*)?(?:사례|교육|예방|주의)|(?:예방|교육|가상|훈련|예시)\s*(?:용|안내|자료|문구|프로그램|수업|사례|강의|연습)|(?:연극|시나리오|대본|역할극|소품|배역)/u;
const PAST_OR_REJECTED = /(?:이미|앞서|이전에|지난번)\s*[^.!?]{0,24}(?:처리|거절|종료|철회|완료|반납|확인했|가려)|(?:요청|요구|안내|부탁)(?:을|를|이|가|은|는)?\s*(?:거절|철회|취소|없|아니)|(?:말|뜻|조건|필수|의무|예정)(?:이|가|은|는)?\s*(?:아니|없)|(?:말했|요구했|요구한|요청한|부탁한|말한)\s*(?:적|사실|기억|일)(?:이|은|도|는)?\s*없|(?:해당|같은)\s*(?:안내|문자)(?:를|이|가)?\s*(?:받은\s*적\s*없|폐기했)/u;
const DIRECTIVE = /(?:요구|요청|시키|강요|(?:하|어|아)라(?:고|는|며)|하(?:지\s*(?:말라는|말라고|말라며)|게\s*(?:했다|한다|하는|함))|(?:해|될|할)\s*수\s*없|(?:보내|첨부해|지워|삭제해|하지\s*말아)\s*달라|하지\s*않(?:게|도록)|하(?:게|도록)\s*(?:요구|요청|시켰))/u;
const FORCE = /(?:필수|요건|조건|전제|의무|(?:한|하)\s*뒤에만|오직|으로만|로만|만\s*(?:가능|처리|접수)|해야만|하기\s*전에는|(?:하지|하지\s*않으)면\s*(?:없|불가|중단|안\s*된)|(?:받|신청하|접수하|계속하|진행하)려면)/u;
const PROHIBITED = /(?:지\s*(?:말|마|않)|못\s*(?:하|해)|하지\s*않|하(?:지\s*않고|면\s*안\s*된)|금지|차단|중단|끊|금할|피하|피해야)/u;
const NOT_REQUEST = /(?:하(?:지\s*(?:말|마|않)|면\s*안)|(?:할|할\s*것일)\s*필요(?:가|는)?\s*없|선택\s*(?:사항|입력)|(?:권한|필수|의무)(?:가|이|은|는)?\s*아니|요구(?:는|가)?\s*없|(?:공유|제출|기재|설치|접속|전송)\s*금지)/u;
const ARTIFACT = /(?:문자|연락|답장|답신|회신|메시지|쪽지|통지|알림|내용|고지|안내(?:문)?|공문|본문|발신|수신)/u;
const REPORTED = /(?:받(?:은|았|고|음|은\s*적)|왔(?:다|어|습|는|으며|대|어요)|(?:도착|수신|전달)(?:한|했|됐|되었)|(?:에서|명의로)\s*온|보낸|발송|내건|문자에는|문자에|연락에는|설명|기록|적(?:혀|힌|었|은)|써\s*있|표시|(?:라는|이라는|이라고|라고|라며|하란|으란)\s*(?:밝|적|써|표시|쓰|설명|했|한|첫|되어|끝|연락|답|통지|안내|문자|쪽지))/u;
const COMMAND_ENDING = "(?:으?라(?:고|는|며|는지|ㄴ)|으?란|으?래(?:요|서|도)?|아?(?:야|달라))";
const CUT_CONTACT = new RegExp("(?:끊|막|피하|금하|금지하|중단하|단절하|그만두|말)\\s*" + COMMAND_ENDING, "u");
const ONLY_ALONE_AFTER_CUTOFF = /(?:연락|통화|접촉|대화|얘기|이야기|상의|의논)(?:하고|하거나|을|를|은|도)?\s*(?:(?:전부|모두|일단)\s*)?(?:끊(?:고|은\s*뒤|어야)|중단하(?:고|면)|단절하(?:고|면))[^.!?\n]{0,26}(?:혼자(?:서)?(?:만)?|단독(?:으로)?)[^.!?\n]{0,16}(?:하라|하란|하래|해야|시키|지시|요구|받으|하라고|진행|해결|처리|응대|남아|얘기)/u;
const COMPELLED_STOP = /(?:끊(?:을|어야|는\s*(?:일|게|것))|단절|중단|연락하지\s*않(?:고|는))[^.!?]{0,18}(?:요구|강요|전제|조건|필수)|(?:끊어|중단해|그만둬)\s*(?:달라고|달라는|달라며)|(?:연락|상의|대화|통화|얘기|이야기|접촉|말|상의)(?:하|해)(?:지\s*)?(?:말아\s*달라고|말라고|말라며|말라는|말란|말래)/u;
const NARROW_CONTEXT = /(?:가해자|괴롭힘|스토킹|스팸|사칭범|낯선\s*(?:번호|사람)|의심\s*번호|제[삼3]자(?:의)?\s*(?:번호|연락처)|전화\s*번호\s*차단)|(?:공연|상영|관람|수업|회의|운전|촬영|시험|치료|교육)\s*(?:중|시간|장소|현장|진행\s*동안)|(?:제가|내가|수신자가)\s*(?:나중|잠깐|당분간)\s*(?:연락|통화|대화)/u;
const SELF_REQUEST = /(?:제가|내가|수신자가)\s*(?:먼저|직접|별도로)?\s*(?:요구|요청|부탁)(?:했|한|하고)|(?:제가|내가|수신자가)\s*먼저\s*했(?:다는|다고)|(?:제가|내가|수신자가)\s*먼저\s*(?:차단|삭제)/u;
const DEVICE_ADMIN = /(?:업무용|회사\s*지급|공용|시험용|실습용|전시용|구형|사내|공동)\s*(?:[가-힣]{1,8}\s*)?(?:기기|노트북|단말|프로그램|앱|컴퓨터)|(?:정기|기기|전산)\s*(?:정비|교체|관리|폐기)|교체\s*설치|(?:대여|임대|지급|지원)\s*(?:기기|단말기|컴퓨터)(?:의)?\s*반납|반납(?:\s*(?:기한|절차|점검)|을\s*위해)/u;
const OTHER_APPLICATION = /(?:위장|사칭|가짜|위조|악성|감염|체험|시험|테스트|설치\s*실패)/u;

const nounPattern = vocabulary => new RegExp(
  TOKEN_START + "(?:" + vocabulary + ")(?<particle>" + particles + ")?(?=[,，.;:!?…·/|\\s]|$)", "gu",
);
const verbPattern = vocabulary => new RegExp(TOKEN_START + "(?:" + vocabulary + ")", "gu");
const person = nounPattern("가족|부모(?:님)?|자녀|배우자|주위\\s*(?:사람|이들)|(?:도움을\\s*주던|도움을\\s*받던|제가\\s*의지하는|믿고\\s*의지하는|믿을\\s*수\\s*있는)\\s*(?:사람|이들)|주변(?:\\s*(?:인물|사람|인맥))?|가까운\\s*(?:이|이들|사람)|친척|친구|지인|동료|이웃|(?:평소\\s*)?(?:상의|의논|상담|연락)(?:하는|해\\s*오던|해\\s*온|하던)\\s*(?:사람|이들)|(?:다른|제삼자|제3자)\\s*(?:사람|인물|상담원|직원)?");
const protection = nounPattern("(?:휴대폰|기기|컴퓨터)?\\s*(?:백신|보호|보안|안전|방어|(?:피싱|사기|바이러스|악성(?:코드|\\s*사이트|\\s*문자)?|유해\\s*(?:사이트|문자|주소))(?:를|을)?\\s*(?:예방|차단|방어|검사|탐지|거르(?:는|기)?|걸러주는|막는)|악성코드\\s*검사|위험\\s*차단|(?:휴대폰|핸드폰|폰|단말기|기기|컴퓨터)(?:을|를)?\\s*보호(?:해\\s*주|하)는|(?:위험|악성)(?:을|를)?\\s*막아\\s*주(?:는)?)\\s*(?:용\\s*)?(?:앱|프로그램|어플|소프트웨어|도구|서비스)");
const communication = verbPattern("연락|말하|통화|의논|상의|상담|메시지|대화|알리|전하|소통|접촉|얘기|이야기|물어보|도움을\\s*청|도움을\\s*구|조언을\\s*(?:구|받)");
const deletion = verbPattern("삭제|지우|지웠|지워|제거|없애");
const removalDirective = /^(?:(?:삭제|제거)(?:를?\s*(?:요청|요구)|해\s*달라|하(?:라|래|도록))|(?:지워|없애)\s*달라|(?:지우|없애)(?:라|래))/u;
const instructedFirstRemoval = /^(?:삭제|제거)(?:부터|를)?\s*(?:(?:먼저|우선)\s*)?(?:해라|하라|하래|해\s*달라|해야|하여야|하라는|하라고|하라며|하는\s*게\s*순서)|^(?:삭제|제거)(?:를|부터)?\s*(?:하고|해야)\s*[^.!?\n]{0,12}(?:절차|단계|순서|상담)(?:를|을)?\s*(?:진행|시작|들어|계속)/u;
const continuedAfterRemoval = /^(?:(?:삭제|제거)(?:를)?\s*(?:먼저\s*)?(?:하고|한|하되|해야)|(?:지우고|지운|지워야|없애고|없앤|없애야))[^.!?\n]{0,23}(?:뒤에?|후에?|이후에?|다음(?:에)?|서야|(?:상담|확인|접수|절차|설치|작업)(?:를|을)?\s*(?:계속|진행|이어))/u;
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

const supportAtSide = /(?:곁|옆|자리|주변)\s*(?:에|에서)?\s*(?:있(?:던|는)|가까이\s*있던)\s*(?:사람|이들|인원)(?:을|를)?/gu;
const separateSupport = /(?:떨어(?:져|진|질|지|뜨리)|떼어|물리|내보내|(?:자리|곁|옆)(?:에서|를)\s*(?:보내|비우게|떠나게)|보내고)/u;
const soleContact = /(?:혼자(?:서)?(?:만)?|단독(?:으로)?)\s*(?:(?:남아|계속|따로)\s*)?(?:통화|상담|접촉|연락|시작|응대|절차)|(?:통화|상담|접촉|연락|응대|절차)(?:는|가|를|은|이|을)?\s*(?:(?:꼭|오직|반드시|계속)\s*)?(?:혼자(?:서)?(?:만)?|단독(?:으로)?)/u;
const deferHelp = /(?:연락|상의|의논|조언|도움)(?:을|를|는|은|도)?\s*(?:(?:아예|일단|나중으로|뒤로)\s*)?(?:미루|보류하|건너뛰|생략하|넘기)(?:라(?:고|는|며)|래|고\s*있)/u;
const throughAction = /(?:거래|절차|상담|연락|통화|처리|송금|결제|심사)(?:가|이|을|를)?\s*(?:끝날\s*때까지|끝나기\s*전(?:까지)?|진행되는\s*동안|진행할\s*동안|하는\s*동안|마칠\s*때까지|마무리될\s*때까지)/u;
const staysAlone = /(?:혼자(?:서)?(?:만)?|단독(?:으로)?)\s*(?:있(?:으|어|는)|남(?:아|으|는))/u;
const barsSeekingAdvice = /(?:가족|친구|친척|지인|이웃|아는\s*사람)(?:들)?(?:과|와|에게|한테|이랑|이나|이나는|도)?[^.!?\n]{0,32}(?:상의|의논|조언)(?:(?:를|을|는|은)\s*)?(?:하는\s*(?:건|일은|것은)\s*|하면\s*|해서는\s*|하는\s*것도\s*)?안\s*된(?:다는|다고|다며|다는\s*내용)|(?:가족|친구|친척|지인|이웃|아는\s*사람)(?:들)?(?:과|와|에게|한테|이랑|이나|도)?[^.!?\n]{0,32}(?:상의|의논|조언)(?:를|을)?\s*(?:하(?:지\s*말라|면\s*안\s*된다)|하지\s*않도록)\s*(?:고|는|며)/u;
const allowedSupport = /(?:같이|함께)\s*(?:할|참여할)\s*수|(?:상의|연락|통화)(?:를|을)?\s*(?:해도|해\s*봐도)\s*(?:돼|된)|(?:원하면|선택하면)\s*가족/u;

function requiredSeparation(text) {
  if (allowedSupport.test(text)) return false;
  if (barsSeekingAdvice.test(text)) return true;
  const parties = [...text.matchAll(supportAtSide), ...text.matchAll(person)];
  return parties.some(party => {
    const tail = text.slice(party.index + party[0].length, party.index + party[0].length + 72);
    const apart = separateSupport.exec(tail);
    if (apart && (soleContact.test(tail.slice(apart.index)) || throughAction.test(text) && (soleContact.test(text) || staysAlone.test(tail.slice(apart.index)))) &&
        (DIRECTIVE.test(tail) || /(?:으라고|하도록)\s*(?:한|안내|적|요구|요청)/u.test(tail))) return true;
    const before = text.slice(Math.max(0, party.index - 38), party.index);
    return throughAction.test(before + tail) && deferHelp.test(tail);
  });
}
function mandatesIsolation(text) {
  if (SELF_REQUEST.test(text) || NARROW_CONTEXT.test(text)) return false;
  if (requiredSeparation(text)) return true;
  return related(text, person, communication, ({after, between, object}) => {
    if (/^(?:다른|제[삼3]자)/u.test(object[0]) ||
        /(?:녹음|영상|촬영|내용을\s*공개|번호를\s*차단|단지|일시적으로|잠깐|잠시)/u.test(between + after) ||
        /(?:으?라는|라고\s*한)\s*(?:뜻|말|내용|요구)(?:이|가|은|는)?\s*아니/u.test(after)) return false;
    return CUT_CONTACT.test(after) || COMPELLED_STOP.test(after) || ONLY_ALONE_AFTER_CUTOFF.test(after) ||
      PROHIBITED.test(between + after) && DIRECTIVE.test(after);
  }, ["", "과", "와", "과의", "와의", "랑의", "한테", "에게", "한테는", "에게는", "한테도", "에게도", "하고", "하고는", "와는", "과는", "랑", "은", "는", "도", "의"]);
}
const COMPARISON_ONLY = /(?:예시|예문|가정)(?:은|는|이|가)?\s*(?:비교|참고)\s*(?:용|자료|설명)|(?:비교|참고)\s*(?:용|자료|설명)(?:이|일)?\s*뿐/u;

function mandatesDeletion(text) {
  if (DEVICE_ADMIN.test(text) || SELF_REQUEST.test(text) || COMPARISON_ONLY.test(text)) return false;
  return related(text, protection, deletion, ({before, after}) => {
    // 발신자의 요구에 뒤따르는 수신자 본인의 미실행은 요구의 부정과 구별한다.
    const directive = after.split(/(?:지만|는데|며)\s*(?:저는|제가|나는|내가|수신자는|실제로는)\s*/u, 1)[0];
    return !OTHER_APPLICATION.test(before) && !NOT_REQUEST.test(directive) &&
      (removalDirective.test(directive) || FORCE.test(text) && requiredRemoval.test(directive) ||
       continuedAfterRemoval.test(directive) || instructedFirstRemoval.test(directive));
  }, ["", "부터", "을", "를", "은", "는", "만"]);
}

// 기존 보호 도구의 제거와, 기관을 자처하며 업무 앱 삭제 후 자기 연락처로 바꾸라는 요구를 확인한다.
const inUseApp = /(?:이미\s*있던|기존|(?:사용|이용)\s*중인|쓰던|제가\s*쓰는|(?:내|제|저의|수신자의|개인(?:용)?)\s*(?:휴대\s*(?:전화|폰)|스마트폰|단말|기기|컴퓨터)|수신자의)\s*[^.!?\n]{0,18}$/u;
const otherAppRecipient = /(?:관리자|직원|운영자|전산\s*담당자|기사|제삼자)(?:에게|한테|의)\s*[^.!?\n]{0,28}$/u;
const senderReport = /(?:상대(?:방)?|발신(?:자|인)|상담(?:자|원)|보낸\s*(?:사람|쪽|곳))(?:가|이|는|은|의)?(?=[\s,.:]|$)/u;
const removalProcedure = /^(?:삭제|제거)(?:하는\s*(?:절차|단계|순서)(?:를|을)\s*(?:요구|요청|지시)|(?:를|을)\s*(?:선행|필수|첫|우선)\s*(?:절차|단계|순서|조건)(?:로|으로)\s*(?:정|지정|요구))/u;
const appObjectModifier = /^\s*(?:(?:먼저|완전히|우선)\s*)?$/u;
const transactionRequiresRemoval = /^(?:지워|없애|(?:삭제|제거)(?:를)?\s*(?:해|하여))야(?:만)?\s*(?:(?:매물|물품|대금|해당|그)\s*)?(?:거래|결제|계약|정산|지급)(?:를|을|이|가|는|은)?\s*(?:(?:다시|계속)\s*)?(?:이어\s*갈|계속할|진행할|재개할|마칠|할)\s*수\s*있(?:다고|다는|다며)\s*(?:했|말했|설명했|알렸|안내했|내용|설명)/u;
const ordinaryRemoval = /(?:약관|이용\s*규정|정상\s*(?:교체|전환|정비)|공식\s*(?:앱\s*)?(?:장터|마켓)|삭제\s*(?:여부|이력|기록)|(?:삭제|제거)하는\s*(?:절차|단계|순서)(?:가|는)?\s*(?:필요한지|있는지))/u;
const senderClosedRemoval = /^(?:(?:발신(?:자|인)|상대(?:방)?)(?:가|이)\s*(?:그|해당|같은|이)\s*(?:(?:삭제|제거)\s*)?(?:요구|요청|지시)(?:를|을)?\s*(?:철회|취소)|(?:그|해당|같은|이)\s*(?:(?:삭제|제거)\s*)?(?:요구|요청|지시)(?:는|가|이|은)?\s*(?:이미\s*)?(?:철회|취소)(?:됐|되었))/u;

const serviceApp = nounPattern("(?:(?:모바일|인터넷|스마트)\\s*)?(?:뱅킹|은행|통신사)\\s*(?:앱|어플(?:리케이션)?|프로그램)");
const serviceRemovalHeader = /^\s*\[[^\]\n]{0,18}(?:은행|금융\s*(?:기관|회사)|통신사)(?:의)?\s*(?:보안\s*(?:팀|부서|담당)|안전\s*(?:관리|담당)|고객\s*(?:지원|센터)|담당자|상담원)\s*\]/u;
const claimsServiceRole = /(?:은행|금융\s*(?:기관|회사)|통신사)(?:의)?\s*(?:보안|안전|고객\s*지원|담당|상담)[가-힣\s]{0,12}?(?:을|를)?\s*자처한\s*(?:발신(?:자|인)|상대(?:방)?|보낸\s*사람)/u;
const serviceDeletion = verbPattern("삭제|제거|지우고|없애고|지운|없앤");
const removalBeforeCallback = /^(?:(?:삭제|제거)하(?:고|면)|(?:삭제|제거)한\s*(?:뒤|후)|(?:지우|없애)고|(?:지운|없앤)\s*(?:뒤|후))/u;
const senderDesignatesCallback = /(?:본인|자신|발신(?:자|인)|상대(?:방)?|보낸\s*사람)(?:이|가)?\s*(?:지정한|정한|알려\s*준)\s*(?:전화\s*)?(?:번호|연락처)(?:로|으로|에)(?:만)?\s*(?:회신|전화|연락|통화)(?:하(?:라|래|도록)|해\s*달라)/u;

const marketplace = /(?:중고\s*(?:거래|장터)|인터넷\s*장터|온라인\s*(?:장터|거래)|판매자(?:에게|한테)|거래\s*상대(?:에게|한테))/u;
const asksMarketplace = /(?:문의|질문)(?:를|을)?\s*(?:했|하였)|(?:물었|물어봤)/u;
const marketplaceResponder = /^(?:상대(?:방)?|판매자|(?:답변|상담|응답)(?:하던|한|하는)\s*(?:사람|쪽)|상담(?:원|자))(?:가|이|은|는)\s+/u;
const communicatedRemoval = /^(?:(?:삭제|제거)하(?:라고|라는)|(?:지우|없애)(?:라고|라는)|(?:삭제해|제거해|지워|없애)\s*달라고)\s*(?:(?:(?:했|말했|요청했|요구했)(?:다|습니다|어요|음|(?:고|지만)(?=\s+(?:저는|제가|나는|내가|수신자는)))|(?:해|말해)서)|(?:요청|지시|내용)(?:이었|였)(?:다|습니다|어요))(?:고\s*(?:적었|기록했)(?:다|습니다|어요))?(?=$|[.\s。!])/u;
const ownOfficialServiceWork = /(?:공식|은행|통신사)(?:의)?\s*(?:고객\s*센터|상담|업데이트|교체|재설치)|(?:장애|오류)\s*(?:복구|정비|해결)|(?:재설치|업데이트)(?:를|을|하기)?\s*(?:위해|때문에)|(?:자기|자신|본인)(?:의)?\s*(?:기기|컴퓨터|휴대폰|단말기)/u;

function marketplaceResponderDemandsRemoval(text) {
  if (!marketplace.test(text)) return false;
  for (const record of text.split(/\r?\n[ \t]*\r?\n/u)) {
    const clauses = record.split(CLAUSE).map(clause => clause.trim()).filter(Boolean);
    for (const [index, clause] of clauses.entries()) {
      const previous = clauses[index - 1] ?? "";
      const next = clauses[index + 1] ?? "";
      if (!marketplace.test(previous) || !asksMarketplace.test(previous) || BREAK.test(previous + " " + clause) ||
          PAST_OR_REJECTED.test(clause) || DEVICE_ADMIN.test(clause) || SELF_REQUEST.test(clause) ||
          COMPARISON_ONLY.test(clause) || ordinaryRemoval.test(clause) || senderClosedRemoval.test(next) ||
          ownOfficialServiceWork.test(previous + " " + clause)) continue;
      // 거래 문의의 상대, 수신자가 사용하던 앱, 그 앱을 지우라는 요구를 결속한다.
      const requested = related(clause, serviceApp, deletion, ({before, between, after, object}) => {
        const leading = clause.slice(0, object.index);
        const predicate = clause.slice(object.index + object[0].length + between.length);
        return marketplaceResponder.test(leading) && inUseApp.test(leading) && !otherAppRecipient.test(leading) &&
          !OTHER_APPLICATION.test(before) && !NOT_REQUEST.test(after) &&
          appObjectModifier.test(between) && communicatedRemoval.test(predicate);
      }, ["", "부터", "을", "를", "의"]);
      if (requested) return true;
    }
  }
  return false;
}

function mandatesContextualRemoval(clause, previous, next, hasReport) {
  if (DEVICE_ADMIN.test(clause) || SELF_REQUEST.test(clause) || COMPARISON_ONLY.test(clause) ||
      ordinaryRemoval.test(clause) || senderClosedRemoval.test(next)) return false;

  const possibleRecipientApp = (object, before) => {
    const leading = clause.slice(0, object.index);
    return OTHER_APPLICATION.test(before) || otherAppRecipient.test(leading) ? null : leading;
  };
  const protectionRemoved = related(clause, protection, deletion, ({ before, between, after, object }) => {
    const leading = possibleRecipientApp(object, before);
    if (leading === null || !inUseApp.test(leading) || NOT_REQUEST.test(after)) return false;
    if ((hasReport || senderReport.test(leading)) && removalProcedure.test(after)) return true;
    const action = clause.slice(object.index + object[0].length + between.length);
    return senderReport.test(leading) && appObjectModifier.test(between) && transactionRequiresRemoval.test(action);
  }, ["", "부터", "을", "를", "의"]);
  if (protectionRemoved) return true;

  return related(clause, serviceApp, serviceDeletion, ({ before, between, after, object }) => {
    const leading = possibleRecipientApp(object, before);
    if (leading === null || NOT_REQUEST.test(after)) return false;
    const action = clause.slice(object.index + object[0].length + between.length);
    const direct = serviceRemovalHeader.test(leading) || serviceRemovalHeader.test(previous);
    if (direct && removalBeforeCallback.test(action) && classifyCallback(action, []).directed) return true;

    return inUseApp.test(leading) && claimsServiceRole.test(leading) && senderDesignatesCallback.test(action) &&
      (removalBeforeCallback.test(action) || removalDirective.test(action) && /(?:이어서|그\s*뒤|그\s*다음)/u.test(action));
  }, ["", "부터", "을", "를", "의"]);
}

const senderLimitsOutsideAdvice = /(?:연락(?:한|하던|했던|을\s*한|해\s*온)\s*(?:사람|상대)|발신(?:자|인)|상대(?:방)?)(?:가|이|은|는)?\s*(?:제가|내가|수신자가)?[^.!?\n]{0,25}(?:다른\s*사람|가족|지인|친구)(?:과|와|에게|한테|하고)?\s*[^.!?\n]{0,12}(?:상의|의논|조언)(?:를|을)?\s*(?:하지\s*못\s*(?:하게|하도록)|할\s*수\s*없(?:게|도록)|못\s*하게|해선\s*안\s*된다고)/u;
const senderDemandsContinuingAlone = /(?:혼자(?:서)?(?:만)?|단독(?:으로)?)\s*[^.!?\n]{0,16}(?:다음|계속|이어)[^.!?\n]{0,18}(?:이야기|대화|통화|연락|상담|응답)[^.!?\n]{0,17}(?:요구|요청|지시)/u;

const sameIsolationDemandEnded = /^(?:그|해당|같은|이)\s*(?:요구|요청|조건|지시)(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:(?:취소|철회)(?:됐|되었)|(?:발신자|발신인|상대(?:방)?)(?:가|이)\s*(?:취소|철회)(?:했|하였))/u;
const asksForOutsideAdvice = /(?:조언|자문|도움)(?:을|를)?\s*(?:받아\s*보|받|구해\s*보|구하|얻어\s*보|얻)(?:겠다고|려고\s*한다고)\s*(?:했|설명했|말했)더니\s*[,，]?\s*/u;
const returnedProhibition = /^(?:아예|일절|전혀|절대)?\s*(?:얘기|이야기|상의|의논|상담|연락|말)(?:하)?지\s*말라는\s*(?:답(?:만|이|을)?|응답(?:만|이|을)?|대답(?:만|이|을)?|회신(?:만|이|을)?)(?=\s|$)/u;
const secondSupportParty = /^\s*(?:(?:상담\s*(?:창구|기관|센터)|상담원)(?:와는|과는|하고는|에게는)\s*)?(?:아예|일절|전혀|절대)?\s*$/u;

function adviceBlockedInReply(clause, next) {
  if (NARROW_CONTEXT.test(clause) || allowedSupport.test(clause) || sameIsolationDemandEnded.test(next)) return false;
  const offer = asksForOutsideAdvice.exec(clause);
  if (!offer) return false;
  const reply = clause.slice(offer.index + offer[0].length);
  return related(reply, person, communication, ({ after, between, object }) =>
    object.index === 0 && secondSupportParty.test(between) && returnedProhibition.test(after),
  ["와", "과", "와는", "과는", "하고", "하고는", "에게", "에게는", "한테", "한테는", "이나", "나"]);
}

function mustContinueWithoutSupport(clauses) {
  return clauses.some((clause, index) => {
    const next = clauses[index + 1] ?? "";
    return senderLimitsOutsideAdvice.test(clause) && !PAST_OR_REJECTED.test(clause) &&
      !SELF_REQUEST.test(clause) && !NARROW_CONTEXT.test(clause) && !BREAK.test(next) && !PAST_OR_REJECTED.test(next) &&
      !NARROW_CONTEXT.test(next) && !allowedSupport.test(clause + " " + next) &&
      !sameIsolationDemandEnded.test(clauses[index + 2] ?? "") && senderDemandsContinuingAlone.test(next);
  });
}

/** 현재 받은 연락에서 대상과 명령, 말한 사람을 연결해 기존 R9 신호를 보강한다. */
export function addReportedContactRestrictions(text, signals) {
  const clauses = text.split(CLAUSE).map(value => value.trim()).filter(Boolean);
  if (clauses.some(clause => TEACHING.test(clause))) return;
  if (mustContinueWithoutSupport(clauses)) signals.add(SIG_ISOLATION);
  if (marketplaceResponderDemandsRemoval(text)) signals.add(SIG_DELETE_APP);

  for (const [index, clause] of clauses.entries()) {
    if (PAST_OR_REJECTED.test(clause) || BREAK.test(clause)) continue;
    const previous = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    const sameTopic = value => value && !BREAK.test(value) && !PAST_OR_REJECTED.test(value);
    const reported = value => ARTIFACT.test(value) && REPORTED.test(value);
    const body = sameTopic(next) ? clause + " " + next : clause;
    // 간접명령이어도 받은 연락의 내용으로 적힌 경우만 연결한다.
    const narrates = reported(clause) || sameTopic(previous) && reported(previous);
    const indirect = ARTIFACT.test(body) && (DIRECTIVE.test(body) || CUT_CONTACT.test(body) || ONLY_ALONE_AFTER_CUTOFF.test(body));
    const requiredRemovalReported = /(?:발신자|상대(?:방)?|보낸\s*사람|상담원?|안내(?:문)?|조건|절차|지시|요구|내용|라(?:고|는|며)|다(?:고|는|며)|(?:해야|해라|하라|하래)\s*[.!?]?)/u.test(body);

    const isolationClosure = sameIsolationDemandEnded.test(next) || sameTopic(next) && sameIsolationDemandEnded.test(clauses[index + 2] ?? "");
    if (!isolationClosure && ((narrates || indirect) && mandatesIsolation(body) || adviceBlockedInReply(clause, next))) {
      signals.add(SIG_ISOLATION);
    }
    const administrative = sameTopic(previous) && DEVICE_ADMIN.test(previous);
    if (!administrative && ((narrates || indirect || requiredRemovalReported) && mandatesDeletion(body) ||
        mandatesContextualRemoval(clause, sameTopic(previous) ? previous : "", next, narrates))) {
      signals.add(SIG_DELETE_APP);
    }
  }
}
