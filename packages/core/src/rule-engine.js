/**
 * 규칙 엔진 (PRD 9-7)
 *
 * decide(context) → { level: "위험"|"주의"|"확인필요", fired_rules: string[] }
 *
 * context 구성:
 *   signals_final : string[]  - 코드+AI 합집합 신호
 *   signals_code  : string[]? - 코드 신호만(R13 압박 조건). 없으면 합집합
 *   call_in_progress : boolean - 지금 통화 중 (P1)
 *   called_before    : boolean - 전화를 받은 뒤 문자가 왔는지 (P2)
 *   family_denied    : boolean - 가족이 "보낸 적 없어요" 또는 P7 확인 (R5)
 *
 * 판정은 올라가기만 한다. 가장 높은 단계를 반환한다.
 */

import {
  SIG_LINK, SIG_APP_INSTALL, SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER,
  SIG_MONEY, SIG_GIFTCARD, SIG_AVOID_VOICE, SIG_AGENCY_IMPERSONATION,
  SIG_PERSONAL_INFO, SIG_CALL_THIS_NUMBER, SIG_URGENCY, SIG_SECRECY,
  SIG_ISOLATION, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT, SIG_DELETE_APP,
  SIG_MALICIOUS_URL, SIG_SB_UNSAFE_URL, SIG_LOOKALIKE_DOMAIN, SIG_NEW_DOMAIN, SIG_OFFICIAL_LINK,
  SIG_DECEPTIVE_URL, SIG_CASH_HANDOVER, SIG_CREDENTIAL_DISCLOSURE, SIG_DOCUMENT_BUNDLE, SIG_LOAN_CASH_PICKUP,
} from "./signals.js";

const LEVELS = { 확인필요: 0, 주의: 1, 위험: 2 };

function higher(a, b) {
  return LEVELS[a] >= LEVELS[b] ? a : b;
}

/**
 * @param {{
 *   signals_final: string[],
 *   call_in_progress?: boolean,
 *   called_before?: boolean,
 *   family_denied?: boolean,
 * }} context
 * @returns {{ level: string, fired_rules: string[] }}
 */
export function decide(context) {
  const {
    signals_final = [],
    signals_code = null,
    call_in_progress = false,
    called_before = false,
    family_denied = false,
  } = context;

  const sig = new Set(signals_final);
  const codeSignals = signals_code ? new Set(signals_code) : sig;
  let level = "확인필요";
  const fired = [];

  function fire(ruleId, nextLevel) {
    fired.push(ruleId);
    level = higher(level, nextLevel);
  }

  // R1: 지금 통화 중
  if (call_in_progress) fire("R1", "위험");

  // R2: 전화를 받은 뒤 + (링크 or 앱 설치 요구)
  if (called_before && (sig.has(SIG_LINK) || sig.has(SIG_APP_INSTALL))) fire("R2", "위험");

  // R3: 가족 사칭 + 새 번호 + (돈 or 상품권 요구)
  if (sig.has(SIG_FAMILY_IMPERSONATION) && sig.has(SIG_NEW_NUMBER) &&
      (sig.has(SIG_MONEY) || sig.has(SIG_GIFTCARD))) fire("R3", "위험");

  // D51·D52: 새 연락처를 쓰는 가족의 민감한 요구, 수사기관을 자처한 현금 대면 인계.
  if (sig.has(SIG_FAMILY_IMPERSONATION) && sig.has(SIG_NEW_NUMBER) &&
      (sig.has(SIG_PERSONAL_INFO) || sig.has(SIG_APP_INSTALL))) fire("R14", "위험");
  if (sig.has(SIG_CASH_HANDOVER)) fire("R15", "위험");
  if (codeSignals.has(SIG_CREDENTIAL_DISCLOSURE)) fire("R16", "위험");
  if (codeSignals.has(SIG_DOCUMENT_BUNDLE)) fire("R17", "위험");
  if (codeSignals.has(SIG_LOAN_CASH_PICKUP)) fire("R18", "위험");

  // R13: 가족 사칭 + (상품권 요구, 또는 돈 요구 + 압박[재촉·통화 회피·비밀·고립]).
  // 카카오는 보낸 번호를 받지 않아 R3의 '새 번호'가 없을 수 있다(D45). 압박 조건은 “용돈 보냈어” 같은
  // 정상 가족 송금 알림의 오경보를 막는다(기록된 AI 결과 3회: 잡는 사기 같음, 새 오경보 3·3·1 → 0)
  // 2026-11-12: 압박은 코드가 찾은 신호만 본다. AI가 “저녁에 전화할게”에 통화 회피를 붙이거나(SUP-D01 오경보)
  // “전화는 못 받아”를 놓쳐(SUP-A03) 판정이 흔들렸다. signals_code가 없으면(이전 기록 재계산) 합집합을 쓴다.
  if (sig.has(SIG_FAMILY_IMPERSONATION) &&
      (sig.has(SIG_GIFTCARD) ||
       (sig.has(SIG_MONEY) && (codeSignals.has(SIG_URGENCY) || codeSignals.has(SIG_AVOID_VOICE) ||
                               codeSignals.has(SIG_SECRECY) || codeSignals.has(SIG_ISOLATION))))) fire("R13", "위험");

  // R4: 가족 사칭 + 통화를 피함. 통화 회피는 코드가 찾은 신호만 본다(D46, 기록된 AI 결과 재계산 오경보 11→2, 놓침 변화 없음)
  if (sig.has(SIG_FAMILY_IMPERSONATION) && codeSignals.has(SIG_AVOID_VOICE)) fire("R4", "위험");

  // R5: 가족이 "보낸 적 없어요" 확인
  if (family_denied) fire("R5", "위험");

  // 링크가 모두 근거 카드의 공식 주소인지(코드가 판단). 공식 링크 표시는 코드 신호만 인정한다(AI가 끼워 넣을 수 없음)
  const officialOnly = codeSignals.has(SIG_OFFICIAL_LINK);

  // R6: 기관 사칭 + (링크, 앱 설치, 개인정보, 문자 속 번호로 전화 유도 중 하나)
  // 링크가 모두 공식 주소면 링크만으로는 R6를 켜지 않는다(실제 기관 안내 “[국세청] … hometax.go.kr”, D48).
  // 앱 설치·개인정보·전화 유도가 함께 있으면 그대로 위험이다
  if (sig.has(SIG_AGENCY_IMPERSONATION) &&
      ((sig.has(SIG_LINK) && !officialOnly) || sig.has(SIG_APP_INSTALL) ||
       sig.has(SIG_PERSONAL_INFO) || sig.has(SIG_CALL_THIS_NUMBER))) fire("R6", "위험");

  // R9: 고립 요구, 선입금 요구, 개인 계좌 입금, 앱 삭제 지시
  if (sig.has(SIG_ISOLATION) || sig.has(SIG_PREPAYMENT) ||
      sig.has(SIG_THIRD_PARTY_ACCOUNT) || sig.has(SIG_DELETE_APP)) fire("R9", "위험");

  // R10: 악성 URL
  if (sig.has(SIG_MALICIOUS_URL) || sig.has(SIG_SB_UNSAFE_URL)) fire("R10", "위험");

  // R11: 공식 주소를 흉내 낸 링크(D40 ②), 주소 앞부분을 공식 주소처럼 꾸민 링크(https://공식@가짜, D48)
  if (sig.has(SIG_LOOKALIKE_DOMAIN) || sig.has(SIG_DECEPTIVE_URL)) fire("R11", "위험");

  // R12: 만든 지 30일 안 된 링크 도메인 + (돈, 개인정보, 앱 설치 요구 중 하나). 재촉은 정상 광고와 겹쳐 뺌(D41)
  if (sig.has(SIG_NEW_DOMAIN) &&
      (sig.has(SIG_MONEY) || sig.has(SIG_PERSONAL_INFO) || sig.has(SIG_APP_INSTALL))) fire("R12", "위험");

  // R7: 링크, 돈, 개인정보, 재촉, 비밀 중 하나 / 또는 가족 사칭+새 번호
  // 링크가 모두 근거 카드의 공식 주소(코드가 판단)면 링크만으로는 주의를 내지 않는다(멘토링 2026-11-26, D47).
  // R2의 링크 조건(전화 받은 뒤 링크)은 공식 주소여도 그대로다
  // 링크가 모두 공식 주소면 재촉·돈·비밀은 코드가 찾은 것만 본다. AI가 “신고 기간입니다”에 재촉을 붙여
  // 진짜 기관 안내가 주의로 나왔다(카카오 2026-11-26, D49). 개인정보 요구와 R6·R9 위험 조건은 AI 신호도 그대로 본다
  const r7 = officialOnly ? new Set(signals_code ?? []) : sig;
  if ((sig.has(SIG_LINK) && !officialOnly) || r7.has(SIG_MONEY) || sig.has(SIG_PERSONAL_INFO) ||
      r7.has(SIG_URGENCY) || r7.has(SIG_SECRECY) ||
      (sig.has(SIG_FAMILY_IMPERSONATION) && sig.has(SIG_NEW_NUMBER))) fire("R7", "주의");

  // R8: 위 조건 없음 → 확인필요 (기본값이므로 별도 처리 없음)
  if (fired.length === 0) fired.push("R8");

  return { level, fired_rules: fired };
}
