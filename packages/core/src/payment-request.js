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
