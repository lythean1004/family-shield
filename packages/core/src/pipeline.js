/**
 * 판별 파이프라인 (PRD 9-1, F4-5, 13-3)
 *
 * analyze(input) → 판별 결과 (원문 없음)
 *
 * ① 코드로 신호 뽑기 → ② 마스킹 → ③ AI(도구 호출) → ④ 검증(ai-client 안에서)
 * → ⑤ 신호 합치기 + 부모님 입력 → ⑥ 규칙 엔진 → ⑦ 요약 문구
 *
 * - 카카오 스킬 서버와 평가 실행기가 같이 쓴다(채널마다 모델·시간 제한만 다름).
 * - ③④가 실패해도 ①과 부모님 입력만으로 ⑥이 판정한다(fallback_used=true).
 * - 반환값에는 원문도 마스킹된 문장도 담지 않는다. 호출자는 원문을 버린다.
 */
import { extractCodeSignals } from "./extract.js";
import { mask } from "./masking.js";
import { extractSignals } from "./ai-client.js";
import { decide } from "./rule-engine.js";
import { summarize } from "./summarizer.js";
import { SIG_MALICIOUS_URL, SIG_SB_UNSAFE_URL, SIG_SHORT_URL, SIG_NEW_DOMAIN } from "./signals.js";

/** F4-1 입력 길이 상한 [임시] */
export const MAX_INPUT_CHARS = 2000;

/**
 * @param {{
 *   text: string,
 *   parentInputs?: { call_in_progress?: boolean, called_before?: boolean,
 *                    family_denied?: boolean, sender_last4?: string|null },
 *   registeredLast4?: string,
 *   familyNames?: string[],
 *   hmacKey?: string,
 *   cards?: { id: string, summary: string }[],
 *   ai?: null | { model: string, apiKey?: string, baseUrl?: string, timeoutMs?: number,
 *                 promptVersion?: string, fetchImpl?: typeof fetch },
 *   urlReputation?: null | ((domains: string[]) => Promise<{ ok: boolean, malicious: string[], shortened?: string[] }>),
 *   domainAge?: null | ((domains: string[]) => Promise<{ ok: boolean, young: string[], reason?: string }>),
 * }} input
 */
export async function analyze({
  text,
  parentInputs = {},
  registeredLast4,
  familyNames = [],
  hmacKey,
  cards = [],
  ai = null,
  urlReputation = null,
  domainAge = null,
}) {
  const raw = typeof text === "string" ? text : "";
  const truncated = [...raw].length > MAX_INPUT_CHARS;
  const input = truncated ? [...raw].slice(0, MAX_INPUT_CHARS).join("") : raw;

  // ① 코드 신호 (원문 기준)
  const code = extractCodeSignals(input, {
    senderLast4: parentInputs.sender_last4 ?? undefined,
    registeredLast4,
  });

  // ② 마스킹
  const { masked, phoneHmacs } = mask(input, { hmacKey, familyNames });

  // ③④ AI  +  ①' 링크 도메인 평판 조회(F4-11). 둘은 서로 기다리지 않고 함께 돈다.
  const reputationP = urlReputation && code.domains.length
    ? urlReputation(code.domains).catch(() => ({ ok: false, malicious: [], reason: "error" }))
    : Promise.resolve(null);
  // ①'' 도메인 생성일(D41). 역시 AI와 함께 돈다
  const ageP = domainAge && code.domains.length
    ? domainAge(code.domains).catch(() => ({ ok: false, young: [], reason: "error" }))
    : Promise.resolve(null);

  let aiResult = null;
  let fallbackReason = null;
  if (!ai || !ai.model) {
    fallbackReason = "AI 꺼짐";
  } else {
    aiResult = await extractSignals({
      message: masked,
      cards,
      allowedCardIds: new Set(cards.map((c) => c.id)),
      ...ai,
    });
    if (!aiResult.ok) fallbackReason = aiResult.reason;
  }
  const aiData = aiResult?.ok ? aiResult.data : null;
  const reputation = await reputationP;
  const age = await ageP;

  // ⑤ 합집합 (평판 조회 실패는 신호를 빼지 않을 뿐, 판정을 낮추지 않는다)
  const signalsAi = aiData?.signals ?? [];
  const signalsCode = [...code.signals];
  // 출처별로 신호를 나눈다: Google 경고에는 Google 출처 표시가 필요하고, 다른 출처에는 붙이면 안 된다
  const bySource = !reputation?.malicious?.length ? {}
    : reputation.sources ?? { [reputation.source ?? "unknown"]: reputation.malicious };
  if (bySource.safe_browsing?.length) signalsCode.push(SIG_SB_UNSAFE_URL);
  if (Object.entries(bySource).some(([k, v]) => k !== "safe_browsing" && v?.length)) signalsCode.push(SIG_MALICIOUS_URL);
  // 국내 목록에서 피싱에 많이 쓰인 단축 서비스(D40): 위험이 아니라 단축 URL 신호
  if (reputation?.shortened?.length && !signalsCode.includes(SIG_SHORT_URL)) signalsCode.push(SIG_SHORT_URL);
  if (age?.young?.length) signalsCode.push(SIG_NEW_DOMAIN);
  const signalsFinal = [...new Set([...signalsCode, ...signalsAi])];

  // ⑥ 규칙
  const { level, fired_rules } = decide({
    signals_final: signalsFinal,
    call_in_progress: Boolean(parentInputs.call_in_progress),
    called_before: Boolean(parentInputs.called_before),
    family_denied: Boolean(parentInputs.family_denied),
  });

  const relation = aiData?.impersonated_relation ?? null;

  return {
    level,
    fired_rules,
    signals_code: signalsCode,
    signals_ai: signalsAi,
    signals_final: signalsFinal,
    domains: code.domains,
    phone_hmacs: phoneHmacs,
    impersonation_type: aiData?.impersonation_type ?? null,
    impersonated_relation: relation,
    evidence_card_ids: aiData?.evidence_card_ids ?? [],
    explanation_for_parent: aiData?.explanation_for_parent ?? [],
    // ⑦ 자녀 알림용 요약(AI 문장 아님, 9-9)
    summary: summarize(signalsFinal, { impersonated_relation: relation }),
    fallback_used: !aiData,
    fallback_reason: fallbackReason,
    truncated,
    ai_meta: aiResult?.meta ?? null,
    // 평판 조회 결과(도메인 이름은 담지 않는다): null = 조회 안 함
    url_reputation: reputation
      ? { ok: reputation.ok, hits: reputation.malicious.length, shortened: reputation.shortened?.length ?? 0, reason: reputation.reason ?? null,
          ...(Object.keys(bySource).length ? { sources: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, v.length])) } : {}) }
      : null,
    // 도메인 생성일 결과(도메인 이름은 담지 않는다): null = 조회 안 함
    domain_age: age ? { ok: age.ok, young: age.young?.length ?? 0, reason: age.reason ?? null } : null,
  };
}
