// 주민·금융정보 항목과 전달 요구 사이에는 항목의 세부 표기, 조사, 회신 채널만 허용한다.
// 국민건강보험공단 사칭·개인정보 요구 안내: https://www.nhis.or.kr/cms/popup/popup.do?popupKey=%2Fnhis%2F_popup%2Fpopup_wVdaPjuDpZQHiAn
const SIDE = "(?:앞뒷면|앞뒤|앞면|뒷면|뒤)";
const FIELD = "(?:인증\\s*(?:번호|코드)|계좌\\s*번호|비밀\\s*번호|카드\\s*(?:번호|유효\\s*기간|" +
  SIDE + "\\s*(?:사진|보안\\s*코드))|(?:신분증|주민등록증)(?:\\s*" + SIDE + ")?(?:\\s*(?:사진|사본))?|" +
  "(?<![a-z0-9])cv[cv](?![a-z0-9]))";
const DETAILS = "(?:[ \\t]*(?:세|네|여섯|[346])[ \\t]*자리)?(?:만을|만|을|를)?[ \\t]*" +
  "(?:(?:이[ \\t]*(?:번호|문자)|문자|메시지)(?:로|으로|에)[ \\t]*)?(?:(?:좀|바로)[ \\t]*)?";
const TELL_ME = "(?:줘|주라|줄래|주세요|주십시오|주면[ \\t]*(?:돼|됩니다))";
const ASK = "(?:요청|부탁(?:드립니다)?|바랍니다|하세요|하십시오|해[ \\t]*" + TELL_ME + ")";
const REQUEST = new RegExp(FIELD + DETAILS + "(?:(?:(?<reply>회신|답장)|전달|전송|제출)(?:을|를)?[ \\t]*" +
  ASK + "|(?:알려|보내|불러|적어)[ \\t]*" + TELL_ME + ")(?=[.!?…\\s]|$)", "gi");

export function personalDisclosure(text) {
  let requested = false;
  for (const match of text.matchAll(REQUEST)) {
    const tail = text.slice(match.index + match[0].length);
    if (/^[.!?…\s]*[‘’“”"'」]|^\s*(?:라고|라는|시\s|사례|문구|표현|금지|주의|경고|(?:처리\s*)?(?:기록|이력|완료|취소))/.test(tail)) continue;
    if (match.groups.reply) return { requested: true, reply: true };
    requested = true;
  }
  return { requested, reply: false };
}
