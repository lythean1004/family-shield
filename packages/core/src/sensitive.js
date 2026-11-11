/**
 * 민감정보(건강정보) 처리 (작업 ⑦, 제23조, docs/sensitive-info-handling.md, 운영자 결정 B + C 일부)
 *
 * - 건강 관련 표현이 있고 사기 요구·미끼가 보이지 않으면(진짜 병원·약국·검진 안내로 봄) 해외 AI로 보내지 않는다.
 *   판정은 원래 규칙이 하므로 바뀌지 않고, 설명 문장만 고정 문구가 된다.
 * - 사기 요구·미끼가 있으면 AI를 쓰되, 진료과·검사·질환·처방 단어는 [건강정보]로 가린다.
 *   “병원·입원·검진” 같은 미끼 문맥은 남겨 AI가 수법을 볼 수 있게 한다.
 * - 건강보험(보험료 안내)은 건강정보로 보지 않는다.
 */

// 건강 관련 표현(찾기용). “암”·“정신” 단독은 일반 단어와 겹쳐 쓰지 않는다
const HEALTH_RE = /(병원|의원|보건소|진료|진찰|검사 ?결과|혈액 ?검사|건강 ?검진|검진|진단|처방|질병|질환|입원|퇴원|수술|백신|예방 ?접종|접종|약국|조제|투약|복약|혈압|혈당|당뇨|치매|암 ?(?:검사|진단|환자)|항암|산부인과|치과|한의원|응급실|재활|투석)/;

// 가릴 단어: 진료과·검사·질환·처방(사람을 알아볼 수 있는 건강 상태)
const MASK_TERMS = [
  "정신건강의학과", "산부인과", "정형외과", "비뇨기과", "이비인후과", "피부과", "신경과", "내과", "외과", "안과", "치과", "소아과",
  "혈액검사", "조직검사", "내시경", "초음파", "MRI", "CT", "X-ray", "엑스레이",
  "고혈압", "저혈압", "당뇨병", "당뇨", "치매", "우울증", "공황장애", "뇌졸중", "골절", "디스크", "갑상선", "임신", "난임",
  "처방전", "처방약", "항암제", "인슐린",
].sort((a, b) => b.length - a.length);
// 영문 검사명(CT·MRI 등)은 앞뒤가 영문자가 아닐 때만(CCTV 속 CT 오인식 방지). 목록에 정규식 특수문자 없음
const MASK_SOURCE = MASK_TERMS.map((t) => (/^[A-Za-z-]+$/.test(t) ? `(?<![A-Za-z])${t}(?![A-Za-z])` : t)).join("|");
const MASK_RE = new RegExp(MASK_SOURCE, "gi");
const MASK_TEST_RE = new RegExp(MASK_SOURCE, "i"); // 찾기용(전역 플래그 없이)

// 코드 요구 신호(링크 신호는 진짜 안내에도 흔해 넣지 않는다)
const REQUEST_SIGNALS = new Set([
  "SIG_MONEY", "SIG_GIFTCARD", "SIG_PERSONAL_INFO", "SIG_APP_INSTALL",
  "SIG_AGENCY_IMPERSONATION", "SIG_CALL_THIS_NUMBER", "SIG_NEW_NUMBER",
]);
// 코드 신호가 없어도 사기 미끼로 볼 표현: 금액, 송금, 병원비류, 가족 호칭, 번호·기기 변경, 재촉.
// 법적 위협(영장·체포·압류 등)은 기관 사칭 미끼(TEST-B065)
const SCAM_CUE_RE = /(영장|체포|구속|압류|소송|출석|수사|벌금|과태료|미납|연체|정지 ?예정|마지막 ?안내|\d[\d,]*\s*만?\s*원|병원비|치료비|수술비|입원비|보내 ?줘|보내 ?주|송금|입금|이체|계좌|엄마|아빠|딸이야|딸인데|아들이야|아들인데|나야|번호 ?바꿨|기기 ?바꿨|폰 ?(?:고장|액정)|새 ?번호|급해|빨리)/;

export function hasHealthInfo(text) {
  const t = String(text ?? "").replace(/건강\s*보험/g, "");
  return HEALTH_RE.test(t) || MASK_TEST_RE.test(t);
}

export function maskHealth(text) {
  return String(text ?? "").replace(MASK_RE, "[건강정보]");
}

/** 건강 표현이 있고 요구 신호·미끼가 없으면 true(해외 AI로 보내지 않음) */
export function shouldSkipAiForHealth(text, codeSignals = []) {
  if (!hasHealthInfo(text)) return false;
  if (codeSignals.some((s) => REQUEST_SIGNALS.has(s))) return false;
  return !SCAM_CUE_RE.test(text);
}
