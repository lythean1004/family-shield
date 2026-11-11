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
  SIG_MALICIOUS_URL, SIG_SB_UNSAFE_URL, SIG_LOOKALIKE_DOMAIN, SIG_NEW_DOMAIN,
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

  // R13: 가족 사칭 + (상품권 요구, 또는 돈 요구 + 압박[재촉·통화 회피·비밀·고립]).
  // 카카오는 보낸 번호를 받지 않아 R3의 '새 번호'가 없을 수 있다(D45). 압박 조건은 “용돈 보냈어” 같은
  // 정상 가족 송금 알림의 오경보를 막는다(기록된 AI 결과 3회: 잡는 사기 같음, 새 오경보 3·3·1 → 0)
  // 2026-11-12: 압박은 코드가 찾은 신호만 본다. AI가 “저녁에 전화할게”에 통화 회피를 붙이거나(SUP-D01 오경보)
  // “전화는 못 받아”를 놓쳐(SUP-A03) 판정이 흔들렸다. signals_code가 없으면(이전 기록 재계산) 합집합을 쓴다.
  const pressure = signals_code ? new Set(signals_code) : sig;
  if (sig.has(SIG_FAMILY_IMPERSONATION) &&
      (sig.has(SIG_GIFTCARD) ||
       (sig.has(SIG_MONEY) && (pressure.has(SIG_URGENCY) || pressure.has(SIG_AVOID_VOICE) ||
                               pressure.has(SIG_SECRECY) || pressure.has(SIG_ISOLATION))))) fire("R13", "위험");

  // R4: 가족 사칭 + 통화를 피함. 통화 회피는 코드가 찾은 신호만 본다(D46, 기록된 AI 결과 재계산 오경보 11→2, 놓침 변화 없음)
  if (sig.has(SIG_FAMILY_IMPERSONATION) && pressure.has(SIG_AVOID_VOICE)) fire("R4", "위험");

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
  if (sig.has(SIG_MALICIOUS_URL) || sig.has(SIG_SB_UNSAFE_URL)) fire("R10", "위험");

  // R11: 공식 주소를 흉내 낸 링크(D40 ②)
  if (sig.has(SIG_LOOKALIKE_DOMAIN)) fire("R11", "위험");

  // R12: 만든 지 30일 안 된 링크 도메인 + (돈, 개인정보, 앱 설치 요구 중 하나). 재촉은 정상 광고와 겹쳐 뺌(D41)
  if (sig.has(SIG_NEW_DOMAIN) &&
      (sig.has(SIG_MONEY) || sig.has(SIG_PERSONAL_INFO) || sig.has(SIG_APP_INSTALL))) fire("R12", "위험");

  // R7: 링크, 돈, 개인정보, 재촉, 비밀 중 하나 / 또는 가족 사칭+새 번호
  if (sig.has(SIG_LINK) || sig.has(SIG_MONEY) || sig.has(SIG_PERSONAL_INFO) ||
      sig.has(SIG_URGENCY) || sig.has(SIG_SECRECY) ||
      (sig.has(SIG_FAMILY_IMPERSONATION) && sig.has(SIG_NEW_NUMBER))) fire("R7", "주의");

  // R8: 위 조건 없음 → 확인필요 (기본값이므로 별도 처리 없음)
  if (fired.length === 0) fired.push("R8");

  return { level, fired_rules: fired };
}
