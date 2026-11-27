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
const callbackField = /(?:상담|문의|회신|접수|연락)(?:\s*(?:창구|연락처|번호)|은|는|이|가)?[\s:：☎]*$/u;
const onlyNumber = /^\s*(?:(?:이|해당|그|지정된)\s*)?(?:전화\s*)?(?:번호|연락처)(?:로만|으로만|에서만|에만)\s*(?:(?:상담|접수|연락|통화|처리)(?:이|가)?\s*)?(?:가능|진행|처리|받을\s*수)/u;
const noResponseAtNumber = /^\s*(?:로|으로|에)\s*(?:(?:오늘|금일|내일|오전|오후|기한\s*(?:내|안에)|(?:\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|\d{1,2}\s*시간)\s*(?:까지|이내|안에)?)\s*){0,3}(?:(?:연락|전화|통화|회신|응답)(?:이|가|을|를)?\s*(?:없으면|하지\s*않으면|(?:없을|없는|하지\s*않을|하지\s*않는)\s*(?:시|경우|때))|미\s*(?:연락|회신|응답)\s*(?:시|경우|때))/u;
const coerciveConsequence = /^[\s,，:：]*(?:(?:즉시|별도(?:로)?|추가(?:로)?)\s*)?(?:(?:법적|형사|사법)\s*(?:절차|조치)|(?:계좌|거래|이용)\s*(?:제한|정지)|압류|동결|고발|고소|체포|구속)(?:\s*조치)?(?:가|를|에|은|는)?\s*(?:실시|진행|시작|들어|취해|취하|이루어|예정|됩니다|합니다|한다|한다고|하겠|하라는|함(?:이|을)?|됨|$)/u;
const noExclusiveRoute = /(?:가능(?:한\s*(?:것|게)|하)?|조건|요건|뜻|요구)(?:은|는|이|가)?\s*(?:사실이\s*)?(?:아니|않)|다른\s*(?:번호|연락처|창구)(?:로도|에서도)\s*(?:가능|연결)/u;
const rejectedCallback = /(?:요청|요구|안내)(?:은|는|이|가|을|를)?\s*(?:(?:제가|내가|어제|이미|앞서)\s*){0,3}(?:거절|철회|취소)(?:했|됐|하였|되었|함)/u;
const separateCallback = /(?:^|[\s,，])(?:(?:그와|이와)(?:는)?\s*별개로|별건으로|다른\s*(?:단체|발신자|사업자|기관)의\s*(?:상담|문의|접수|연락))/u;
const callbackComparison = /비교\s*(?:연습|교육|수업|자료)|(?:가상의?\s*번호|가정한\s*번호)|(?:예|예시|가정)(?:를|로)\s*(?:읽|소개|비교|들었)|가정(?:하면|했을\s*때)/u;
const newCallbackNotice = /^(?:(?:오늘|방금|이번에|새로)\s*(?:(?:받은|온|도착한)\s*(?:문자|메시지|연락|안내)|(?:문자|메시지|연락|안내)(?:가|를)?\s*(?:왔|받았)))/u;
const historicalCallback = /(?:^|[\s,，\]])(?:당시|지난\s*(?:달|주|해|번)|작년|예전|과거)(?:의|에는|에)?\s*(?:[가-힣]{1,12}\s+){0,3}(?:상담|문의|접수|회신|연락)(?:은|는|이|가)?\s*[:：]?\s*$/u;
const pastAvailability = /^\s*(?:했|하였|되었|됐|하던|되던|했던|한지|한\s*(?:여부|이유))/u;
const closedCallbackChannel = /^(?:그|이|해당|같은)\s*(?:창구|상담|접수|연락처)(?:은|는|이|가)?\s*(?:(?:이미|작년에?|지난\s*(?:달|주|해)|이전에?)\s*)?(?:폐쇄|종료|중단)(?:됐|되었)/u;
const deniedConsequence = /(?:하는|되는|될|할|하겠다는|할\s*수\s*있는)?\s*(?:일|계획|예정|의사|사실|가능성)(?:은|는|이|가)?\s*(?:없|아니)|(?:되|하)지는?\s*않|(?:하는지|하는\s*건지)|(?:여부|가능성)(?:를|을)?\s*(?:검토|문의|질문)/u;
const callbackStatementBreak = /[.!?。\r\n]+/u;
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

function hasConstrainedCallback(text, { start, end }) {
  const prior = text.slice(Math.max(0, start - 160), start).split(callbackStatementBreak);
  const before = prior.at(-1);
  const previous = prior.at(-2) ?? "";
  const [after, following = ""] = text.slice(end, end + 160).split(callbackStatementBreak, 2);
  const next = following.trimStart();
  if (teaching.test(text) || separateCallback.test(before) || historicalCallback.test(before) ||
      callbackComparison.test(before + " " + after) ||
      !newCallbackNotice.test(before.trimStart()) && callbackComparison.test(previous) ||
      rejectedCallback.test(after) ||
      /^(?:그|이|해당|같은)\s+/.test(next) && rejectedCallback.test(next) ||
      closedCallbackChannel.test(next)) return false;

  const availability = callbackField.test(before) && onlyNumber.exec(after);
  if (availability && !noExclusiveRoute.test(after) && !pastAvailability.test(after.slice(availability[0].length))) return true;

  const condition = noResponseAtNumber.exec(after);
  if (!condition) return false;
  const consequence = after.slice(condition[0].length).trimEnd();
  return coerciveConsequence.test(consequence.slice(0, 44)) && !deniedConsequence.test(consequence);
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
    return (desk.test(before) && deskAction.test(after)) || (reportRisk.test(before) && verifyByPhone.test(after)) ||
      hasConstrainedCallback(text, t);
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
