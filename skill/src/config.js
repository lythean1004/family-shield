/**
 * 스킬 서버 설정 (PRD 13-3)
 *
 * 값은 모두 환경 변수에서 온다. 운영에서는 systemd EnvironmentFile
 * (`/etc/family-shield/skill.env`, 600)이 넣어 준다. 저장소에는 값이 없다.
 *
 * 필수: SKILL_HEADER_TOKEN, AI_API_KEY
 * 선택: AI_BASE_URL, AI_MODEL, AI_TIMEOUT_MS, AI_WEB_TIMEOUT_MS, SKILL_PORT, SKILL_HOST,
 *       WEB_BASE_URL, PHONE_HMAC_SECRET, PROMPT_VERSION, MAX_CONCURRENT,
 *       SAFE_BROWSING_API_KEY, URL_LOOKUP_TIMEOUT_MS,
 *       SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const DEFAULTS = {
  SKILL_PORT: "3000",
  SKILL_HOST: "127.0.0.1",
  AI_MODEL: "gemini-3.1-flash-lite",
  AI_TIMEOUT_MS: "3000",
  AI_WEB_TIMEOUT_MS: "8000",
  PROMPT_VERSION: "v1",
  MAX_CONCURRENT: "8",
  URL_LOOKUP_TIMEOUT_MS: "800",
};

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true, config: object } | { ok: false, missing: string[] }}
 */
export function loadConfig(env = process.env) {
  const get = (k) => (env[k] ?? DEFAULTS[k] ?? "").trim();
  const missing = ["SKILL_HEADER_TOKEN", "AI_API_KEY"].filter((k) => !get(k));
  if (missing.length) return { ok: false, missing };

  return {
    ok: true,
    config: {
      port: Number(get("SKILL_PORT")),
      host: get("SKILL_HOST"),
      // 짧은 쪽으로 비교한다. 빈 값이면 어떤 요청도 통과하지 않는다.
      headerToken: get("SKILL_HEADER_TOKEN"),
      ai: {
        model: get("AI_MODEL"),
        apiKey: get("AI_API_KEY"),
        baseUrl: get("AI_BASE_URL") || undefined, // 없으면 ai-client.js 기본값
        timeoutMs: Number(get("AI_TIMEOUT_MS")),
        // F4-6: 웹 /api/analyze 채널은 카카오 5초 제한이 없으므로 더 넉넉히(기본 8초).
        webTimeoutMs: Number(get("AI_WEB_TIMEOUT_MS")),
        promptVersion: get("PROMPT_VERSION"),
      },
      webBaseUrl: get("WEB_BASE_URL") || null,
      // URL 평판 조회(F4-11). 없으면 조회하지 않는다(링크 신호는 그대로).
      safeBrowsingKey: get("SAFE_BROWSING_API_KEY") || null,
      urlLookupTimeoutMs: Number(get("URL_LOOKUP_TIMEOUT_MS")),
      // 번호 HMAC 키. 없으면 HMAC을 만들지 않는다(마스킹 자체는 동작).
      hmacKey: get("PHONE_HMAC_SECRET") || null,
      maxConcurrent: Number(get("MAX_CONCURRENT")),
      // Supabase 클라우드 연결 (선택, 없으면 1회용 토큰·checks 저장 불가)
      supabase: {
        url: get("SUPABASE_URL") || null,
        serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY") || null,
      },
    },
  };
}

/** 토큰 비교: 길이가 달라도 같은 시간이 걸리도록 한다. */
export function tokenMatches(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") return false;
  if (!expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
