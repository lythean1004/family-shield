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
const collection = new RegExp(cash + person + "(?:이|가)\\s*(?:(?:댁|집|현장)(?:에|으로)\\s*)?(?:직접\\s*)?" +
  "(?:받으러|가지러|수거하러)\\s*(?:갑니다|갈\\s*겁니다|방문합니다)(?=[\\s.!?]|$)");
const prevention = /[‘’“”"'「」]|(?:분실물|습득물|유실물|예방|예시|사칭\s*주의)|(?:라고|라는)\s*(?:말|문자|요구)/;

// 금융위의 대면편취 유형. 실제 수령인·현금·인계 요구가 한 문장에 있어야 한다.
// https://www.fsc.go.kr/po010106/78643
export function hasInvestigativeCashHandover(text) {
  if (!claim.test(text)) return false;
  return text.split(/[.!?\n]/).some(clause =>
    !prevention.test(clause) && (delivery.test(clause) || collection.test(clause)));
}
