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
const ending = "(?=[.!?…~ㅋㅎㅠㅜ\\s]|$)";
const REQUEST = new RegExp(FIELD + DETAILS + "(?:(?:(?<reply>회신|답장)|전달|전송|제출)(?:을|를)?[ \\t]*" +
  ASK + "|(?:알려|보내|불러|적어)[ \\t]*" + TELL_ME + ")" + ending, "gi");
const photo = "(?:신분증|주민등록증|(?:신용|체크)?카드)\\s*(?:" + SIDE + "\\s*)?(?:사진|사본)";
const PHOTO_SEND = new RegExp(photo + DETAILS + "찍어(?:서)?[ \\t]*(?:보내[ \\t]*" + TELL_ME +
  "|(?:전달|전송)해[ \\t]*" + TELL_ME + ")" + ending, "g");
const code = "(?:인증\\s*(?:번호|코드)|일회용\\s*(?:번호|코드))";
const CODE_ON_ARRIVAL = new RegExp(code + "(?:가|는|를)?\\s*(?:하나\\s*)?(?:갈\\s*거(?:야|예요)\\s*)?" +
  "(?:(?:그거|그게)\\s*)?(?:도착하|오)면\\s*(?:(?:그\\s*번호|그거)(?:를|만)?\\s*)?(?:바로\\s*)?" +
  "(?:알려|보내|불러)\\s*" + TELL_ME + ending, "g");

// 일부 기존 표현은 '찍어', '깔아'처럼 어간에서 끝난다. 반드시 같은 일치의 뒤를 본다.
const NEGATED = /^\s*(?:서\s*)?(?:(?:보내|전달|전송|제출|알려)\s*)?(?:해\s*)?(?:주|하)?지\s*(?:마|말|않)/;
const CITED = /^\s*(?:해\s*)?(?:줘|주세요|하십시오|하세요|바랍니다|부탁)?[.!?\s]*[’”"'」]\s*(?:라는|라고|같은|처럼)/;

export function hasSensitiveRequest(text, patterns) {
  return patterns.some(pattern => {
    for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags + "g"))) {
      const tail = text.slice(match.index + match[0].length, match.index + match[0].length + 42);
      if (!NEGATED.test(tail) && !CITED.test(tail)) return true;
    }
    return false;
  });
}

const reportedReplyChannel = "(?:(?:문자|메시지)(?:로|으로|에)|(?:답장|회신)(?:으로|로|에))";
const mandatoryReply = "(?:답|회신|전송|전달|첨부|제출)하(?:라(?:고|는)|도록)|(?:보내|알려|붙여)\\s*달라(?:고|는)";
const reportedIdentityContents = "(?:신분증|주민등록증)(?:의)?[ \\t]*(?:(?:모든|전체)[ \\t]*(?:기재[ \\t]*)?(?:항목|내용|사항)|기재[ \\t]*(?:사항|내용)[ \\t]*전부)";
const reportedField = "(?:주민\\s*등록\\s*번호|" + reportedIdentityContents + "|" + FIELD + ")" + "(?:을|를|만)?[ \\t]*";
const REPORTED_REPLY = new RegExp("(?:" + reportedField + reportedReplyChannel + "\\s*|" +
  reportedReplyChannel + "\\s*" + reportedField + ")(?:" + mandatoryReply + ")" + ending, "gi");

export function personalDisclosure(text, { recordedReply = false, atStart = false } = {}) {
  let requested = false;
  const patterns = recordedReply ? [REPORTED_REPLY, REQUEST, PHOTO_SEND, CODE_ON_ARRIVAL] : [REQUEST, PHOTO_SEND, CODE_ON_ARRIVAL];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (atStart && match.index !== 0) continue;
      const tail = text.slice(match.index + match[0].length);
      if (/^[.!?…~ㅋㅎㅠㅜ\s]*[‘’“”"'」]|^\s*(?:라고|라는|시\s|사례|문구|표현|금지|주의|경고|(?:처리\s*)?(?:기록|이력|완료|취소))/.test(tail)) continue;
      if (pattern === REPORTED_REPLY || match.groups?.reply) return { requested: true, reply: true };
      requested = true;
    }
  }
  return { requested, reply: false };
}
