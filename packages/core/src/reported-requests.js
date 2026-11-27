import { SIG_DELETE_APP, SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "./signals.js";

// 수신자가 현재 요구를 옮겨 적은 경우도 원래의 신호로 읽는다.
// 피해 사례를 가르치거나 거절·철회한 요구를 설명하는 문맥에는 이 경로를 쓰지 않는다.
const illustrative = /(?:피해|사기|피싱)\s*(?:사례|예방|교육)|예방\s*(?:안내|자료|강의|교육)|교육\s*(?:자료|용)|수업에서\s*(?:읽|배)|(?:사례|예시)(?:를|로)\s*(?:읽|소개|배)|(?:주장|내용|말)(?:은|이)?\s*거짓/;
const withdrawn = /(?:요구|요청|부탁)(?:을|를|은|는|에)?\s*(?:이미\s*)?(?:거절했|거절하고|취소했|철회했)|(?:신고|처리)(?:를)?\s*마쳤/;
const newMessage = /(?:[.!?]\s+|\n+)(?=(?:(?:그런데|한편)\s*)?(?:오늘|방금|지금|이번에)\s*(?:새로\s*)?(?:(?:제게|저에게|내게|저한테)\s*)?(?:온|받은|도착한)\s*(?:답장|문자|쪽지|연락|요청|메시지))/u;
const negatedFee = /(?:낼|지불할|입금할)\s*필요(?:가|는)?\s*없|내야\s*할\s*필요(?:가|는)?\s*없|(?:지불|납부|입금)하지\s*(?:말|마|않)|내지\s*(?:말|마|않)/;
const negatedRequest = /(?:라|다)는\s*(?:뜻|내용|요구|말)(?:이|은|는)?\s*(?:사실이\s*)?아니|(?:라|다)고\s*(?:한|요구한|부탁한)\s*적(?:이)?\s*없/;

const proceeds = /(?:환불|환급|상금|포상금|장려금|지원금|지원비|정산|판매\s*대금|당첨금|지급\s*대상)/;
const advance = /(?:보증금|수수료|선납금|예치금|비용)(?:(?:을|를)?\s*(?:먼저|미리|앞서|우선|별도로)|부터)\s*(?:내야|내는\s*(?:게|것이|사람만)|(?:납부|지불|입금)해야)|(?:먼저|앞서|미리)\s*(?:별도\s*)?(?:비용|수수료|보증금)(?:을|를)?\s*(?:내야|지불해야|납부해야)/;
const unrelatedHolder = /(?:제\s*(?:3|삼)자|(?:과|와|하고)(?:는)?\s*(?:아무\s*)?(?:무관한|관계\s*없는)|아무\s*관계\s*없는)[^.!?\n]{0,20}(?:계좌|통장)(?:로|으로|에)/;
const instructionToPay = /(?:보내|내|입금하|송금하|이체하|납부하)(?:라(?:고|는)|달라(?:고|는)|야(?:만|\s*한)|는\s*(?:게|것이)\s*조건)/;

const socialSupport = /(?:가족|친구|이웃|지인|주위|주변|다른\s*사람|평소\s*(?:연락|상의|상담)하던\s*(?:사람|이들)|누구(?:와|하고|에게)도)/;
const avoidSupport = /(?:연락|이야기|대화|의논|상의)(?:까지|을|를|도)?\s*끊(?:어야|는\s*(?:게|것|일))|(?:연락|의논|상의)(?:하거나\s*(?:의논|상의))?하지\s*않(?:는\s*데|기로)/;
const recordedMaterial = /(?:녹음|촬영|편집)(?:한|된)\s*(?:대화|이야기|연락)/;
const requirement = /조건|필수|전제|요건|동의해야|(?:상담|점검|이용|접수|처리|참여)(?:을|를|가|이|는)?\s*(?:하|받|이[어용]|계속|진행)|(?:받|계속하|이용하|신청하)려면/;
const noObligation = /(?:필요|의무)(?:가|는)?\s*없|(?:조건|필수|요건)(?:은|이|가)?\s*아니/;
const protectionApp = /(?:보호|보안|안전|백신)\s*(?:앱|어플|프로그램)(?:을|를|부터)?\s*(?:먼저\s*)?(?:삭제(?:를\s*)?해야|지워야|(?:삭제하|지우)는\s*(?:게|것이))/;
const harmfulApp = /(?:사칭|가짜|악성|감염된|위조된)\s*(?:보호|안전|보안|백신)|(?:보호|안전|보안|백신)\s*(?:앱|프로그램)(?:을|를)?\s*사칭/;

function addConditions(passage, signals) {
  const clauses = passage.split(/\.(?=\s|$)|[!?\n]+|(?:끝났|완료됐|완료했|마쳤|처리됐)(?:고|지만|는데)\s+/u);
  for (const clause of clauses) {
    if (negatedRequest.test(clause)) continue;
    if (proceeds.test(clause) && advance.test(clause) && !negatedFee.test(clause)) {
      signals.add(SIG_PREPAYMENT);
    }
    const holder = unrelatedHolder.exec(clause);
    if (holder && instructionToPay.test(clause.slice(holder.index + holder[0].length, holder.index + holder[0].length + 32))) {
      signals.add(SIG_THIRD_PARTY_ACCOUNT);
    }
    if (noObligation.test(clause) || !requirement.test(clause)) continue;
    const contact = socialSupport.exec(clause);
    if (contact) {
      const action = clause.slice(contact.index + contact[0].length, contact.index + contact[0].length + 65);
      if (avoidSupport.test(action) && !recordedMaterial.test(action)) signals.add(SIG_ISOLATION);
    }
    if (protectionApp.test(clause) && !harmfulApp.test(clause)) signals.add(SIG_DELETE_APP);
  }
}

export function reportedRequestSignals(text) {
  const signals = new Set();
  // 같은 자료를 설명하는 다음 문장도 예방·철회 문맥일 수 있다. 별개의 수신문을 밝힌 곳에서만 분리한다.
  for (const passage of text.split(newMessage)) {
    if (illustrative.test(passage) || withdrawn.test(passage)) continue;
    addConditions(passage, signals);
  }
  return signals;
}
