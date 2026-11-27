
import { isCardCallbackNumber } from "./card-sender.js";
import { currentReceivedRequests } from "./received-message.js";
import { SIG_CALL_THIS_NUMBER, SIG_PERSONAL_INFO } from "./signals.js";

const artifact = "(?:문자|메시지|연락|안내(?:문)?|통지(?:문)?|쪽지|알림)";
const postalRole = "(?:우편(?:물)?|택배|배송)\\s*(?:보관|수령|접수|문의|배송|배달)\\s*(?:창구|센터|담당\\s*부서)";
const postalOrigin = new RegExp(
  "^(?:(?:받은|수신한|도착한)\\s*)?(?:" + postalRole +
  "(?:로\\s*표시된|이라고\\s*적힌|\\s*명의의)\\s*" + artifact +
  "(?:은|는|이|가|에서|에는)|" + artifact + "(?:에는|에서)\\s*발신(?:처|자|\\s*표시)(?:가|이|는|은)\\s*" +
  postalRole + "(?:로\\s*(?:표시됐|표시되었|기재됐|기재되었)|이라고\\s*적혀\\s*있었)(?:습니다|어요|다|음))(?=[\\s.!?。]|$)",
  "u",
);
const sameNotice = new RegExp("^(?:그|같은|이|해당)\\s*" + artifact + "(?:에서|에는|에)\\s*", "u");
const assignedPurpose = /(?:배송|배달|우편(?:물)?|택배|반송|수령)(?:[가-힣]{0,8})?(?:\s+[가-힣]{1,10}){0,3}?\s*(?:문의|상담|확인)(?:(?:할|에\s*쓸)\s*(?:곳|창구|연락처)|\s*(?:창구|연락처|번호))(?:으로|로|에)\s*$/u;
const selectedNumber = /^\s*(?:이|가|은|는|을|를)?\s*(?:따로\s*)?(?:지정|명시|기재|표시|정해\s*두)(?:했(?:습니다|어요|다|음)|됐(?:습니다|어요|다|음)|하였(?:습니다|어요|다|음)|되었(?:습니다|어요|다|음)|었(?:습니다|어요|다|음))(?=[.。!?\s]|$)/u;
const actualPhone = /(?<![\d-])(?:0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1\d{3}[- ]?\d{4})(?![\d-])/gu;
const sameNoticeCallback = new RegExp(
  "^(?:(?:그|같은|이|해당|받은)\\s*)?" + artifact +
  "(?:에|에는|에서|\\s*속에)\\s*(?:적힌|실린|기재된|표시된|나온)\\s*(?:그\\s*)?(?:별도\\s*)?(?:번호|연락처)(?:로|으로|에)\\s*" +
  "(?:직접\\s*)?(?:전화|연락|회신|통화)(?:하라(?:고|는)|해\\s*달라(?:고|는)|하도록)\\s*" +
  "(?:요구|요청|지시|내용|안내|했|적혀|안내했)", "u",
);
const nonCurrentRoute = /(?:참고(?:로|용)?|가상|대체|예시|견본|예방|교육|훈련|별개로|다른\s*(?:발신자|업체|단체|문자|안내|요구|번호))|(?:할지|할\s*필요|(?:하|했|받았)는지|(?:요청|지시|내용)(?:인지|이었는지)|하라는\s*뜻(?:은|이)?\s*아니)/u;
const inactiveDemand = /(?:요구|요청|지시)(?:은|는|이|가|을|를)?\s*(?:(?:이미|그\s*뒤|나중에)\s*)?(?:철회|취소|없|아니)|(?:하라|해\s*달라)(?:고|는)\s*(?:한\s*적|말|뜻)(?:이|은|는|도)?\s*(?:없|아니)/u;
const actorWithdrawal = /^(?:발신자|상대(?:방)?|보낸\s*사람)(?:가|이)\s*(?:그|이|해당|같은)\s*(?:(?:전화|연락|자료|서류|제출)\s*)?(?:요구|요청|지시)(?:를|을)?\s*(?:취소|철회)/u;
const fundingOrigin = new RegExp(
  "^(?:(?:받은|수신한|도착한)\\s*)?(?:(?:지원금|보조금|복지)\\s*(?:담당|접수|지급|심사)\\s*기관|(?:공공|행정|복지)\\s*기관)" +
  "(?:을|를)\\s*(?:내세운|자처한|자칭한)\\s*" + artifact + "(?:에서|에는|에)(?=\\s|$)\\s*", "u",
);
const protectedMaterial = "(?:(?:주민등록증|신분증|여권)\\s*(?:사진|사본)|통장\\s*사본|주민등록번호(?:\\s*(?:전체|전부))?|(?:계좌|통장|카드)\\s*(?:번호|비밀번호))";
const positiveSubmission = new RegExp(
  "^(?:(?:저에게|제게|나에게|수신자(?:에게|한테)|수신인(?:에게|한테))\\s*)?(?:(?:제|내|수신자의)\\s*)?" +
  protectedMaterial + "(?:\\s*(?:과|와|및|하고|랑|,|·)\\s*" + protectedMaterial + ")?" +
  "(?:을|를|만)?\\s*(?:(?:함께|같이|둘\\s*다|모두)\\s*)?(?:(?:제출|전달|전송)(?:하라(?:고|는)\\s*)?)?" +
  "(?:요구|요청)(?:했|하였)(?:습니다|어요|다|음)(?:[.。!]|$)\\s*$", "u",
);

function assignsCallback(record) {
  const numbers = [...record.matchAll(actualPhone)];
  if (numbers.length !== 1) return false;
  const [number] = numbers;
  return !isCardCallbackNumber(number[0]) &&
    assignedPurpose.test(record.slice(0, number.index)) &&
    selectedNumber.test(record.slice(number.index + number[0].length));
}

export function* recognizedIssuedNoticeActions(text) {
  const isIssuer = clause => postalOrigin.test(clause) || fundingOrigin.test(clause);
  for (const report of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, previous, next } of currentReceivedRequests(report, isIssuer, assignsCallback)) {
      if (inactiveDemand.test(body + " " + next) || actorWithdrawal.test(next)) continue;
      const funding = fundingOrigin.exec(body);
      if (funding && positiveSubmission.test(body.slice(funding[0].length))) {
        yield SIG_PERSONAL_INFO;
      }
      const shipperHere = postalOrigin.exec(body);
      const shipperBefore = postalOrigin.exec(previous);
      const route = shipperHere ? body.slice(shipperHere[0].length) : sameNotice.test(body) && shipperBefore ? body : "";
      if (route && !nonCurrentRoute.test(route + " " + next) && assignsCallback(route) && sameNoticeCallback.test(next)) {
        yield SIG_CALL_THIS_NUMBER;
      }
    }
  }
}
