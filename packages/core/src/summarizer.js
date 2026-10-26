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
 * 마지막 글자에 받침이 있으면 "이라고", 없으면 "라고" (딸이라고 / 엄마라고)
 * @param {string} word
 */
function withRago(word) {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const hasFinal = isHangul && (code - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? "이라고" : "라고"} 함`;
}

/**
 * 신호 ID → 문구 배열 (알 수 없는 ID는 빠지고, 같은 문구는 한 번만)
 * 웹 SignalList와 자녀 알림 요약이 같은 표를 쓴다.
 * @param {string[]} signals
 * @param {{ impersonated_relation?: string | null }} [meta]
 * @returns {string[]}
 */
export function summarizePhrases(signals, meta = {}) {
  const phrases = signals.flatMap((id) => {
    if (id === "SIG_FAMILY_IMPERSONATION") {
      const rel = meta.impersonated_relation;
      return rel ? [withRago(rel)] : ["가족이라고 함"];
    }
    const phrase = SIGNAL_PHRASE[id];
    return phrase ? [phrase] : [];
  });
  return [...new Set(phrases)];
}

/**
 * @param {string[]} signals
 * @param {{ impersonated_relation?: string | null }} [meta]
 * @returns {string}
 */
export function summarize(signals, meta = {}) {
  return summarizePhrases(signals, meta).join(" · ");
}
