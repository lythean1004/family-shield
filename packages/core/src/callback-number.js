import { OFFICIAL_DOMAIN_CARDS } from "./lookalike.js";

const digits = number => number.replace(/\D/g, "");
const official = new Set(OFFICIAL_DOMAIN_CARDS.filter(c => c.status === "source_checked")
  .flatMap(c => c.callback_contact?.numbers ?? []).map(digits));
const NUMBER = /(?<![\d-])(?:0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}|1[568]\d{2}[- ]?\d{4}|1\d{2,3})(?![\d-])/g;
const BEFORE_NUMBER = /(?:(?:아래|이|해당)\s*(?:번호|연락처)(?:로|에)\s*(?:신고|접수|연락)(?:해\s*주세요|하세요|하십시오)|상담원\s*연결|고객\s*센터(?:로|에)\s*(?:취소|접수)\s*요청)[\s.!:☎]*$/;
const AFTER_NUMBER = /^\s*(?:으로|로|에)\s*(?:(?:바로|직접|즉시)\s*)?(?:신고|연락|전화|문의)\s*(?:주세요|해\s*주세요|하세요|하십시오|바랍니다)/;
const REPORTED_TARGET = /^\s*(?:(?:은|는)\s*(?:지난|예전)|(?:라는|이라고|라고)\s*(?:문구|예시|사례))/;

export function classifyCallback(text, legacyPatterns) {
  const targets = Array.from(text.matchAll(NUMBER), m => {
    const number = digits(m[0]);
    return { start: m.index, end: m.index + m[0].length, known: official.has(number), long: number.length >= 8 };
  });
  const directed = targets.some(t => {
    if (t.known || !t.long) return false;
    const before = text.slice(Math.max(0, t.start - 48), t.start);
    const after = text.slice(t.end, t.end + 35);
    return !REPORTED_TARGET.test(after) && (BEFORE_NUMBER.test(before) || AFTER_NUMBER.test(after));
  });
  if (directed) return { signal: true, directed };
  if (!targets.some(t => t.known)) return { signal: legacyPatterns.some(re => re.test(text)), directed };

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
  return { signal, directed };
}
