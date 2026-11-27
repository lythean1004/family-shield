import { SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT } from "./signals.js";

const SENTENCES = /(?<=[.!?。…])\s+|[\r\n]+/u;
const SWITCH = /^(?:그와는?\s*별도로|그와는?\s*별개로|한편|별건으로|별도로\s*(?:온|받|연락)|별도\s*(?:거래|계약|문자))/u;
const EXAMPLE = /(?:사기|피싱|피해|사칭)\s*(?:예방|사례|교육|주의)|(?:예방|교육|가상|예시|연습|훈련|강의)\s*(?:용|자료|문구|상황|거래|사례)|(?:대본|극본|시나리오|역할극|교재|문제집|예문|교육\s*퀴즈|수업에서\s*(?:읽|봤|배|설명))|(?:사례|예시)(?:를|로)\s*(?:다룸|다룬|소개|읽|배움)/u;
const REPORTED = /(?:받(?:았|은|고|음)|왔(?:다|어요|습니다|음)|수신|도착|설명|안내|연락|통지|메시지|답변|내용|제시|통보|기재|적혀|써\s*있|라고|라는|라며|라니|다고|다는|다며|하래)/u;
const CLOSED_REQUEST = /(?:거래|접수|정산|결제|납부|환불|지급|요구|요청|안내)(?:가|이|는|은|을|를)?\s*(?:(?:이미|지난번에?|이전에?|모두)\s*)?(?:끝났|끝난|마쳤|마친|완료됐|종료됐|철회됐|취소됐)|(?:요구|요청|안내)(?:는|를|가)?\s*(?:앞으로도\s*)?(?:없|아니)|(?:유효성|효력)(?:이|은)?\s*(?:없|끝났)|(?:요구|요청)(?:을|를|은|는)?\s*(?:철회|취소)했다/u;
const UP_TO_USER = /(?:제가|내가|수신자가)\s*(?:(?:먼저|스스로)\s*)?(?:(?:[\p{L}]+\s+){0,2}[\p{L}]+(?:에게|한테)\s*)?(?:부탁|요구|요청)했|(?:제가|내가|수신자가)\s*(?:스스로|먼저|자발적으로)\s*(?:정했|택했|선택했|제안했)/u;
const NO_PAYMENT = /(?:낼|지불할|입금할|납부할)\s*필요(?:가|는)?\s*없|(?:입금|송금|납부|지불)(?:이|가|은|는)?\s*(?:필요하지\s*않|필수(?:는|가)?\s*아니)|(?:입금|송금|납부|지불)하지\s*(?:말|마)|(?:입금|송금|납부|지불)(?:을|를)?\s*(?:금지|받지\s*않)/u;
const MONEY_OBJECT = /(?:돈|금액|대금|요금|비용|보증금|예치금|선납금|선입금|수수료|(?:입장|수강|가입|등록|대여|접수|신청|이용|관리|처리|확인|예약|참가)비|예약금|부담금|이용료|수강료|계약금|봉사비|등록비|확정비|준비금|본인\s*부담|신청\s*대금)/u;
const PAY_STEM = /(?:입금|납부|납입|송금|이체|지불|결제|내(?:야|면|고|라는|라고|는|도록|기|야만|지)|낸|넣(?:으|고|은|어)|부친|부치(?:고|면|라)|치르(?:고|면|라)|치른|보내(?:고|면|야|라는|라고)|보낸|선납|선입금)/gu;
const OUTCOME = /(?:환불|환급|배정|예약|양도|가능|여부|유무|공석|자리|좌석|매물|물건|품목|상품|확인|공개|열람|조회|대여|지급|정산|출금|수령|당첨|상금|보상|지원금|지원비|답변|안내)/u;
const PAYOUT = /(?:환급|환불|정산(?:금|액)?|지원금|지원비|보상금|장려금|상금|당첨금|판매\s*대금|받을\s*(?:대금|돈)|지급될\s*(?:금액|돈)|돈(?:을)?\s*돌려\s*받|출금(?:액|할|이)|수령할\s*(?:금액|대금|돈))/u;
const AVAILABILITY = /(?:자리|좌석|매물|물건|품목|상품|재고|공석|예약|양도|대여|접수|신청|배정|선정|가능|물량|남아\s*있|있는지|거래)[^.!?\n]{0,16}(?:여부|유무|있는지|남았는지|되는지|가능한지|되는\s*건지|확인)|(?:여부|유무|공석|가능한지|되는지|남았는지|있는지)[^.!?\n]{0,16}(?:공개|열람|조회|알려|알\s*수|답해|안내|확인)/u;
const OFFER_FIRST = /(?:가능|대여|접수|신청|제공|배정|물건|거래|예약|판매)(?:가|이|를|을)?\s*(?:되는지|가능한지|여부|유무|있는지)[^.!?\n]{0,18}(?:먼저\s*)?(?:보려면|알려면|확인(?:하|받으)려면|물어보려면)|(?:여부|유무)(?:를)?\s*(?:확인|공개|알리기|안내)\s*(?:전|에\s*앞서)/u;
const PAYMENT_FIRST = /(?:해야만|하여야만|해야|하여야|하고\s*(?:나서|난\s*뒤)|한\s*(?:뒤|후|다음)|이후|후에|고서|고\s*(?:나서|나야|난\s*(?:뒤|후)|나면)|(?:면|야)\s*(?:비로소|그제야|그때|나중|이후)?|다음|서야|뒤에)/u;
const DISCRETIONARY_REMITTANCE = /(?:별도|추가|따로|별개의?|먼저\s*내라는)\s*(?:비용|수수료|보증금|입금|금액|돈)|(?:수수료|보증금|인증금|예치금|처리비|비용)(?:부터|을|를)?\s*(?:먼저|미리|따로|입금해야|입금하라고|내야|납부해야)|(?:선입금|선납금)/u;
const PRECOMMITMENT = /(?:거래|구입|예약|양도|대여|결제|접수|신청|참여|등록)(?:를|을|가|이)?\s*(?:하기|하기로\s*정하기|할지\s*정하기|여부를\s*확인하기|성사되기|확정되기|하려면|정하기)\s*(?:전|에\s*앞서)|(?:가능한지|되는지|맞는지|있는지|남아\s*있는지|여부|유무)[^.!?\n]{0,20}(?:말해|알려|안내|공개|확인|답변|설명)|(?:가능한지|되는지|맞는지|있는지|여부|유무)(?:도|는|가)?\s*(?:아직|그전에는|그때까지는)\s*(?:알\s*수\s*없|모름|미정)/u;
const PRIOR = /(?:선입금|선납|먼저|미리|앞서|사전|부터|우선|이전에?|하기\s*전)/u;

const CONTRACT_PARTY = /(?:판매자|매도인|임대인|계약자|업체|회사|가게|매장|상점|기관|주최(?:자|측)?|운영(?:자|측)?|법인|사업자|계약상\s*(?:당사자|수납처)|공식\s*(?:계좌|수취인)|거래\s*(?:상대|당사자|업체|(?:하는|할|한)\s*(?:사람|이|분))|거래처|연락한\s*(?:곳|사람)|계약한\s*(?:곳|사람)|거래를\s*맺은\s*(?:곳|사람)|발행처|접수처|처리처|서비스를?\s*(?:제공|운영)하는\s*(?:곳|사람))/u;
const MISMATCH = /(?:다르|다른|달라|별개의?|일치하지\s*않|관계(?:가)?\s*없|관계없는|무관|아니(?:라|고)|대신|이외|아닌|엇갈)/u;
const HOLDER_ROLE = "(?:개인(?:\\s*명의)?|제\\s*[삼3]자|다른\\s*(?:사람|이름|명의|수취인|예금주)|(?:관계자|직원|담당자|지인|대표|가족|친구)(?:의)?\\s*(?:명의|이름))";
const ACCOUNT_OF_OTHER = HOLDER_ROLE + "(?:의)?\\s*(?:계좌|통장)";
const PAY_ROUTE_LABEL = "(?:입금처|납부처|송금처|수납처|수취\\s*계좌|받을\\s*(?:계좌|통장))";
const DIRECTED_OTHER_ROUTE = new RegExp(
  ACCOUNT_OF_OTHER + "(?:로|으로|에)\\s*(?:(?:별도로|직접|먼저)\\s*)?(?:(?:대금|금액|돈)(?:을|를)?\\s*)?(?:받|모아|보내|입금|송금|이체|납부|부치|넣)" +
    "|" + ACCOUNT_OF_OTHER + "(?:가|를|은|는)?\\s*(?:(?:대금|금액|돈|실제)(?:의)?\\s*)?" + PAY_ROUTE_LABEL +
    "|" + PAY_ROUTE_LABEL + "(?:가|이|은|는|[:：])?\\s*" + ACCOUNT_OF_OTHER +
    "|(?:대금(?:의)?|(?:입금|납부|송금|이체)할)\\s*(?:수취인|예금주|받는\\s*사람)(?:이|은|는|[:：])\\s*" + HOLDER_ROLE,
  "gu",
);
const CONFIRMATION_FIRST = new RegExp(
  "(?:확인|승인|선정|확정)(?:하기)?\\s*(?:전|이전)(?:에는|엔|에)?[^,.!?\\n]{0,20}" + MONEY_OBJECT.source +
    "(?:을|를|이|가|은|는)?\\s*(?:(?:받|내|걷)지|청구하지)\\s*않|" +
    "(?:승인|확정|선정|거래\\s*성립)(?:된|한|이|을)?\\s*(?:후|뒤|다음|이후)(?:에만|에|부터|만)?\\s*(?:납부|입금|결제|지불)",
  "u",
);
const REVERSE_OR_AUTHORIZED = /(?:환불|환급|반환)(?:받을|을\s*받|받는|받고|금의?\s*수취|지급\s*수취)|(?:제|내|수신자의|신청인의|민원인의)\s*(?:개인\s*)?(?:계좌|통장|명의)|(?:공식|정식|승인받은|지정받은|공인|등록된)\s*(?:수납|대행|결제|중개)|(?:허용|승인|동의했)(?:된|던|다는)?\s*(?:개인|계좌|수취인)/u;

function currentlyReported(text) {
  return REPORTED.test(text) && !UP_TO_USER.test(text) && !CLOSED_REQUEST.test(text);
}

function paymentBeforeOutcome(text) {
  if (!currentlyReported(text) || NO_PAYMENT.test(text) || CONFIRMATION_FIRST.test(text) || !(MONEY_OBJECT.test(text) || /(?:입금|송금|납부|이체|지불)(?:하(?:고|면|여야)|한\s*(?:뒤|후)|해야|부터|이후)/u.test(text))) return false;
  for (const action of text.matchAll(PAY_STEM)) {
    const before = text.slice(Math.max(0, action.index - 64), action.index);
    const after = text.slice(action.index, action.index + 82);
    const temporal = PAYMENT_FIRST.test(after.slice(0, 32)) || PRIOR.test(before.slice(-20));
    if (!temporal && !OFFER_FIRST.test(before)) continue;
    if (/(?:과거|이전에는)/u.test(before) || /^(?:입금|납부|이체|송금|지불)(?:이|은|는)?\s*(?:완료|마침)(?:되|했|됐|됨)/u.test(after)) continue;
    if (OFFER_FIRST.test(before) || (AVAILABILITY.test(after) || PRECOMMITMENT.test(after) || PAYOUT.test(before + " " + after) && DISCRETIONARY_REMITTANCE.test(before + " " + after)) &&
        OUTCOME.test(after) && !/(?:이미|모두)\s*(?:가능|확정|승인|알려)/u.test(before)) return true;
  }
  return false;
}

const ORIGINAL_RECIPIENT = /(?:거래(?:를)?\s*(?:상대|당사자|업체|(?:하고\s*있는|하는|한|할)\s*(?:상대|사람|이|분))|(?:판매|공급|계약)\s*(?:당사자|주체|상대)|이용자가\s*거래한\s*(?:곳|업체|사람))/u;
const INDIVIDUAL_DESTINATION = /(?:자기|자신|그쪽|중개\s*측)(?:의)?\s*(?:[가-힣]{1,8}\s*)?(?:직원|담당자|지인|가족)(?:의)?\s*(?:개인\s*)?(?:명의|이름)\s*(?:계좌|통장)(?:로|으로|에)\s*(?:대금(?:을)?\s*)?(?:받아|받겠|받(?:기로|을)|모아|보내|입금|송금)/u;
const AHEAD_OF_CONFIRMATION = /(?:(?:확인|문의|열람|검토)(?:을|를)?\s*(?:하기|받기|하라기)?\s*(?:전|에\s*앞서)|(?:입금|돈을\s*낸|납부|대금을\s*보낸|지불)(?:을\s*한)?\s*(?:이후|후에|한\s*뒤|하고\s*나서|뒤에)\s*(?:(?:만|비로소|그제야|그때부터)\s*)?(?:확인|문의|열람|검토)|(?:이후|나중|그제야|그때부터)\s*(?:확인|문의|열람|검토)(?:만|이|가|을|를)?\s*(?:가능|허용|할\s*수|받을\s*수))/u;
const UPFRONT_DEMAND = /(?:선입금|선납|선결제|사전\s*(?:결제|입금|지불|납부))[^.!?\n]{0,12}(?:요구|요청|조건|지시|필수|강요|없으면|있어야)|(?:요구|요청|조건|지시|필수|강요)[^.!?\n]{0,12}(?:선입금|선납|선결제)/u;
const HARD_STATUS = /(?:예약|거래|자리|물건|배정|자격|접수|계약|참여|선정|이용|대여)(?:를|을|이|가|의)?\s*(?:가능|가능한지|여부|그\s*여부|유무|되는지|성사|확정|하기\s*전)/u;
const ordinaryInvoice = /(?:정해진|이미\s*(?:확정|안내|선택)|선택한|완료된|완료\s*후)\s*(?:거래|결제|납부|예약|상품)|(?:영수증|세금계산서|결제\s*내역|예약\s*확인서)(?:만|를|을)?\s*(?:확인|조회|열람)/u;
const verificationAfterPayment = /(?:입금|납부|송금|이체|지불)(?:을|를)?\s*(?:한\s*(?:뒤|후|다음)|하고\s*(?:나서|난\s*뒤)|이후|후에|뒤에)(?:에|만|에만|에야)?\s*[^,，;；.!?\n]{0,10}(?:신원|본인|진위|유효성|실재\s*여부|정식\s*여부)[^,，;；.!?\n]{0,8}(?:확인|검증)/u;
const switchedFee = /(?:그와는?|이와는?)?\s*별개로|별도로\s*(?:온|받은|알린)|한편|다른\s*(?:거래|업무|행사|신청|계약|예약)/u;
const completedVerification = /^\s*(?:을|를|은|는|이|가)?\s*(?:이미\s*)?(?:완료했|끝냈|마쳤|됐|되었|했습니다|했어요|한\s*뒤)/u;
const noAdvanceDemand = /(?:요구|요청|조건|안내)(?:을|를|은|는|이|가)?\s*(?:한\s*(?:적|사실)(?:이|은)?\s*)?(?:실제로\s*)?(?:없|아니|진행되지\s*않)/u;
const closedAdvanceDemand = /^(?:[이가은는])?\s*(?:(?:적혀|실려|기재돼|기록돼)\s*)?(?:있었|했)(?:지만|는데|고)\s*[,，]?\s*(?:(?:지금|현재)(?:은|는)?\s*)?(?:(?:그|이|해당)\s*)?(?:안내|요청|요구|절차|접수)(?:을|를|은|는|이|가)?\s*(?:이미\s*)?(?:종료|종결|철회|취소|중단|완료)(?:했|하였|됐|되었)/u;
function demandsPaymentBeforeVerification(clause) {
  const gate = verificationAfterPayment.exec(clause);
  if (!gate || NO_PAYMENT.test(clause) || CLOSED_REQUEST.test(clause) ||
      ordinaryInvoice.test(clause) || CONFIRMATION_FIRST.test(clause) || UP_TO_USER.test(clause)) return false;
  const after = clause.slice(gate.index + gate[0].length);
  const demand = UPFRONT_DEMAND.exec(after);
  if (!demand || completedVerification.test(after) || switchedFee.test(after) || noAdvanceDemand.test(after)) return false;
  return !closedAdvanceDemand.test(after.slice(demand.index + demand[0].length));
}
function reportedUpfrontGate(text) {
  return currentlyReported(text) && !NO_PAYMENT.test(text) && !CONFIRMATION_FIRST.test(text) && !ordinaryInvoice.test(text) &&
    UPFRONT_DEMAND.test(text) && AHEAD_OF_CONFIRMATION.test(text) && HARD_STATUS.test(text);
}
const CONTRACTOR_OWN_ACCOUNT = /(?:계약자|계약\s*당사자|판매자|매도인|임대인|거래\s*(?:상대|당사자))(?:의)?\s*(?:본인|자신)(?:의)?\s*$/u;

function hasDirectedOtherRoute(clause) {
  return [...clause.matchAll(DIRECTED_OTHER_ROUTE)].some(route =>
    !CONTRACTOR_OWN_ACCOUNT.test(clause.slice(Math.max(0, route.index - 32), route.index)));
}

function routedToOtherParty(text) {
  if (!currentlyReported(text) || NO_PAYMENT.test(text) || REVERSE_OR_AUTHORIZED.test(text) || /(?:말|부탁|요청|요구)(?:은|는|이|가)?\s*(?:실제로\s*)?없었/u.test(text)) return false;
  // 같은 송금 안내에서 원래 거래 상대와 별개 수취인이 함께 확인되는 경우만 더한다.
  return text.split(/[,，;；](?=\s*(?:그리고|별도로|한편|그런데|이어서))/u).some(clause =>
    CONTRACT_PARTY.test(clause) && MISMATCH.test(clause) && hasDirectedOtherRoute(clause));
}

export function addReportedTransactionConditions(text, signals) {
  const clauses = text.split(SENTENCES).map(value => value.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    const prior = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    if (CLOSED_REQUEST.test(prior) && /^(?:당시|그때|예전에|지난번|그때의|과거)/u.test(clause)) continue;
    const context = !SWITCH.test(clause) && !CLOSED_REQUEST.test(prior) ? prior + " " + clause : clause;
    if (EXAMPLE.test(context) || EXAMPLE.test(next) && !SWITCH.test(next)) continue;
    if (paymentBeforeOutcome(clause) || paymentBeforeOutcome(context)) signals.add(SIG_PREPAYMENT);
    if (reportedUpfrontGate(context) || demandsPaymentBeforeVerification(clause)) signals.add(SIG_PREPAYMENT);
    if (routedToOtherParty(clause) || currentlyReported(context) && !NO_PAYMENT.test(context) && !REVERSE_OR_AUTHORIZED.test(context) &&
        ORIGINAL_RECIPIENT.test(prior) && MISMATCH.test(prior) && INDIVIDUAL_DESTINATION.test(clause)) {
      signals.add(SIG_THIRD_PARTY_ACCOUNT);
    }
  }
}