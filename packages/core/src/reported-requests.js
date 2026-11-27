import { SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "./signals.js";

// 수신자가 현재 요구를 옮겨 적은 경우도 원래의 신호로 읽는다.
// 피해 사례를 가르치거나 거절·철회한 요구를 설명하는 문맥에는 이 경로를 쓰지 않는다.
const illustrative = /(?:피해|사기|피싱)\s*(?:사례|예방|교육)|예방\s*(?:안내|자료|강의|교육)|교육\s*(?:자료|용)|수업에서\s*(?:읽|배)|(?:사례|예시)(?:를|로)\s*(?:읽|소개|배)|(?:주장|내용|말)(?:은|이)?\s*거짓/;
const withdrawn = /(?:요구|요청|부탁)(?:을|를|은|는|에)?\s*(?:이미\s*)?(?:거절했|거절하고|취소했|철회했)|(?:신고|처리)(?:를)?\s*마쳤/;
const negatedFee = /(?:낼|지불할|입금할)\s*필요(?:가|는)?\s*없|내야\s*할\s*필요(?:가|는)?\s*없|(?:지불|납부|입금)하지\s*(?:말|마|않)|내지\s*(?:말|마|않)/;
const negatedRequest = /(?:라|다)는\s*(?:뜻|내용|요구|말)(?:이|은|는)?\s*아니|(?:라|다)고\s*(?:한|요구한|부탁한)\s*적(?:이)?\s*없/;

const proceeds = /(?:환불|환급|상금|포상금|장려금|지원금|지원비|정산|판매\s*대금|당첨금|지급\s*대상)/;
const advance = /(?:보증금|수수료|선납금|예치금|비용)(?:(?:을|를)?\s*(?:먼저|미리|앞서|우선|별도로)|부터)\s*(?:내야|내는\s*(?:게|것이|사람만)|(?:납부|지불|입금)해야)|(?:먼저|앞서|미리)\s*(?:별도\s*)?(?:비용|수수료|보증금)(?:을|를)?\s*(?:내야|지불해야|납부해야)/;
const unrelatedHolder = /(?:제\s*(?:3|삼)자|(?:과|와|하고)(?:는)?\s*(?:아무\s*)?(?:무관한|관계\s*없는)|아무\s*관계\s*없는)[^.!?\n]{0,20}(?:계좌|통장)(?:로|으로|에)/;
const instructionToPay = /(?:보내|내|입금하|송금하|이체하|납부하)(?:라(?:고|는)|달라(?:고|는)|야(?:만|\s*한)|는\s*(?:게|것이)\s*조건)/;

export function reportedRequestSignals(text) {
  const signals = new Set();
  if (illustrative.test(text) || withdrawn.test(text)) return signals;
  const clauses = text.split(/\.(?=\s|$)|[!?\n]+/u);
  for (const clause of clauses) {
    if (negatedRequest.test(clause)) continue;
    if (proceeds.test(clause) && advance.test(clause) && !negatedFee.test(clause)) {
      signals.add(SIG_PREPAYMENT);
    }
    const holder = unrelatedHolder.exec(clause);
    if (holder && instructionToPay.test(clause.slice(holder.index + holder[0].length, holder.index + holder[0].length + 32))) {
      signals.add(SIG_THIRD_PARTY_ACCOUNT);
    }
  }
  return signals;
}
