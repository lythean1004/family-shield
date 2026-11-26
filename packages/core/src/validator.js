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
  /이상(?:이|은|도)?\s*없/u,
  /SIG_/i,
  // 사기 단정·일반화(카카오 2026-11-27 “돈을 보내라는 내용은 모두 사기입니다.”). 판정은 규칙이 하고,
  // 결과는 참고용이라 단정하지 않는다. “절대 누르지 마세요” 같은 행동 안내는 막지 않는다
  /(?:모두|모든|전부|무조건|100\s*%|백\s*퍼센트|틀림없이|확실히|분명히|반드시)[^.!?]{0,15}사기/u,
  /사기(?:가|임이|인\s*게|인\s*것이)?\s*(?:확실|틀림없|분명)/u,
];

/** 화면에 낼 수 있는 완결된 문장만 남긴다. 평문 QR·ATM 같은 약어는 한국어 안내에 쓸 수 있다. */
export function filterExplanation(sentences) {
  return sentences.filter(s => typeof s === "string").map(s => s.trim())
    .filter(s => [...s].length <= 40 && /\p{Script=Hangul}/u.test(s) &&
      !/[^\p{Script=Hangul}A-Za-z0-9 .,!?…·'"‘’“”()%-]/u.test(s) &&
      !SENTENCE_BLOCK_RE.some(re => re.test(s)))
    .slice(0, 3);
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

  const explanation = filterExplanation(rawExp);

  return {
    ok: true,
    data: { signals, impersonation_type: impersonationType, impersonated_relation: relation, evidence_card_ids: evidenceCardIds, explanation_for_parent: explanation },
  };
}
