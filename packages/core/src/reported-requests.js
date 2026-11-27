import { SIG_APP_INSTALL, SIG_DELETE_APP, SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "./signals.js";
import { addReportedTransactionConditions } from "./reported-transaction-conditions.js";

// 수신자가 현재 요구를 옮겨 적은 경우도 원래의 신호로 읽는다.
// 피해 사례를 가르치거나 거절·철회한 요구를 설명하는 문맥에는 이 경로를 쓰지 않는다.
const illustrative = /(?:피해|사기|피싱)\s*(?:사례|예방|교육)|예방\s*(?:안내|자료|강의|교육)|교육\s*(?:자료|용)|수업에서\s*(?:읽|배)|(?:사례|예시)(?:를|로)\s*(?:읽|소개|배)|(?:주장|내용|말)(?:은|이)?\s*거짓/;
const withdrawn = /(?:요구|요청|부탁)(?:을|를|은|는|에)?\s*(?:이미\s*)?(?:거절했|거절하고|취소했|철회했)|(?:신고|처리)(?:를)?\s*마쳤/;
const newMessage = /(?:[.!?]\s+|\n+)(?=(?:(?:그런데|한편)\s*)?(?:오늘|방금|지금|이번에)\s*(?:새로\s*)?(?:(?:제게|저에게|내게|저한테)\s*)?(?:온|받은|도착한)\s*(?:답장|문자|쪽지|연락|요청|메시지))/u;
const negatedFee = /(?:낼|지불할|입금할)\s*필요(?:가|는)?\s*없|내야\s*할\s*필요(?:가|는)?\s*없|(?:지불|납부|입금)하지\s*(?:말|마|않)|내지\s*(?:말|마|않)/;
const negatedRequest = /(?:라|다)는\s*(?:뜻|내용|요구|말)(?:이|은|는)?\s*(?:사실이\s*)?아니|(?:라|다)고\s*(?:한|요구한|부탁한)\s*적(?:이)?\s*없/;

// 서로 별개라고 밝히거나, 서술의 초점이 극 중 설정·별도 이용 조건으로 옮겨 가는 곳만 나눈다.
const independentTopic = /(?:과|와)(?:는)?\s*(?:별개로|무관하게)\s*[,，]?\s*|(?:이고|이며|였고|였으며)\s*[,，]?\s*(?=(?:대본|극본|각본|시나리오)\s*(?:에|속)|(?:등장인물|배역|주인공)(?:은|는|이|가)|(?:새|다음|별도)\s*(?:상담|점검|이용|접수|참여|신청|운영)?\s*(?:조건|요건|기준))/u;

const proceeds = /(?:환불|환급|상금|포상금|장려금|지원금|지원비|정산|판매\s*대금|당첨금|지급\s*대상)/;
const advance = /(?:보증금|수수료|선납금|예치금|비용)(?:(?:을|를)?\s*(?:먼저|미리|앞서|우선|별도로)|부터)\s*(?:내야|내는\s*(?:게|것이|사람만)|(?:납부|지불|입금)해야)|(?:먼저|앞서|미리)\s*(?:별도\s*)?(?:비용|수수료|보증금)(?:을|를)?\s*(?:내야|지불해야|납부해야)/g;
const completedAdvance = /^\s*(?:했던|하였던|됐던|되었던|하던|(?:조건|요건|전제)(?:이었던|이던|였던))[^,，.!?\n]{0,48}(?:완료(?:했|됐|되었)|끝냈|끝났|마쳤|처리했)(?:습니다|어요|다|고|으며|는데|지만|$)/u;
const unrelatedHolder = /(?:제\s*(?:3|삼)자|(?:과|와|하고)(?:는)?\s*(?:아무\s*)?(?:무관한|관계\s*없는)|아무\s*관계\s*없는)[^.!?\n]{0,20}(?:계좌|통장)(?:로|으로|에)/;
const instructionToPay = /(?:보내|내|입금하|송금하|이체하|납부하)(?:라(?:고|는)|달라(?:고|는)|야(?:만|\s*한)|는\s*(?:게|것이)\s*조건)/;
const charge = "(?:수강료|참가비|신청비|접수비|보증금|수수료|(?:처리\\s*)?비용|예치금)";
const payFirst = new RegExp(charge + "(?:(?:을|를)?\\s*(?:먼저|미리)|부터)\\s*(?:선입금|입금|납부|지불)?(?:해야|내야|하래|하라|해\\s*달라)");
const availabilityBefore = /(?:자리|매물|물건|좌석|예약|양도)(?:가\s*있는지|(?:의|\s*가능)?\s*(?:여부|유무))?(?:을|를)?\s*(?:보려면|알려면|확인하려면)\s*$/;
const availabilityAfter = /^\s*(?:만\s*)?(?:자리|좌석|대여|예약|양도|신청|거래)(?:가\s*되는지|\s*(?:가능\s*)?(?:여부|유무))(?:를)?\s*(?:알려|확인)/;
const institutionPayee = /(?:업체|회사|가게|매장|사업자|법인)(?:의)?\s*(?:계좌|통장|이름|명의|장부)(?:가\s*아니라|\s*대신)\s*/g;
const alternateAccount = /^(?!(?:제|내|저의|나의)\s)(?:[가-힣]{1,8}(?:의)?\s+)?개인\s*(?:명의\s*)?(?:통장|계좌)(?:로|으로|에)\s*(?:(?:대금|[가-힣]{1,6}비)(?:을|를)?\s*)?(?:보내|넣으|부치|입금하|송금하|이체하)(?:라|래)/;
const taughtTransfer = /^(?:고|는|면서)?\s*(?:문구|대목|문장|예문)(?:을|를|은|는)?\s*[^,，.!?\n]{0,24}(?:교육|수업|강의|퀴즈|문제집|교재|연습)(?:에서|로)\s*(?:읽|다뤘|배웠|소개|봤|나왔|풀)/;
const illustrativeTransaction = /(?:가상|가정한|예시)\s*(?:거래|상황|사례)|(?:제가|내가)\s*[^.!?\n]{0,16}(?:에게|한테)\s*(?:요청|안내)/;

const socialSupport = /(?:가족|친구|이웃|지인|주위|주변|다른\s*사람|평소\s*(?:연락|상의|상담)하던\s*(?:사람|이들)|누구(?:와|하고|에게)도)/;
const avoidSupport = /(?:연락|이야기|대화|의논|상의)(?:까지|을|를|도)?\s*끊(?:어야|는\s*(?:게|것|일))|(?:연락|의논|상의)(?:하거나\s*(?:의논|상의))?하지\s*않(?:는\s*데|기로)/;
const recordedMaterial = /(?:녹음|촬영|편집)(?:한|된)\s*(?:대화|이야기|연락)/;
const requirement = /조건|필수|전제|요건|동의해야|(?:상담|점검|이용|접수|처리|참여)(?:을|를|가|이|는)?\s*(?:하|받|이[어용]|계속|진행)|(?:받|계속하|이용하|신청하)려면/;
const noObligation = /(?:필요|의무)(?:가|는)?\s*없|(?:조건|필수|요건)(?:은|이|가)?\s*아니/;
const protectionApp = /(?:보호|보안|안전|백신)\s*(?:앱|어플|프로그램)(?:을|를|부터)?\s*(?:먼저\s*)?(?:삭제(?:를\s*)?해야|지워야|(?:삭제하|지우)는\s*(?:게|것이))/;
const harmfulApp = /(?:사칭|가짜|악성|감염된|위조된)\s*(?:보호|안전|보안|백신)|(?:보호|안전|보안|백신)\s*(?:앱|프로그램)(?:을|를)?\s*사칭/;
const installMessage = /(?:앱|어플|프로그램)(?:을|를)?\s*설치하라는\s*(?:문자|메시지|쪽지|연락|요청)(?:을|를|이|가)?\s*(?:(?:제가|제게|저한테)\s*)?(?:받았|받은|왔)/;
const notReceived = /받은\s*(?:적|기억)(?:이|은)?\s*없|(?:이미|바로)\s*거절|거절했|보낸\s*적(?:이)?\s*없/;

function hasCurrentAdvance(topic) {
  if (negatedFee.test(topic) || noObligation.test(topic)) return false;
  const fee = payFirst.exec(topic);
  if (fee && !completedAdvance.test(topic.slice(fee.index + fee[0].length)) && !/(?:취소|철회|거절)/.test(topic.slice(fee.index))) {
    const prefix = topic.slice(0, fee.index);
    if (proceeds.test(prefix) || availabilityBefore.test(prefix) || availabilityAfter.test(topic.slice(fee.index + fee[0].length))) return true;
  }
  if (!proceeds.test(topic)) return false;
  for (const match of topic.matchAll(advance)) {
    if (!completedAdvance.test(topic.slice(match.index + match[0].length))) return true;
  }
  return false;
}

function hasAlternateAccountRequest(topic) {
  if (illustrativeTransaction.test(topic) || /(?:거절했|취소했|철회했)/.test(topic)) return false;
  for (const payee of topic.matchAll(institutionPayee)) {
    const tail = topic.slice(payee.index + payee[0].length);
    const transfer = alternateAccount.exec(tail);
    if (transfer && !taughtTransfer.test(tail.slice(transfer[0].length))) return true;
  }
  return false;
}

function addConditions(passage, signals) {
  const clauses = passage.split(/\.(?=\s|$)|[!?\n]+|(?:끝났|완료됐|완료했|마쳤|처리됐)(?:고|지만|는데)\s+/u);
  for (const clause of clauses) {
    if (negatedRequest.test(clause)) continue;
    if (installMessage.test(clause) && !notReceived.test(clause)) signals.add(SIG_APP_INSTALL);

    const topics = clause.split(independentTopic);
    if (topics.some(hasCurrentAdvance)) signals.add(SIG_PREPAYMENT);

    const holder = unrelatedHolder.exec(clause);
    if (holder && instructionToPay.test(clause.slice(holder.index + holder[0].length, holder.index + holder[0].length + 32))) {
      signals.add(SIG_THIRD_PARTY_ACCOUNT);
    }
    if (topics.some(hasAlternateAccountRequest)) {
      signals.add(SIG_THIRD_PARTY_ACCOUNT);
    }

    for (const topic of topics) {
      if (noObligation.test(topic) || !requirement.test(topic)) continue;
      const contact = socialSupport.exec(topic);
      if (contact) {
        const actionStart = contact.index + contact[0].length;
        const action = topic.slice(actionStart, actionStart + 65);
        if (avoidSupport.test(action) && !recordedMaterial.test(action)) signals.add(SIG_ISOLATION);
      }
      if (protectionApp.test(topic) && !harmfulApp.test(topic)) signals.add(SIG_DELETE_APP);
    }
  }
}

export function reportedRequestSignals(text) {
  const signals = new Set();
  // 같은 자료를 설명하는 다음 문장도 예방·철회 문맥일 수 있다. 별개의 수신문을 밝힌 곳에서만 분리한다.
  for (const passage of text.split(newMessage)) {
    if (illustrative.test(passage) || withdrawn.test(passage)) continue;
    addConditions(passage, signals);
  }
  addReportedTransactionConditions(text, signals);
  return signals;
}
