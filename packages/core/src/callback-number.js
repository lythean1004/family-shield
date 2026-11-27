import { OFFICIAL_DOMAIN_CARDS } from "./lookalike.js";

const digits = number => number.replace(/\D/g, "");
const official = new Set(OFFICIAL_DOMAIN_CARDS.filter(c => c.status === "source_checked")
  .flatMap(c => c.callback_contact?.numbers ?? []).map(digits));
const NUMBER = /(?<![\d-])(?:0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1[568]\d{2}[- ]?\d{4}|1\d{2,3})(?![\d-])/g;
const BEFORE_NUMBER = /(?:(?:아래|이|해당)\s*(?:번호|연락처)(?:로|에)\s*(?:신고|접수|연락)(?:해\s*주세요|하세요|하십시오)|상담원\s*연결|고객\s*센터(?:로|에)\s*(?:취소|접수)\s*요청)[\s.!:☎]*$/;
const AFTER_NUMBER = /^\s*(?:으로|로|에)\s*(?:(?:바로|직접|즉시)\s*)?(?:신고|연락|전화|문의)\s*(?:주세요|해\s*주세요|하세요|하십시오|바랍니다)/;
const REPORTED_TARGET = /^\s*(?:(?:은|는)\s*(?:지난|예전)|(?:라는|이라고|라고)\s*(?:문구|예시|사례))/;
const desk = /(?:담당\s*(?:수사관|조사관)|전담\s*(?:상담실|창구|상담원)|신고\s*센터)\s*[:(（]?\s*$/;
const deskAction = /^[ \t)）]*(?:에게|으로|로)[ \t]*(?:(?:직접|바로|즉시)[ \t]*)?(?:연락\s*(?:바랍니다|하십시오|주세요)|전화\s*(?:하시어|주시면|주시기\s*바랍니다))(?=[\s.,!?]|$)/;
const reportRisk = /(?:명의\s*도용|분실\s*신고)[^.!?\n]{0,24}$/;
const verifyByPhone = /^[ \t]*(?:으로|로)[ \t]*확인\s*(?:바랍니다|해\s*주세요|하십시오)(?=[\s.,!?]|$)/;
const foreignHeader = /^\s*(?:\[Web발신\]\s*)?(?:\[(?:국외|국제|해외)\s*발신\]|(?:국외|국제|해외)\s*발신\s*[:：])/i;
const paymentRecorded = /(?:결제(?:가)?|(?:카드|결제)\s*승인(?:이)?)\s*완료(?:되었습니다|됐습니다|됨)?(?=[\s,(:/]|$)(?!\s*(?:예정|(?:전|후|시)(?:에|에는)?(?:\s|$)|취소|대기|실패))/;
const notMine = "(?:본인(?:의|이|께서)?\\s*(?:(?:한|하신)\\s*)?(?:결제|거래|승인)(?:가|이)?\\s*(?:아닌\\s*경우|아닐\\s*(?:경우|시)|아니(?:면|라면))|" +
  "본인(?:이|께서)\\s*(?:결제|승인)하지\\s*않(?:았다면|은\\s*경우))";
const cancelAction = "(?:(?:거래|결제|승인)\\s*)?취소(?:를)?\\s*(?:접수|신청)(?:하세요|하십시오|해\\s*주세요)";
const cancelContact = new RegExp(notMine + "[\\s,:：/-]*(?:(?:(?:거래|결제|승인)\\s*)?취소\\s*" +
  "(?:접수처|문의(?:처)?|고객\\s*센터|상담\\s*번호)|(?:아래|이)\\s*번호로\\s*" + cancelAction + ")\\s*[:：☎]?\\s*$");
const beforeCancelNumber = new RegExp(notMine + "\\s*[:,：☎]?\\s*$");
const afterCancelNumber = new RegExp("^\\s*(?:으로|로)\\s*" + cancelAction + "(?=[\\s.!?]|$)");
const teaching = /(?:사칭|피싱|피해|사기)\s*(?:피해\s*)?(?:예방|주의|사례|교육)|예방\s*(?:안내|교육)|(?:라는|다는)\s*(?:문구|사례)/;

// 결제한 적이 없는 사람에게 취소 창구로 지정한 번호만 확인한다. 배송·광고 연락처는 별개다.
// 경찰청 사이버범죄 신고시스템의 허위 결제 문자 안내 https://ecrm.police.go.kr/minwon/crs/quick/qna
function hasForeignPaymentCallback(text, targets) {
  if (!foreignHeader.test(text) || teaching.test(text)) return false;
  return targets.some(({ start, end, known, long }) => {
    if (known || !long) return false;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const route = cancelContact.exec(before) ?? (afterCancelNumber.test(after) && beforeCancelNumber.exec(before));
    if (!route || /[‘“"'「][^’”"'」]*$/.test(before) || REPORTED_TARGET.test(after)) return false;
    const previous = before.slice(0, route.index).split(/(?<!\d)\.|\.(?!\d)|[!?。\r\n]+/).map(s => s.trim()).filter(Boolean).at(-1);
    return Boolean(previous && paymentRecorded.test(previous));
  });
}

export function classifyCallback(text, legacyPatterns) {
  const targets = Array.from(text.matchAll(NUMBER), m => {
    const number = digits(m[0]);
    return { start: m.index, end: m.index + m[0].length, known: official.has(number), long: number.length >= 8 };
  });
  // R19는 별도의 로컬 근거다. 기존 회신·기관 신호를 바꾸거나 해외 AI 전송 대상을 늘리지 않는다.
  const foreignPayment = hasForeignPaymentCallback(text, targets);
  const directed = targets.some(t => {
    if (t.known || !t.long) return false;
    const before = text.slice(Math.max(0, t.start - 48), t.start);
    const after = text.slice(t.end, t.end + 35);
    if (REPORTED_TARGET.test(after)) return false;
    if (BEFORE_NUMBER.test(before) || AFTER_NUMBER.test(after)) return true;
    if (/[‘“"'「][^’”"'」]*$/.test(before) || /^[^.!?\n]{0,35}[’”"'」]/.test(after)) return false;
    return (desk.test(before) && deskAction.test(after)) || (reportRisk.test(before) && verifyByPhone.test(after));
  });
  if (directed) return { signal: true, directed, foreignPayment };
  if (!targets.some(t => t.known)) return { signal: legacyPatterns.some(re => re.test(text)), directed, foreignPayment };

  // 기존 표현이 가리킨 번호만 제외한다. 다른 문장의 공식 번호가 별도 회신 요구를 가리지 않도록 한다.
  const signal = legacyPatterns.some(re => {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + "g"))) {
      const end = m.index + m[0].length;
      const bound = targets.filter(t => (t.start >= m.index && t.start < end) ||
        (t.start >= end && t.start - end <= 18 && /^\s*(?:세요|주세요|십시오|시기\s*바랍니다)?[\s.!:☎]*$/.test(text.slice(end, t.start))));
      if (bound.length === 0 || bound.some(t => !t.known)) return true;
    }
    return false;
  });
  return { signal, directed, foreignPayment };
}
