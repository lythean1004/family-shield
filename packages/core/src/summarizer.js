/**
 * 자녀 알림 요약 문구 만들기 (PRD 9-9)
 *
 * summarize(signals) → string
 * 신호 ID를 정해 둔 한국어 문구로 바꿔 " · "로 잇는다.
 * AI가 쓴 설명은 쓰지 않는다.
 */

const SIGNAL_PHRASE = {
  SIG_NEW_NUMBER:           "새 번호로 연락",
  SIG_LINK:                 "링크 포함",
  SIG_GIFTCARD:             "상품권 결제 부탁",
  SIG_APP_INSTALL:          "앱 설치 요구",
  SIG_MONEY:                "송금 요구",
  SIG_DELETE_APP:           "앱 삭제 지시",
  SIG_PERSONAL_INFO:        "개인정보 요구",
  SIG_PREPAYMENT:           "선입금 요구",
  SIG_AGENCY_IMPERSONATION: "기관이라고 함",
  SIG_ISOLATION:            "혼자 있으라고 함",
  SIG_URGENCY:              "급하게 재촉",
  SIG_SECRECY:              "비밀로 하라고 함",
  SIG_AVOID_VOICE:          "통화를 피함",
  SIG_CALL_THIS_NUMBER:     "특정 번호로 전화 유도",
  SIG_THIRD_PARTY_ACCOUNT:  "개인 계좌로 입금 요구",
  SIG_SHORT_URL:            "단축 링크 포함",
  SIG_MALICIOUS_URL:        "위험한 링크로 확인됨",
  // SIG_FAMILY_IMPERSONATION은 relation과 함께 동적으로 처리
};

/**
 * @param {string[]} signals
 * @param {{ impersonated_relation?: string | null }} [meta]
 * @returns {string}
 */
export function summarize(signals, meta = {}) {
  const phrases = signals.flatMap((id) => {
    if (id === "SIG_FAMILY_IMPERSONATION") {
      const rel = meta.impersonated_relation;
      return rel ? [`${rel}이라고 함`] : ["가족이라고 함"];
    }
    const phrase = SIGNAL_PHRASE[id];
    return phrase ? [phrase] : [];
  });

  return phrases.join(" · ");
}
