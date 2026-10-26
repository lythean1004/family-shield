/**
 * SIG_* 신호 ID 상수 (PRD 9-3)
 * 코드와 AI가 같은 ID를 쓴다. 코드 전용/AI 전용/공용으로 주석 구분.
 */

// 코드 전용
export const SIG_LINK               = "SIG_LINK";
export const SIG_SHORT_URL          = "SIG_SHORT_URL";
export const SIG_MALICIOUS_URL      = "SIG_MALICIOUS_URL";

// 코드 + AI 공용
export const SIG_APP_INSTALL        = "SIG_APP_INSTALL";
export const SIG_MONEY              = "SIG_MONEY";
export const SIG_GIFTCARD           = "SIG_GIFTCARD";
export const SIG_PERSONAL_INFO      = "SIG_PERSONAL_INFO";
export const SIG_NEW_NUMBER         = "SIG_NEW_NUMBER";

// AI 전용
export const SIG_DELETE_APP         = "SIG_DELETE_APP";
export const SIG_PREPAYMENT         = "SIG_PREPAYMENT";
export const SIG_THIRD_PARTY_ACCOUNT= "SIG_THIRD_PARTY_ACCOUNT";
export const SIG_FAMILY_IMPERSONATION = "SIG_FAMILY_IMPERSONATION";
export const SIG_AGENCY_IMPERSONATION = "SIG_AGENCY_IMPERSONATION";
export const SIG_URGENCY            = "SIG_URGENCY";
export const SIG_SECRECY            = "SIG_SECRECY";
export const SIG_ISOLATION          = "SIG_ISOLATION";
export const SIG_AVOID_VOICE        = "SIG_AVOID_VOICE";
export const SIG_CALL_THIS_NUMBER   = "SIG_CALL_THIS_NUMBER";

/** AI 출력에 허용되는 신호 집합 (코드 전용 3개는 AI가 반환하면 무시) */
export const AI_ALLOWED_SIGNALS = new Set([
  SIG_APP_INSTALL, SIG_MONEY, SIG_GIFTCARD, SIG_PERSONAL_INFO, SIG_NEW_NUMBER,
  SIG_DELETE_APP, SIG_PREPAYMENT, SIG_THIRD_PARTY_ACCOUNT,
  SIG_FAMILY_IMPERSONATION, SIG_AGENCY_IMPERSONATION,
  SIG_URGENCY, SIG_SECRECY, SIG_ISOLATION, SIG_AVOID_VOICE, SIG_CALL_THIS_NUMBER,
]);

/** impersonated_relation 허용 값 11개 (PRD 9-5) */
export const ALLOWED_RELATIONS = new Set([
  "아들", "딸", "남편", "아내", "엄마", "아빠",
  "형", "오빠", "누나", "언니", "동생",
]);

export const IMPERSONATION_TYPES = new Set(["family", "agency", "none", "unknown"]);
