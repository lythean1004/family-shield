/**
 * 규칙 엔진 (PRD 9-7)
 *
 * decide(context) → { level: "위험"|"주의"|"확인필요", fired_rules: string[] }
 *
 * context 구성:
 *   signals_final : string[]  - 코드+AI 합집합 신호
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
  SIG_MALICIOUS_URL,
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
    call_in_progress = false,
    called_before = false,
    family_denied = false,
  } = context;

  const sig = new Set(signals_final);
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

  // R4: 가족 사칭 + 통화를 피함
  if (sig.has(SIG_FAMILY_IMPERSONATION) && sig.has(SIG_AVOID_VOICE)) fire("R4", "위험");

  // R5: 가족이 "보낸 적 없어요" 확인
  if (family_denied) fire("R5", "위험");

  // R6: 기관 사칭 + (링크, 앱 설치, 개인정보, 문자 속 번호로 전화 유도 중 하나)
  if (sig.has(SIG_AGENCY_IMPERSONATION) &&
      (sig.has(SIG_LINK) || sig.has(SIG_APP_INSTALL) ||
       sig.has(SIG_PERSONAL_INFO) || sig.has(SIG_CALL_THIS_NUMBER))) fire("R6", "위험");

  // R9: 고립 요구, 선입금 요구, 개인 계좌 입금, 앱 삭제 지시
  if (sig.has(SIG_ISOLATION) || sig.has(SIG_PREPAYMENT) ||
      sig.has(SIG_THIRD_PARTY_ACCOUNT) || sig.has(SIG_DELETE_APP)) fire("R9", "위험");

  // R10: 악성 URL
  if (sig.has(SIG_MALICIOUS_URL)) fire("R10", "위험");

  // R7: 링크, 돈, 개인정보, 재촉, 비밀 중 하나 / 또는 가족 사칭+새 번호
  if (sig.has(SIG_LINK) || sig.has(SIG_MONEY) || sig.has(SIG_PERSONAL_INFO) ||
      sig.has(SIG_URGENCY) || sig.has(SIG_SECRECY) ||
      (sig.has(SIG_FAMILY_IMPERSONATION) && sig.has(SIG_NEW_NUMBER))) fire("R7", "주의");

  // R8: 위 조건 없음 → 확인필요 (기본값이므로 별도 처리 없음)
  if (fired.length === 0) fired.push("R8");

  return { level, fired_rules: fired };
}
