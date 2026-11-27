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

const basicOfferInformation = /(?:물품|상품|물건|매물)(?:의)?\s*(?:상태|진위|실물)|실물|(?:약정|계약|이용|거래)(?:의)?\s*(?:세부|기본|구체적)?\s*(?:조건|정보|약관)|(?:예약|가입|참가|대여|거래)\s*(?:가능\s*여부|가능한지|유무)/u;
const withholding = /(?:비로소|그제야|서야|이후에만|한\s*뒤에만|전에는|보기\s*전|전에)\s*/u;
const showsOrDiscloses = /(?:보여\s*(?:주|준|줄)|확인할\s*수|알려\s*주|알\s*수|설명(?:해\s*주|을\s*들|을\s*받|한다|해준다)|공개(?:하|되)|열람(?:하|할))/u;
const obligationBefore = /(?:내야|부쳐야|보내야|납부해야|지불해야|결제해야|입금해야|송금해야|이체해야|(?:보내|입금하|납부하|지불하|송금하|이체하|치르)고\s*(?:나서야|나야)|(?:입금|납부|지불|송금|이체|결제)\s*(?:이후에만|한\s*뒤에만))/u;
const establishedPrice = /(?:이미\s*(?:정해진|공개된|확정된|확인한|계약한)|확정(?:된|한))\s*(?:예약|거래|계약|견적|조건|물건)|(?:영수증|결제\s*내역|세금\s*계산서)(?:만|을|를)?\s*(?:확인|조회|열람)/u;

function paymentBeforeBasicInformation(clause, context) {
  if (!currentlyReported(context) || NO_PAYMENT.test(clause) || CONFIRMATION_FIRST.test(clause) ||
      establishedPrice.test(context) || !basicOfferInformation.test(clause)) return false;
  const payment = obligationBefore.exec(clause);
  if (!payment || !MONEY_OBJECT.test(clause.slice(Math.max(0, payment.index - 32), payment.index + payment[0].length))) return false;
  const after = clause.slice(payment.index + payment[0].length);
  return (withholding.test(after) || /(?:서야|나야|에만)$/u.test(payment[0])) &&
    showsOrDiscloses.test(after);
}

const currentPaymentDirective = /(?:비용|돈|금액|대금|요금|수수료)(?:을|를)?\s*(?:입금|납부|송금|이체|지불|결제)(?:하라는|하라고|하도록|할\s*것을|해\s*달라는|해야\s*한다는)[^.!?\n]{0,16}(?:요구|요청|안내|통보|설명|내용)|(?:입금|납부|송금|이체|지불|결제)(?:하라는|하라고|하도록|해\s*달라는)[^.!?\n]{0,12}(?:요구|요청|통보)|(?:비용|금액|대금|요금|수수료)(?:의)?\s*(?:입금|납부|송금|이체|지불|결제)(?:를|을|의)?\s*(?:요구|요청|지시)/u;
const namedPaymentAccount = /(?:입금|납부|송금|이체|지불|수납)할\s*(?:계좌|통장|곳)|(?:비용|돈|대금|요금|금액)(?:을|를)?\s*(?:받을|받는)\s*(?:계좌|통장)|(?:입금처|수납처|납부처|수취\s*계좌)|(?:그|해당)\s*(?:계좌|예금주)/u;
const displayedDifferentHolder = /(?:업체|회사|사업자|판매자)(?:로|가|의)?[^.!?\n]{0,18}(?:표시|기재|적힌)[^.!?\n]{0,16}(?:다른\s*사람|다른\s*개인)(?:의)?\s*(?:명의|이름)(?:의|로)?\s*(?:계좌|통장)/u;
const adjoiningAccountField = /(?:^|[\s,，])(?:해당\s*|그\s*)?(?:계좌|통장|예금주)(?:의|는|이|가|에는|에|란|\s*[:：])\s*[^.!?\n]{0,48}(?:명의|이름|사람|개인)/u;
const accountDocument = /(?:명의|예금주|계좌\s*주인|계좌주)(?:는|은|이|가|로|의)?|(?:명의|예금주|계좌주)\s*(?:표시|기재|적힌)/u;
const outsider = /(?:거래|계약)(?:의)?\s*(?:상대|업체|당사자)(?:와|과)(?:는)?\s*(?:무관한|관계(?:가)?\s*없는|다른)\s*(?:사람|이|개인)|(?:업체|회사|판매자|사업자)(?:의)?\s*(?:이름|명의)?(?:과는?|와는?)\s*(?:무관한|관계(?:가)?\s*없는|다른)\s*(?:사람|개인)|(?:계약|거래)(?:\s*(?:상대|업체|당사자))?(?:와는?|과는?)\s*(?:무관하|관계가\s*없|관계\s*없)|(?:업체|회사|사업자|계약\s*상대|거래\s*상대)(?:의)?\s*(?:(?:명의|이름)(?:이|가)?\s*)?(?:아니라|아닌|대신|와\s*다른|과\s*다른)\s*(?:다른\s*)?(?:사람|개인)/u;

function mismatchInContinuation(prior, clause, context) {
  if (!prior || CLOSED_REQUEST.test(context) || SWITCH.test(clause) || NO_PAYMENT.test(context) ||
      EXAMPLE.test(context) || REVERSE_OR_AUTHORIZED.test(context)) return false;
  if (!currentPaymentDirective.test(prior) && !(MONEY_OBJECT.test(prior) && accountDirective.test(prior))) return false;
  if (displayedDifferentHolder.test(clause)) return true;
  return (namedPaymentAccount.test(clause) || adjoiningAccountField.test(clause)) && accountDocument.test(clause) && outsider.test(clause) &&
    !CONTRACTOR_OWN_ACCOUNT.test(clause);
}
const assignedPersonalAccount = /(?:입금|납부|송금|이체)(?:할|하라고|하라는|을|의|은|는|처|대상)?[^.!?\n]{0,26}(?:제\s*[삼3]자|거래(?:와|과)\s*무관한\s*사람)(?:의)?\s*(?:개인\s*)?(?:(?:명의|이름)(?:의|인|자(?:의)?|로)?\s*)?(?:계좌|통장)|(?:제\s*[삼3]자|거래(?:와|과)\s*무관한\s*사람)(?:의)?\s*(?:개인\s*)?(?:(?:명의|이름)(?:의|인|자(?:의)?|로)?\s*)?(?:계좌|통장)(?:를|로|으로|에)?[^.!?\n]{0,22}(?:입금|납부|송금|이체)/u;
const accountDirective = /(?:요구|요청|지시)(?:사항|항목|대상|조건|내용|은|는|이|가|로)?[^.!?\n]{0,40}(?:계좌|통장)(?:로|으로|에)?[^.!?\n]{0,11}(?:입금|납부|이체|송금)|(?:입금|납부|송금|이체)(?:을|를)?\s*(?:요구|요청|지시|하라고|하라는)|(?:계좌|통장)(?:를|을|로|으로|에)?[^.!?\n]{0,20}(?:요구|요청|지시)/u;
const inconsistentTradeHolder = /(?:거래|계약)[^.!?\n]{0,12}(?:무관|관계가\s*없|관련이\s*없)[^.!?\n]{0,10}(?:명의|예금주)|(?:거래|계약)(?:와|과|(?:\s*(?:상대|당사자))?(?:와|과))\s*(?:무관한|무관하다고|관계(?:가)?\s*없는|관련(?:이)?\s*없는)\s*(?:사람(?:의)?\s*)?(?:명의|예금주)|(?:계약|거래)(?:[가-힣\s]{0,14})(?:명의|계약자|당사자|예금주)(?:과|와|가|는|이|은)?\s*(?:서로\s*)?(?:다르|별개|일치하지\s*않|같지\s*않|아닌|아니라)|(?:명의|예금주)(?:가|는|은|이)?[^.!?\n]{0,18}(?:계약|거래)[^.!?\n]{0,12}(?:다르|별개|일치하지\s*않|관련\s*없|무관)|(?:계약|거래)[^.!?\n]{0,28}(?:명의|예금주)[^.!?\n]{0,14}(?:는|은|이|가)?\s*(?:없|상이|무관)/u;

function explicitlyReassignedAccount(clause, next, context) {
  if (!currentlyReported(context) || NO_PAYMENT.test(context) || REVERSE_OR_AUTHORIZED.test(context + " " + next) ||
      !assignedPersonalAccount.test(clause) || !accountDirective.test(clause)) return false;
  return !SWITCH.test(next) && !EXAMPLE.test(next) && !CLOSED_REQUEST.test(next) &&
    !NO_PAYMENT.test(next) && inconsistentTradeHolder.test(next);
}
const assigningParty = /(?:일감|일거리|일|작업|업무|과업|용역)(?:을|를)?\s*(?:(?:맡긴|맡기는|맡긴다는|맡기겠다는|맡긴다고\s*한|맡기려는|의뢰한|발주한|배정한|배정하겠다는)\s*(?:쪽|곳|사람|측|업체|회사|발신자|상대|의뢰인|발주처))|(?:발주처|발주자|발주사|외주\s*업체|고용주)(?:가|에서|가\s*보낸|의|쪽)?/u;
const gateBeforeWork = /(?:작업|업무|일감|일거리|일을?|과업|용역|근무)(?:이|가|을|를)?\s*(?:(?:시작|착수|진행|개시|배정|할당)(?:되기|받기|하기|할|되는\s*일|되기|하기|이)?\s*(?:전|이전|에\s*앞서)|(?:받기|맡기|배정받기|할당받기)\s*(?:전|이전))/u;
const explicitWorker = /(?:제가|내가|저는|저에게|제게|수신자(?:가|에게|는)?|작업자(?:인|가|는|에게)|수행자(?:인|가|는|에게)|일을\s*맡는\s*(?:사람|쪽)(?:이|가|은|는)?|일(?:을)?\s*받는\s*(?:사람|쪽)(?:이|가|은|는)?)/u;
const workerSubject = /(?:제가|내가|저는|작업자(?:가|는)|수행자(?:가|는)|수신자(?:가|는))\s*$/u;
const fromAssigningParty = /(?:쪽|곳|사람|업체|회사|상대|발신자|발주처|발주자|의뢰인)(?:에서|로부터|에게서|이\s*보낸|가\s*보낸|에게\s*받은|이\s*제시한|의\s*(?:안내|답신|연락|문자))/u;
const workerFee = /(?:돈|비용|수수료|보증금|등록비|처리비|착수비|예치금|신청비|참가비|금액)(?:를|을|은|는|부터|까지)?\s*(?:(?:제가|내가|저는|작업자가|수행자가)\s*)?(?:(?:먼저|따로|미리|별도로|부담해|직접)\s*){0,3}(?:내야|(?:입금|납부|송금|이체|지불|결제)해야|(?:입금|납부|송금|이체|지불|결제)하라는|(?:내|납부해|보내|송금해)\s*달라)/u;
const evidenceOfWorkerPayment = /(?:(?:제가|내가|저는)\s*)?(?:(?:실제로|아직|일단|그대로)\s*)?(?:내지\s*않았|납부하지\s*않았|입금하지\s*않았|안\s*냈|냈는지|낸\s*적|냈다고|냈는데|냈|내진\s*않았)/u;
const paysWorker = /(?:발주(?:자|처|사)|업체|의뢰인|가게|회사)(?:가|에서|는|은)[^.!?\n]{0,35}(?:작업자|수행자|제게|저한테|저에게|내게)[^.!?\n]{0,22}(?:돈|선금|착수금|보수|대금|재료비|지원금|급여|건네|주기로|지급|송금)|(?:제게|저에게|작업자에게|수행자에게)\s*(?:선금|착수금|재료비|지원금|보수)(?:을|를)?\s*(?:보내|주|건네|지급)/u;
const ownPreparation = /(?:스스로|자체|자비로|제가\s*직접|각자)\s*(?:구매|구입|준비)|(?:장비|재료|부품|소모품)(?:을|를)?\s*(?:직접|제가|스스로|자비로)?\s*(?:구매|구입)|(?:수강료|교재비|정규\s*수업)/u;

function workerPaysBeforeAssignment(clause, context) {
  if (!currentlyReported(context) || NO_PAYMENT.test(context) || paysWorker.test(context) ||
      ownPreparation.test(context) || !assigningParty.test(context) || !gateBeforeWork.test(clause)) return false;
  const before = gateBeforeWork.exec(clause);
  const following = clause.slice(before.index + before[0].length);
  if (!workerFee.test(following)) return false;
  // 일을 맡긴 쪽이 발신자이고 수신자가 지불 주체라고 본문에서 알 수 있는 경우만 결합한다.
  return explicitWorker.test(following) || workerSubject.test(clause.slice(0, before.index)) ||
    fromAssigningParty.test(context) && /(?:문자|안내|연락|답장|답신|통보|메시지)/u.test(context) &&
      evidenceOfWorkerPayment.test(following);
}

const designatedPayee = /(?:요청|지정|통지|고지|안내|제시)(?:된|한|하는|받은)?\s*(?:실제\s*)?(?:입금|납부|지불|송금|이체)\s*(?:대상|수취인|받는\s*계좌|받을\s*계좌|처)|(?:입금|납부|지불|송금|이체)(?:하라고\s*지정한|하도록\s*지정한|하라고\s*한|해야\s*할)\s*(?:수취\s*)?(?:대상|계좌|통장|수취인|납부처|곳)|(?:입금|납부|송금|이체)\s*(?:대상|수취인|납부처|받을\s*계좌)(?:으로|로|에)\s*(?:지정(?:된|한)|기재(?:된|한)|요청(?:된|한))/u;
const otherOwnedAccount = /(?:거래(?:와|과)?\s*)?(?:무관한|관련(?:이)?\s*없는|참여하지\s*않은)?\s*(?:제\s*[삼3]자|다른\s*사람|타인)(?:의)?\s*(?:(?:개인\s*)?(?:명의|이름)(?:의|인|의\s*)?(?:\s*(?:계좌|통장))?|(?:개인\s*)?(?:계좌|통장))|(?:제\s*[삼3]자|다른\s*사람|타인)(?:이|가|이며|이고)\s*(?:그|해당|그\s*사람)(?:의)?\s*(?:개인\s*)?명의(?:의)?\s*(?:계좌|통장)/u;
const excludesContractParty = /(?:판매자|공급자|계약(?:의)?\s*(?:상대|당사자|업체)|거래(?:의)?\s*(?:상대|당사자|업체)|업체|회사)(?:는|가|이|의|와|과)?\s*(?:(?:등록된|실제|기존의?)\s*)?(?:아닌|아니라|아니고|대신|무관|관련(?:이)?\s*없|관계(?:가)?\s*없|관계(?:가)?\s*없(?:는|어))|(?:계약|거래)(?:에|와|과)?\s*(?:참여하지\s*않은|무관한|관계(?:가)?\s*없는|관련(?:이)?\s*없는)/u;
const examplePayee = /(?:이름|명의|번호|유형|형식|표기)\s*(?:만|의\s*예)|(?:계좌|통장|수취인)(?:의)?\s*(?:예시|견본|시험\s*값|자료용)|(?:받을|받는|수령할)\s*(?:환급|환불|반환|돌려받을)/u;

function namedPaymentToOutsider(clause, context) {
  if (NO_PAYMENT.test(context) || CLOSED_REQUEST.test(context) || REVERSE_OR_AUTHORIZED.test(context) ||
      examplePayee.test(clause)) return false;
  const target = designatedPayee.exec(clause);
  if (!target) return false;
  // 돈을 받을 사람이나 계좌를 지정한 같은 절에서만 계약 상대와 실제 명의를 비교한다.
  const recipient = clause.slice(target.index + target[0].length);
  return otherOwnedAccount.test(recipient) && excludesContractParty.test(recipient);
}

const counterpartyIdentityCheck = /(?:거래\s*상대|계약\s*(?:당사자|상대)|상대(?:방)?)(?:가|이)?\s*[^.!?\n]{0,12}(?:맞는지|본인인지|누구인지|정식인지|계약(?:자|당사자)인지|업체인지)[^.!?\n]{0,16}확인/u;
const noOpportunityToCheck = /확인(?:할|하는|을)?[^.!?\n]{0,20}(?:(?:주지|알려주지|제공하지|마련하지|열어주지|허용하지|허락하지)\s*않|못\s*하게|할\s*수\s*없도록)/u;
const startsCounterpartyCheck = /^(?:(?:그|이|해당)\s*)?(?:신원\s*|계약\s*상대\s*)?확인(?:을|은|부터|도)?\s*(?:(?:절차|방법)(?:를|을|은|도)?\s*)?(?:시작|하려면|받으려면)/u;
const moneyRequiredForCheck = /(?:돈|비용|금액|수수료|예치금)(?:을|를|부터)?\s*(?:(?:먼저|별도로|미리)\s*)?(?:입금|납부|송금|이체|지불)해야[^.!?\n]{0,13}(?:조건|전제|요구|요청|필수)/u;
const realPaymentOwnerDifference = /(?:돈|대금|비용|금액)(?:을|를)?\s*(?:받(?:는|을)|보낼|넣을|입금할|납부할)\s*(?:계좌|통장)(?:의)?\s*(?:주인|명의|예금주)(?:은|는|이|가)?[^.!?\n]{0,16}(?:다르|다른|달라|일치하지\s*않|상이)/u;
const paymentToNonparty = /(?:(?:계약|거래)\s*)?(?:상대(?:방)?|당사자|판매자)(?:가|이|은|는)?\s*(?:아닌|아니라|이외의)\s*(?:다른\s*사람|사람|개인)(?:의)?\s*(?:계좌|통장)(?:로|으로|에)(?:만|다가)?/u;
const putMoneyInAccount = /(?:넣(?:으라(?:고|는)?|으란|으래|어야|어\s*달라(?:고|는)?|을\s*(?:것|걸)(?:로)?)|(?:보내|입금하|납부하|송금하|이체하)(?:라(?:고|는)|야|도록))[^.!?\n]{0,12}(?:요구|요청|지시)/u;
const notMovingMoney = /(?:자료|서류|사진|사본|계좌\s*번호|계좌\s*정보|메모|기록|서식|양식|장부|문서|내용|수치|봉투|상자)(?:를|을|에|에는|으로|로)|(?:말고|대신|않|금지)/u;

const samePaymentDemandEnded = /^(?:그|해당|같은|이)\s*(?:입금\s*|송금\s*|납부\s*|지불\s*)?(?:요구|요청|조건|지시)(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:(?:발신자|발신인|상대)(?:가|이)\s*)?(?:취소|철회)(?:됐|되었|했|하였)/u;
function bindsPaymentBeforeCounterpartyCheck(previous, clause, context, following) {
  return !SWITCH.test(clause) && !CLOSED_REQUEST.test(context) && !NO_PAYMENT.test(context) &&
    !CLOSED_REQUEST.test(previous) && !CONFIRMATION_FIRST.test(context) && !samePaymentDemandEnded.test(following) &&
    counterpartyIdentityCheck.test(previous) && noOpportunityToCheck.test(previous) &&
    startsCounterpartyCheck.test(clause) && moneyRequiredForCheck.test(clause);
}

function bindsOtherOwnerToPayment(previous, clause, context, following) {
  if (SWITCH.test(clause) || NO_PAYMENT.test(context) || CLOSED_REQUEST.test(context) ||
      REVERSE_OR_AUTHORIZED.test(context) || samePaymentDemandEnded.test(following) ||
      CLOSED_REQUEST.test(previous) || !realPaymentOwnerDifference.test(previous)) return false;
  const destination = paymentToNonparty.exec(clause);
  if (!destination) return false;
  const instruction = clause.slice(destination.index + destination[0].length);
  const move = putMoneyInAccount.exec(instruction);
  return Boolean(move && move.index <= 12 && !notMovingMoney.test(instruction.slice(0, move.index)));
}

const otherPersonOwnsAccount = /다른\s*(?:사람|이|개인|담당자|직원)(?:의)?\s*(?:명의|이름)(?:의|인|로)?\s*(?:계좌|통장)(?=\s|[,.!?]|[은는이가을를로에]|으로|$)/u;
const previouslyReportedAccount = /^(?:이미\s*(?:받(?:은|았던)|안내(?:한|된|받은)|제시(?:한|된)|지정(?:한|된)|적(?:힌|은|어\s*둔)|확인(?:한|된)|표시(?:된|한)|보낸|고지(?:한|된)|기재(?:된|한)|언급(?:한|된)|알려\s*준))\s*/u;
const theAccountJustNamed = /^(?:그|이|해당|같은)\s*(?:(?:안내|기록|문자)(?:에|에서)\s*(?:적힌|제시한|표시한|나온)\s*)?(?:계좌|통장)(?:에는|에서|의|은|는|이|가)(?=\s|$)/u;
const despiteExistingAccount = /^본인\s*(?:계좌|통장)(?:가|이|는|은)\s*(?:따로\s*)?(?:있는데도|있음에도(?:\s*불구하고)?)(?=\s|[,，])/u;
const checksPastInstructions = /(?:요청|요구|지시)(?:의)?\s*(?:유무|여부)|(?:기록|내역)(?:을|를|에서)?\s*(?:검색|조회|대조)/u;
const independentPaymentAccount = /(?:다른|별도|새로운|추가)\s*(?:거래|계약|계좌|통장)/u;
const unrelatedHumanPayee = /(?:거래|계약)\s*(?:상대(?:방)?|당사자|업체)(?:가|이|은|는)?\s*(?:아닌|아니라)\s*(?:(?:(?:다른|그|한|낯선)\s*)?(?:사람|이|개인|직원|인물|담당자|분)|타인|제\s*[3삼](?:자|의\s*(?:사람|인물)))(?:에게|한테|께|쪽으로)/u;

function bindsNamedAccountToAnotherPayee(prior, clause, context, next) {
  if (SWITCH.test(clause) || CLOSED_REQUEST.test(context) || NO_PAYMENT.test(context) ||
      REVERSE_OR_AUTHORIZED.test(context + " " + next) || samePaymentDemandEnded.test(next) ||
      (!MONEY_OBJECT.test(prior) && !/(?:결제|입금|이체|송금|납부)/u.test(prior)) ||
      !otherPersonOwnsAccount.test(prior) || checksPastInstructions.test(clause)) return false;
  const statedEarlier = previouslyReportedAccount.exec(clause);
  const fromReference = statedEarlier ? clause.slice(statedEarlier[0].length) : clause;
  // 본인 통장이 따로 있다고 대조한 경우에는 뒤에 지목한 타인이 실제 수취인이다.
  const account = statedEarlier
    ? despiteExistingAccount.exec(fromReference) ?? /^(?:계좌|통장)(?:의|은|는|이|가)(?=\s|$)/u.exec(fromReference)
    : theAccountJustNamed.exec(fromReference);
  if (!account || independentPaymentAccount.test(clause)) return false;
  const direction = fromReference.slice(account[0].length);
  const payee = unrelatedHumanPayee.exec(direction);
  if (!payee) return false;
  const after = direction.slice(payee.index + payee[0].length);
  const directive = putMoneyInAccount.exec(after);
  return Boolean(directive && directive.index <= 12 && !notMovingMoney.test(after.slice(0, directive.index)));
}

const feeForCheckingDeal = /(?:거래|계약)(?:을|를|의)?\s*(?:확인|검증)(?:하기\s*위한|을\s*위한|용)?\s*(?:비용|수수료|부담금|확인료|검증비)/u;
const mustPayVerificationFee = /^(?:을|를|부터)?\s*(?:(?:먼저|미리|따로|별도로)\s*)?(?:내야|(?:입금|이체|송금|납부|지불)해야)(?:만)?/u;
const continuesAfterVerificationFee = /^(?:[,，]\s*)?(?:(?:그제야|비로소|그때부터|다음에)\s*)?(?:(?:해당|그|본|실제|실)\s*)?(?:거래|계약|절차)(?:를|을|이|가)?\s*(?:진행|계속|시작|이어)(?:(?:할|갈)\s*(?:수|조건)|한다|되는|할\s*때|된다|갈\s*수|가게|진행)/u;
const earlierVerificationCondition = /(?:거래|계약|절차)(?:를|을|이|가)?\s*(?:진행|계속|시작|이어가)(?:하)?기?\s*(?:위한|위해|위해서|하려는)\s*(?:전제|조건)(?:이|가|은|는|[:：])?/u;
const ordinaryVerificationService = /(?:선택\s*사항|필수(?:가|는)?\s*아니|조건(?:은|는|이|가)?\s*아니|내지\s*않아도|납부하지\s*않아도)|(?:법정|공식\s*공시|기존\s*계약으로\s*확정된|이미\s*확인한)\s*[^.!?\n]{0,12}(?:수수료|비용|계약)/u;

const potentiallyPayingSeller = /(?:업체|회사|판매자|발주자|상대(?:방)?)(?:가|이|은|는)(?=\s|$)/u;
const imposesVerificationCondition = /(?:조건|전제)(?:을|를)\s*(?:[\p{L}]{1,5}\s+)?(?:내걸|내밀|붙였|걸었|내놨|제시했|요구했)/u;
const explicitlyPaysOwnFee = /(?:자기|자신|회사|업체)(?:가|이|의)?\s*(?:직접|스스로|부담할|부담하는|별도\s*부담)/u;

function requiresVerificationFeeBeforeContinuing(clause, context, next) {
  if (!currentlyReported(context) || NO_PAYMENT.test(context) || CONFIRMATION_FIRST.test(context) ||
      ordinaryInvoice.test(context) || ordinaryVerificationService.test(context) ||
      paysWorker.test(context) || samePaymentDemandEnded.test(next)) return false;
  const fee = feeForCheckingDeal.exec(clause);
  if (!fee) return false;
  const before = clause.slice(0, fee.index);
  if (explicitlyPaysOwnFee.test(before) ||
      potentiallyPayingSeller.test(before) && !imposesVerificationCondition.test(clause) && !explicitWorker.test(before)) return false;
  const paymentAndOutcome = clause.slice(fee.index + fee[0].length);
  const payment = mustPayVerificationFee.exec(paymentAndOutcome);
  if (!payment) return false;
  return continuesAfterVerificationFee.test(paymentAndOutcome.slice(payment[0].length).trimStart()) ||
    earlierVerificationCondition.test(before);
}

export function addReportedTransactionConditions(text, signals) {
  const clauses = text.split(SENTENCES).map(value => value.trim()).filter(Boolean);
  for (const [index, clause] of clauses.entries()) {
    const prior = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    if (CLOSED_REQUEST.test(prior) && /^(?:당시|그때|예전에|지난번|그때의|과거)/u.test(clause)) continue;
    const context = !SWITCH.test(clause) && !CLOSED_REQUEST.test(prior) ? prior + " " + clause : clause;
    if (EXAMPLE.test(context) || EXAMPLE.test(next) && !SWITCH.test(next)) continue;
    if (paymentBeforeOutcome(clause) || paymentBeforeOutcome(context) || bindsPaymentBeforeCounterpartyCheck(prior, clause, context, next) ||
        reportedUpfrontGate(context) || demandsPaymentBeforeVerification(clause) || paymentBeforeBasicInformation(clause, context) ||
        workerPaysBeforeAssignment(clause, context) || requiresVerificationFeeBeforeContinuing(clause, context, next)) {
      signals.add(SIG_PREPAYMENT);
    }
    if (routedToOtherParty(clause) || bindsOtherOwnerToPayment(prior, clause, context, next) ||
        namedPaymentToOutsider(clause, context) || mismatchInContinuation(prior, clause, context) ||
        bindsNamedAccountToAnotherPayee(prior, clause, context, next) ||
        explicitlyReassignedAccount(clause, next, context) || currentlyReported(context) && !NO_PAYMENT.test(context) && !REVERSE_OR_AUTHORIZED.test(context) &&
        ORIGINAL_RECIPIENT.test(prior) && MISMATCH.test(prior) && INDIVIDUAL_DESTINATION.test(clause)) {
      signals.add(SIG_THIRD_PARTY_ACCOUNT);
    }
  }
}
