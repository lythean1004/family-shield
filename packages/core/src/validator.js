/**
 * AI 출력 검증기 (PRD 9-5, 9-6)
 *
 * validate(raw, allowedCardIds?) → { ok: true, data } | { ok: false, reason }
 *
 * 통과하면 정리된 data를 반환한다.
 * 실패하면 ok: false와 이유를 반환한다 → 호출자가 고정 안내로 전환한다.
 */
import { AI_ALLOWED_SIGNALS, IMPERSONATION_TYPES, ALLOWED_RELATIONS } from "./signals.js";

// 설명 문장 하나를 걸러내는 규칙 (PRD 9-6)
const SENTENCE_BLOCK_RE = [
  /\d{4,}/,            // 숫자 4개 이상 연속
  /https?:\/\//i,      // URL
  /www\./i,
  /안전/,
  /정상/,
];

function filterExplanation(sentences) {
  return sentences.filter(
    (s) => !SENTENCE_BLOCK_RE.some((re) => re.test(s))
  );
}

/**
 * @param {unknown} raw - JSON.parse 결과
 * @param {Set<string>} [allowedCardIds] - 허용된 근거 카드 ID 집합
 * @returns {{ ok: true, data: object } | { ok: false, reason: string }}
 */
export function validate(raw, allowedCardIds = new Set()) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "출력이 객체가 아님" };
  }

  // ── signals ──────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.signals)) {
    return { ok: false, reason: "signals가 배열이 아님" };
  }
  const signals = raw.signals.filter((s) => {
    if (typeof s !== "string") return false;
    return AI_ALLOWED_SIGNALS.has(s); // 허용 목록 밖은 조용히 버린다
  });

  // ── impersonation_type ────────────────────────────────────────────────────
  const rawType = raw.impersonation_type;
  if (typeof rawType !== "string" || !IMPERSONATION_TYPES.has(rawType)) {
    return { ok: false, reason: `impersonation_type 값 오류: ${rawType}` };
  }

  // ── impersonated_relation ────────────────────────────────────────────────
  let relation = raw.impersonated_relation ?? null;
  if (relation !== null && !ALLOWED_RELATIONS.has(relation)) {
    relation = null; // 허용 목록 밖은 null로
  }

  // family인데 관계가 없으면 unknown (PRD 9-6)
  let impersonationType = rawType;
  if (rawType === "family" && relation === null) {
    impersonationType = "unknown";
  }

  // ── evidence_card_ids ────────────────────────────────────────────────────
  const rawCards = raw.evidence_card_ids;
  if (!Array.isArray(rawCards)) {
    return { ok: false, reason: "evidence_card_ids가 배열이 아님" };
  }
  const evidenceCardIds = rawCards
    .filter((id) => typeof id === "string" && (allowedCardIds.size === 0 || allowedCardIds.has(id)))
    .slice(0, 3); // 최대 3개

  // ── explanation_for_parent ───────────────────────────────────────────────
  const rawExp = raw.explanation_for_parent;
  if (!Array.isArray(rawExp)) {
    return { ok: false, reason: "explanation_for_parent가 배열이 아님" };
  }

  // 40자 초과 문장 자르기, 빈 문장 제거, 차단 패턴 통과, 최대 3문장
  const explanation = filterExplanation(
    rawExp
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 40))
  ).slice(0, 3);

  return {
    ok: true,
    data: { signals, impersonation_type: impersonationType, impersonated_relation: relation, evidence_card_ids: evidenceCardIds, explanation_for_parent: explanation },
  };
}
