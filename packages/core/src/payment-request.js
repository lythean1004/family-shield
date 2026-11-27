// 계좌는 송금의 목적지이고, 상품권은 수량을 세어 사는 물건이다. 같은 문장의 목적어와 요청을 확인한다.
const polite = "(?:줘|주라|줄래|주세요|주실래요|줄\\s*수\\s*(?:있어|있니|있을까))";
const end = "(?=[\\s,.!?~ㅋㅎㅠㅜ]|$)";
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

// 금융위·금감원 피해예방 10계명의 대출 전 보증금 요구 유형. https://www.fsc.go.kr/no010101/86250
export function requiresAdvancePayment(text) {
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
  for (const clause of text.split(/[.!?\n]/)) {
    if (reported.test(clause)) continue;
    if (toAccount.test(clause) || oneTransfer.test(clause) || (remit.test(clause) && !mail.test(clause))) money = true;
    const product = voucher.exec(clause);
    if (product && buyCount.test(clause.slice(product.index + product[0].length, product.index + 90))) gift = true;
  }
  return { money, gift };
}
