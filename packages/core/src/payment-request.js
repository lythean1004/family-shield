// 계좌는 송금의 목적지이고, 상품권은 수량을 세어 사는 물건이다. 같은 문장의 목적어와 요청을 확인한다.
const polite = "(?:줘|주라|줄래|주세요|주실래요|줄\\s*수\\s*(?:있어|있니|있을까))";
const end = "(?=[\\s,.!?~ㅋㅎㅠㅜ]|$)";
const accountDigits = "[0-9Xx*○●]";
export const ACCOUNT_NUMBER = "(?:" + accountDigits + "{2,6}(?:-" + accountDigits + "{2,6}){2,3}|" + accountDigits + "{9,16})";
const shortAmount = new RegExp("(?:이체|송금|통장|계좌)[^,.!?\\n]{0,24}?\\d+\\s*(?:천|만)(?:만)?\\s*(?:좀\\s*)?보내\\s*" + polite + end);
const nonMoneyItem = /(?:파일|서류|사진|우편|엽서|자료|물품)/;
const shortUnit = "\\d+\\s*(?:만|천)(?:\\s*원)?(?:만)?";
const sendAmount = new RegExp(shortUnit + "\\s*(?:좀\\s*)?보내\\s*" + polite + end);
const accountValue = new RegExp("(?:통장|계좌)(?:\\s*번호)?\\s*[:：]?\\s*" + ACCOUNT_NUMBER);
const repayment = new RegExp("(?:카드값|통장|계좌)(?:이|가)?\\s*(?:막혀|묶여|동결)[가-힣]{0,4}\\s*" +
  shortUnit + "\\s*(?:오늘|내일|모레|주말)(?:\\s*(?:아침|오후|저녁))?(?:에)?\\s*(?:바로\\s*)?" +
  "(?:드릴게요?|갚을게요?|돌려줄게요?)" + end);
const borrow = new RegExp("(?:돈|금액|[가-힣]{1,6}비|\\d+\\s*(?:만|천)?\\s*원)(?:을|를|만)?\\s*(?:좀\\s*)?빌려\\s*" +
  "(?:" + polite + "|줄\\s*수\\s*있(?:나|나요|을까요))" + end);
const owner = "(?:(?:우리|내|제)[ \\t]*)?(?:딸|아들|동생|형|언니|누나|오빠|친구|가족|동료|지인)(?:의)?[ \\t]*";
const namedAccount = new RegExp("(?:계좌(?:[ \\t]*번호)?|통장)(?:는|은)?[ \\t:：]*(?:" + ACCOUNT_NUMBER + "[ \\t,]*)?" +
  owner + "(?:(?:이름|명의)(?:으)?로[ \\t]*(?:돼|되어)[ \\t]*있(?:어|어요|습니다)|명의(?:야|예요|입니다))" + end);
const unavailable = /(?:계좌|통장)(?:이|가|은|는)?\s*(?:압류|동결|한도\s*제한|묶여|막혀|정지|(?:정비|점검)\s*중)(?![가-힣]{0,3}\s*(?:아니|않|풀려|해제))/;
const relative = "(?:조카|처제|형제|누나|동생|친척|가족|아들|딸|배우자|남편|아내)";
const counterpartyParent = "상대(?:방)?(?:의)?\\s*(?:아빠|엄마|아버지|어머니|부모님|보호자)";
const personalPayee = "(?:(?:(?:제|내|저의)\\s*)?개인(?:\\s*명의)?|" + relative + ")(?:의)?\\s*(?:통장|계좌)";
const remitTo = "(?:보내\\s*(?:" + polite + "|주면\\s*(?:돼|된다|됩니다))|부탁(?:드립니다|드려요|해요))" + end;
const substitute = new RegExp("(?:" + personalPayee + "(?:로|으로|에)|상대방(?:에게|한테))\\s*(?:바로\\s*)?" + remitTo);
const separateHolder = new RegExp(counterpartyParent + "(?:의)?\\s*(?:통장|계좌)(?:이?야|이에요|예요|입니다)" + end);
const relatedPayeeField = new RegExp("(?:예금주|" + ACCOUNT_NUMBER + ")[^.!?\\n()]{0,18}\\(\\s*(?:총무|회장|담당자)(?:의)?\\s*" + relative + "\\s*\\)");
const requestedAccount = new RegExp("(?:이|아래|다음)\\s*(?:계좌|통장)(?:로|으로|에)\\s*" +
  "(?:(?:금일|오늘|내일)까지\\s*)?(?:좀\\s*)?" + remitTo);
const feePurpose = /(?:수강료|수업료|학원비|교재비|회비|참가비)/;
const ownCardBlocked = /(?:제|저의|내)\s*카드(?:가|는)?\s*(?:정지(?:돼|되[어었])|막혀)(?![가-힣]{0,4}\s*(?:않|아니|풀려|해제))/;
const coverFee = new RegExp("(?:원장|선생|총무|회장)(?:님)?(?:의)?\\s*(?:계좌|통장)(?:로|으로)\\s*" +
  "(?:" + shortUnit + "\\s*)?(?:먼저|대신)\\s*보내\\s*주(?:시면|면)\\s*" +
  "(?:오늘|내일|모레|주말)(?:에)?\\s*(?:(?:직접|바로)\\s*)?" +
  "(?:갚을게요?|돌려(?:드릴|줄)게요?|찾아뵙고\\s*(?:바로\\s*)?드릴게요?)" + end);
const toAccount = new RegExp("(?:계좌|통장)(?:로|으로|에)\\s*(?:(?:바로|좀|지금|대신)\\s*){0,2}보내" +
  "(?:\\s*" + polite + "|(?=\\s*(?:[0-9]+\\s*만?\\s*원|$)))" + end);
const oneTransfer = /(?:송금|이체)(?:을|를)?\s*(?:한\s*(?:번|건)|하나)만\s*(?:부탁(?:해|할게요?|드릴게요?|드려요|드립니다)?|해\s*(?:줘|주세요))(?=[\s,.!?~ㅋㅎ]|$)/;
const remit = new RegExp("(?:[0-9]+\\s*(?:천|만)?|[가-힣]{0,3}(?:천|만))\\s*원[^.!?\\n]{0,58}부쳐\\s*" + polite + end);
const mail = /(?:편지|엽서|우표|우편|택배|소포)/;
const voucher = /(?:상품권|기프트\s*카드|기프티콘|플레이\s*카드)/;
const buyCount = new RegExp("(?:[1-9]\\d?|한|두|세|네|몇)\\s*장(?:만|을)?\\s*(?:사(?:다)?\\s*" + polite +
  "|구매\\s*(?:부탁|요청)|사서\\s*.{0,28}?(?:사진|번호|코드).{0,12}?(?:보내|알려)\\s*" + polite + ")" + end);
const reported = /[‘’“”"'「」]|(?:다는|라는)\s*(?:요구|문자|말)|(?:예방|피싱)\s*(?:교육|안내)|부탁(?:해)?\s*(?:주)?지\s*(?:마|말|않)/;
const lending = /(?:대출|융자|환급)/;
const release = /(?:선입금|선납|먼저\s*(?:납부|입금|송금))\s*(?:을|를)?\s*(?:후|한\s*뒤|해야|하셔야|하시면)\s*(?:즉시\s*)?(?:지급|승인|대출|환급)/;
const guaranteedReturn = /(?:입금|송금|예치)(?:하시?면|하면|해야)\s*(?:(?:고정|확정|약정)\s*)?수익(?:을)?\s*보장(?:합니다|됩니다|해\s*드(?:립니다|려요))/;
const selectedTrial = /무료\s*(?:체험|행사)[^.!?\n]{0,24}(?:대상자(?:로)?\s*선정|당첨자|당첨되)/;
const lottery = /(?:로또|복권)/;
const feeThenDeposit = /(?:예약금|등록비|보증금|가입비|참가비)(?:을|를)?\s*(?:[0-9][0-9,.]*\s*(?:천|만)?\s*원(?:을|만)?\s*)?(?:입금|송금)\s*(?:하시면|하면|해야|시)(?=\s|$)/;
const returnedAtEvent = /(?:당일|(?:참가|참여|체험)\s*(?:후|직후))\s*(?:전액\s*)?(?:(?:돌려드(?:립니다|려요)|반환합니다|환불합니다)(?=\s|$)|(?:반환|환불)\s*$)/;
const lotteryNumbers = /(?:예상\s*)?번호(?:를|도)?\s*(?:제공|보내\s*드(?:립|려))/;
const ifNoWin = /(?:미당첨|낙첨)(?:\s*(?:시|이면))?|당첨(?:이)?\s*(?:안\s*(?:되|돼)|되지\s*않)/;
const refundPromise = /(?:환불|반환)(?:\s*보장|합니다|해\s*드(?:립니다|려요))?(?=[.!]|$)/;
const preventionNotice = /(?:피해|사기|피싱)\s*(?:예방|사례)|예방\s*(?:안내|교육)|[‘’“”"'「」]|(?:라는|다는)\s*(?:문구|문자|요구)/;
const depositAccountField = new RegExp("^(?:입금\\s*)?계좌(?:\\s*번호)?\\s*[:：]?\\s*" + ACCOUNT_NUMBER + "(?=\\s|$)");
const investmentMarket = /(?:거래소|가상\s*자산|암호\s*화폐|코인|주식)/;
const promisedYield = /수익(?:률)?\s*\d+(?:\.\d+)?\s*(?:%|배|퍼센트|프로)(?:\s*이상)?(?:을|를)?\s*보장(?:합니다|한대|이래|된대|$)(?![가-힣])/;
const firstDeposit = /(?:처음(?:엔|에는|에)?|먼저|우선|일단)\s*\d[\d,]*\s*(?:천|만)?\s*원(?:을|만)?\s*(?:넣어\s*봐(?:요)?|(?:입금|송금)해\s*(?:주세요|봐요?|줘))(?![가-힣])/;
const simulatedEntry = /(?:계산기|연습장|모의\s*계좌|입력란|시뮬레이터|연습용\s*잔액)/;

// 무료 혜택·예측 번호를 미끼로 먼저 돈을 받고 돌려준다고 하는 유형. 일반 예약금과 분리한다.
// 한국소비자원 복권 예측서비스 피해 안내 https://www.kca.go.kr/kca/sub.do?menukey=5293&mode=view&no=1003787711
function requiresOfferDeposit(text) {
  if (preventionNotice.test(text)) return false;
  // 숫자의 소수점이나 안내 중간 주소의 점에서 약속과 조건을 나누지 않는다.
  const clauses = text.split(/\.(?=\s|[가-힣]|$)|[!?\n]+/).map(c => c.trim()).filter(Boolean);
  return clauses.some((clause, i) => {
    // 가상자산 등의 정량 수익 보장을 내세워 첫 돈을 넣으라고 한 경우. 금융위 https://www.fsc.go.kr/po010101/87916
    const promise = promisedYield.exec(clause);
    if (promise && investmentMarket.test((clauses[i - 1] ?? "") + " " + clause)) {
      const rest = clause.slice(promise.index + promise[0].length).trim();
      const request = /^[\s\p{P}\p{S}\uFE0F]*$/u.test(rest) ? clauses[i + 1] ?? "" : rest;
      if (firstDeposit.test(request) && !simulatedEntry.test(request) &&
          !/(?:사실이\s*아니|거짓|허위|믿지\s*마|사칭|사기)/.test(rest)) return true;
    }
    const payment = feeThenDeposit.exec(clause);
    if (!payment) return false;
    const offer = (clauses[i - 1] ?? "") + " " + clause.slice(0, payment.index);
    const after = clause.slice(payment.index + payment[0].length);
    if (selectedTrial.test(offer)) return returnedAtEvent.test(after);
    if (!lottery.test(offer) || !lotteryNumbers.test(after)) return false;
    const next = clauses[i + 1] ?? "";
    const condition = depositAccountField.test(next) ? clauses[i + 2] ?? "" : next;
    return [after, condition].some(c => ifNoWin.test(c) && refundPromise.test(c));
  });
}

const receiptBoundary = /(?<=[.!?。…])\s+|[\r\n]+/u;
const admittedLoan = /(?:대출|융자)(?:이|가|은|는)?\s*(?:심사\s*)?승인(?:됐|되었|됨|이\s*완료|\s*사실(?:을|이)?\s*(?:알렸|통보|기재|기록|확인됐))/u;
const awardedBenefit = /(?:경품|상품|상금)(?:에|이)?\s*(?:뽑혔|선정되었|선정됐|당첨됐|당첨되었)|(?:경품|상품)\s*당첨\s*사실/u;
const preservesBenefitSource = /(?:통지|연락|안내|알림|메시지|문자)(?:를|을)?\s*(?:받았|받은|왔|도착)|(?:선정|당첨|뽑혔)[^.!?\n]{0,20}(?:수신|통지|안내|연락)/u;
const claimsDelayedBenefit = /(?:상품|경품|물건|물품|상금|혜택|대출(?:금)?|융자금)(?:을|를)?\s*(?:받|수령하|지급받)으?려면|(?:대금|자금|대출(?:금)?|융자금)(?:을|를)?\s*(?:받|수령하|진행하|실행하)으?려면/u;
const requiredExtraFee = /(?:(?:처리|심사|진행|지급)\s*(?:수수료|비용)|(?:별도(?:의)?|추가(?:의)?)\s*(?:돈|비용|수수료|금액)|보증금)/u;
const quantifiedFee = /^(?:(?:의)?\s*(?:\d[\d,.]*\s*(?:천|만|억)?\s*원|[한두세네]\s*(?:천|만)\s*원))?/u;
const priorityBeforeFee = /(?:먼저|미리|우선)\s*$/u;
const priorityAfterFee = /^(?:먼저|미리|우선)\s*/u;
const mandatoryFeePayment = /^(?:입금|송금|이체|납부|지불)하(?:셔?야|라고|라는|도록)|^(?:입금|송금|이체|납부|지불)해(?:야|\s*(?:주세요|주십시오|달라))|^(?:내|보내)(?:야|라고|라는|\s*(?:주세요|주십시오|달라))/u;
const benefitDisclaimer = /(?:별도|다른)\s*(?:거래|연락|문자|행사|대출)|(?:별개|별건|한편)|(?:대출금|융자금)(?:은|는|이|가)?\s*(?:이미\s*)?(?:입금|지급|실행)\s*(?:완료|됐|되었)|(?:무료|수수료가\s*없|납부할\s*필요가\s*없|내지\s*않아도|자동\s*차감|별도\s*납부\s*없)/u;
const feeWithdrawal = /(?:(?:이|그|해당|같은)\s*)?(?:(?:수수료|납부|입금|송금|지불)\s*)?(?:요청|요구|조건|지시)(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:취소|철회|없어졌|없었)/u;
const inactiveBenefit = /(?:승인|선정|당첨)(?:은|는|이|가)?\s*(?:이미\s*)?(?:취소|철회|보류|예정|아니)/u;
const deniesFee = /(?:필요|요구|요청|사실|적)(?:은|는|이|가)?\s*(?:없|아니)|(?:해야|하는|할)\s*(?:하는지|하느냐|지)\s*(?:묻|문의|질문)|(?:하는지|해야\s*하는지|했는지|(?:라는\s*(?:뜻|건|것)인지|라고\s*한\s*(?:것|건)인지))\s*(?:제가|내가|수신자가)?\s*(?:물었|물어봤|문의|확인)|(?:내지|보내지|납부하지|송금하지|입금하지)\s*(?:말|마|않아도)/u;

function demandsFeeForPromisedBenefit(text) {
  for (const notice of text.split(/\r?\n[ \t]*\r?\n/u)) {
    const clauses = notice.split(receiptBoundary).map(clause => clause.trim()).filter(Boolean);
    for (const [i, clause] of clauses.entries()) {
      const cost = requiredExtraFee.exec(clause);
      if (!cost) continue;
      const previous = clauses[i - 1] ?? "";
      const next = clauses[i + 1] ?? "";
      const report = previous + " " + clause;
      if (preventionNotice.test(report) || benefitDisclaimer.test(report) || inactiveBenefit.test(report) ||
          clause.endsWith("?") || deniesFee.test(clause) || feeWithdrawal.test(next)) continue;

      const before = clause.slice(0, cost.index);
      const offer = previous + " " + before;
      const explicitGate = claimsDelayedBenefit.test(before);
      if (!admittedLoan.test(offer) && !(awardedBenefit.test(offer) && preservesBenefitSource.test(offer) && explicitGate)) continue;

      const atCost = clause.slice(cost.index + cost[0].length);
      const amount = quantifiedFee.exec(atCost)[0];
      const afterAmount = atCost.slice(amount.length).trimStart();
      const payment = afterAmount.replace(/^(?:을|를|부터)?\s*/u, "");
      const priority = priorityAfterFee.exec(payment);
      const feeFirst = priority || /^부터(?=\s|$)/u.test(afterAmount) || priorityBeforeFee.test(before);
      if (!feeFirst && !explicitGate) continue;
      if (mandatoryFeePayment.test(payment.slice(priority?.[0].length ?? 0))) return true;
    }
  }
  return false;
}

// 금융위·금감원 피해예방 10계명의 대출 전 보증금 요구 유형. https://www.fsc.go.kr/no010101/86250
export function requiresAdvancePayment(text) {
  if (requiresOfferDeposit(text) || demandsFeeForPromisedBenefit(text)) return true;
  for (const match of text.matchAll(/[^.!?\n]+/g)) {
    const clause = match[0];
    if (reported.test(clause) || /사기(?:입니다|예방)|(?:라는|이라는)\s*(?:말|문구)|(?:피해|예방)\s*사례/.test(clause)) continue;
    if (guaranteedReturn.test(clause)) return true;
    if (release.test(clause)) {
      // 알림 제목과 조건표는 줄이 달라도 한 문서다. 지난 문장의 조건은 이어받지 않는다.
      const notice = text.slice(Math.max(0, match.index - 160), match.index + clause.length).split(/[.!?]/).at(-1);
      if (lending.test(notice)) return true;
    }
  }
  return false;
}

export function requestedPayments(text) {
  let money = false;
  let gift = false;
  let thirdPartyAccount = false;
  let previous = null;
  for (const clause of text.split(/[.!?\n]/)) {
    if (!clause.trim()) continue;
    if (reported.test(clause)) {
      previous = null;
      continue;
    }
    const loanRequest = borrow.test(clause);
    // 대여할 물건과 받는 계좌가 따로 언급될 수 있어, 금전 차용을 부탁한 같은 절이나 바로 다음 절만 본다.
    if ((loanRequest || previous?.loanRequest) && namedAccount.test(clause)) thirdPartyAccount = true;
    const blocked = unavailable.test(clause);
    // 자기 카드로 못 낸 비용을 다른 사람 계좌에 먼저 내 달라고 하고 직접 갚겠다는 요청.
    if (feePurpose.test(clause) && ownCardBlocked.test(clause) && coverFee.test(clause) && !preventionNotice.test(text)) {
      money = true;
      thirdPartyAccount = true;
    }
    const accountRequest = requestedAccount.test(clause);
    if ((blocked && substitute.test(clause)) ||
        ((accountRequest || previous?.accountRequest) && separateHolder.test(clause)) ||
        (((blocked && accountRequest) || previous?.substitution) && relatedPayeeField.test(clause))) thirdPartyAccount = true;
    const sendShortAmount = !nonMoneyItem.test(clause) && sendAmount.test(clause);
    if (((sendShortAmount || previous?.sendShortAmount) && accountValue.test(clause)) || repayment.test(clause)) money = true;
    previous = { loanRequest, accountRequest, substitution: blocked && accountRequest, sendShortAmount };
    if (toAccount.test(clause) || oneTransfer.test(clause) || (remit.test(clause) && !mail.test(clause)) ||
        (shortAmount.test(clause) && !nonMoneyItem.test(clause))) money = true;
    const product = voucher.exec(clause);
    if (product && buyCount.test(clause.slice(product.index + product[0].length, product.index + 90))) gift = true;
  }
  return { money, gift, thirdPartyAccount };
}

// 생략된 부탁의 목적어는 금액 바로 뒤에 붙은 경우에만 금전 요청으로 읽는다.
const amountObjectAsk = /(?<![\p{L}\p{N}])(?:\d{1,3}(?:,\d{3})+|\d{1,9}|[한두세네다섯여섯일이삼사오육칠팔구십]{1,5})\s*(?:(?:천|만)\s*)?원(?:까지만|만|을|를)?\s*(?:(?:좀|정도만|대신)\s*){0,2}(?:부탁(?:했|해(?:요)?|한(?:다|대)|할게|드립니다|드려|이라|이야|입니다|(?=[\s,.!?~]|$))|(?:보태|빌려|지불해|내|납부해|부쳐|보내|이체해|송금해|입금해)\s*(?:달라|달라고|달라는|줘|줄래|줄\s*수|주실|주세요))/u;
const historicAmountAsk = /(?:이미\s*(?:끝났|마쳤|정산|지불|송금)|(?:요청|요구|부탁)(?:은|는|이|을|를)?\s*(?:(?:이미|나중에)\s*)?(?:취소|철회|거절|없었)|(?:금액|내역|용도|단위)(?:이|가|은|는|을|를)?\s*(?:정확한지|맞는지|오기|오류)|(?:사기|피싱|피해)\s*(?:예방|사례|교육)|(?:교육|예시|가상)\s*(?:자료|사례|문구|발신|상황)|(?:필요|요청|요구)(?:가|는)?\s*없)/u;

export function hasAmountObjectAsk(clause) {
  return !historicAmountAsk.test(clause) && amountObjectAsk.test(clause);
}