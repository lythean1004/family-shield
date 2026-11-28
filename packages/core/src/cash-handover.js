// D50·D52의 수사·감독 기관 범위. 세금·공과금 납부 공지는 별도로 취급한다.
export const INVESTIGATIVE = "(?:대검찰청|검찰(?:청)?|지검|경찰(?:청|서)?|금융감독원|금감원|법원|수사관|수사팀|검사)";

const role = "(?:" + INVESTIGATIVE + "|형사(?:과)?|경찰관)";
const claim = new RegExp("^\\s*(?:\\[Web발신\\]\\s*)?(?:\\[[가-힣 ]{0,14}" + role + "\\]|" +
  "(?:(?:아까|방금|앞서)\\s*(?:전화|연락|통화)[가-힣]{1,5}\\s*)?[가-힣]{0,10}" + role +
  "(?:[ \\t]+[가-힣a-zA-Z○●*]{1,8}){0,3}(?:입니다|인데요)(?=[\\s.!?,]|$))", "i");
const cash = "(?:현금|현찰)(?:은|을|만)?\\s*";
const person = "(?:(?:" + INVESTIGATIVE + "|담당)\\s*)?(?:직원|담당자|대리인|수사관|요원)";
const ask = "(?:주세요|줘|세요|십시오|해\\s*주세요|하세요|하십시오|바랍니다)";
const delivery = new RegExp(cash + "(?:" + person + "(?:에게|한테)\\s*(?:직접\\s*)?(?:건네|전달|넘겨|맡겨)|" +
  "지정(?:한|된)\\s*장소에\\s*(?:두|놓아|맡겨))\\s*" + ask + "(?=[\\s.!?]|$)");
// 2026-11-28 v15 B05: “현금은 내일 오전 직원이 방문해 직접 수거합니다” — 때 표현이 끼고 ‘방문해 수거합니다’로 끝나도 같은 요구다
const when = "(?:(?:오늘|내일|모레|금일|오전|오후|저녁|중|\\d{1,2}\\s*시)\\s*){0,4}";
const collection = new RegExp(cash + when + person + "(?:이|가)\\s*" + when + "(?:(?:댁|집|현장|자택)(?:에|으로)\\s*)?(?:직접\\s*)?" +
  "(?:(?:받으러|가지러|수거하러)\\s*(?:갑니다|갈\\s*겁니다|방문합니다)|" +
  "방문(?:해|하여|해서)\\s*(?:직접\\s*)?(?:수거|수령|회수)(?:합니다|하겠습니다|할\\s*예정입니다))(?=[\\s.!?]|$)");
const prevention = /[‘’“”"'「」]|(?:분실물|습득물|유실물|예방|예시|사칭\s*주의)|(?:라고|라는)\s*(?:말|문자|요구)/;

const reportedOfficer = new RegExp("(?:" + role + "|(?:수사|감독|형사\\s*조사)\\s*(?:기관|담당자))(?:\\s*소속)?" +
  "(?:(?:이|가)\\s*(?:썼|보냈|작성했)다는|이?라(?:고|는|며)\\s*(?:적힌|소개|밝힌|발신|쓴|한))");
const visit = /방문|댁으로|집(?:에|으로)\s*온/;
const giveToVisitor = /(?:현금|현찰)(?:을|은|만)?\s*(?:방문(?:한)?\s*(?:직원|담당자)|방문자|수사관|대리인)(?:에게|한테)\s*(?:직접\s*)?(?:건네|넘기|인계하|전달하)(?:는\s*(?:게|것|일)|야)[^.!?\n]{0,16}(?:필수|조건|제\s*(?:몫|역할)|한다고)/;
const collectFromRecipient = /(?:제게서|저한테서|나에게서|내게서|저에게서)\s*(?:현금|현찰)(?:을|만)?\s*(?:직접\s*)?(?:받아|가져)\s*(?:갈\s*(?:절차|예정)|간다는\s*(?:절차|내용|예정))/;
const noCollection = /(?:사례|교육|분실|습득|반환|돌려[받주]|거절했|철회했)|(?:연극|드라마|영화)\s*(?:대본|배역|장면)|(?:뜻|일|절차)(?:이|은|가)?\s*아니|(?:받|건네|넘기|수거하)지\s*(?:말|마|않)/;

export function readInvestigativeCashDocument(text) {
  const source = reportedOfficer.exec(text);
  if (!source || source.index !== 0 || !/(?:썼|작성했|보냈)다는$/.test(source[0])) return null;
  const following = text.slice(source[0].length);
  if (!/^\s*(?:통지서|통지문|안내문|문서|고지서|공문)(?:에|에는|의)/u.test(following)) return null;
  return { index: source.index, 0: source[0], groups: { role: "수사기관", unit: "" } };
}

function reportsHandover(text) {
  if (!reportedOfficer.test(text) || noCollection.test(text)) return false;
  const sentences = text.split(/[.!?\n]+/u).map(sentence => sentence.trim()).filter(Boolean);
  return sentences.some((sentence, i) => {
    const sender = reportedOfficer.exec(sentence);
    if (!sender || prevention.test(sentence)) return false;
    const action = sentence.slice(sender.index + sender[0].length);
    if (giveToVisitor.test(action)) return true;
    return visit.test(action) && (collectFromRecipient.test(action) ||
      collectFromRecipient.exec(sentences[i + 1] ?? "")?.index === 0);
  });
}

// 금융위의 대면편취 유형. 실제 수령인·현금·인계 요구가 한 문장에 있어야 한다.
// https://www.fsc.go.kr/po010106/78643
export function hasInvestigativeCashHandover(text) {
  if (claim.test(text) && text.split(/[.!?\n]/).some(clause =>
    !prevention.test(clause) && (delivery.test(clause) || collection.test(clause)))) return true;
  return reportsHandover(text);
}

const repayment = /(?:대출(?:금)?|융자금)(?:의|을)?\s*상환/;
// 2026-11-28 v15 C07: “저희 직원이 방문 수거합니다” — 회사 이름 없이 ‘저희’만 써도 같다
const companyStaff = "(?:(?:저희|우리|해당)\\s*(?:(?:회사|은행|금융사|캐피탈)\\s*)?|당행|당사|금융회사|은행|캐피탈)\\s*(?:담당\\s*)?직원이?";
const visitTime = "(?:(?:오늘|내일|금일|오전|오후|직접|댁으로|집으로|자택으로|자택에)\\s*){0,4}";
const inCash = "현금(?:으로|을|은)?\\s*";
const collects = "(?:방문\\s*(?:수령|수거)(?:합니다|하겠습니다)|(?:받으러|수거하러)\\s*(?:갑니다|방문합니다))";
const atCustomer = new RegExp("(?:" + inCash + "(?:준비(?:해\\s*주시면|하면|하시면)\\s*)?" + companyStaff + "\\s*" + visitTime + collects +
  "|" + companyStaff + "\\s*" + visitTime + "방문(?:해|하여|해서)\\s*" + inCash + "(?:수거|수령)(?:합니다|하겠습니다))(?=[\\s.,!]|$)");

export function hasLoanCashPickup(text) {
  const clauses = text.split(/[.!?\n]/).filter(s => s.trim());
  return clauses.some((clause, i) => {
    const notice = clauses.slice(Math.max(0, i - 1), i + 1).join(" ");
    return repayment.test(notice) && !prevention.test(notice) && atCustomer.test(clause);
  });
}
