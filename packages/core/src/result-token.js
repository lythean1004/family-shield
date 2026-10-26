/**
 * 1회용 결과 토큰 (PRD 13-4, D34)
 *
 * 챗봇 [자세히 보기] → 웹 P4. 주소에 판별 ID 대신 짧게 사는 무작위 토큰을 넣는다.
 *   - 16바이트(128비트) 무작위, URL 안전 base64 (22자)
 *   - 서버에는 SHA-256 해시만 (원문 토큰은 버튼 주소에만 있다)
 *   - 수명 10분, 한 번 조회하면 무효
 *   - 로그에 남길 때는 t= 값을 가린다
 *
 * createMemoryResultStore: Supabase(result_tokens + redeem_result_token RPC) 연결 전에
 * 스킬 서버가 결과를 잠깐 들고 있는 저장소. 같은 규칙(해시 키, 10분, 1회)을 따른다.
 * 프로세스가 재시작되면 사라지고, 그때 사용자는 "다시 볼 수 없어요" 화면을 본다.
 */
import { randomBytes, createHash } from "node:crypto";

export const RESULT_TOKEN_TTL_MS = 10 * 60 * 1000;
const TOKEN_BYTES = 16;
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;
/** 사용·만료 뒤 이 시간이 지나면 메모리에서 지운다(DB purge와 같은 1시간) */
const KEEP_AFTER_MS = 60 * 60 * 1000;

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/** @returns {{ token: string, tokenHash: string, expiresAt: number }} */
export function createResultToken({ now = Date.now() } = {}) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashToken(token), expiresAt: now + RESULT_TOKEN_TTL_MS };
}

export function isTokenFormat(token) {
  return typeof token === "string" && TOKEN_RE.test(token);
}

/** @returns {"valid"|"expired"|"used"|"missing"} */
export function tokenState(row, now = Date.now()) {
  if (!row) return "missing";
  if (row.usedAt != null) return "used";
  if (now >= row.expiresAt) return "expired";
  return "valid";
}

/** 로그용: 주소의 t= 값을 *** 로 가린다 */
export function redactToken(url) {
  return String(url ?? "").replace(/([?&]t=)[^&#]*/g, "$1***");
}

/** 웹 P4가 쓰는 필드만 남긴다. 원문·번호 HMAC·도메인·AI 메타는 담지 않는다. */
const VIEW_FIELDS = [
  "level", "fired_rules", "signals_final", "impersonation_type", "impersonated_relation",
  "explanation_for_parent", "fallback_used", "summary",
];
export function toResultView(result) {
  const out = {};
  for (const k of VIEW_FIELDS) if (result?.[k] !== undefined) out[k] = result[k];
  return out;
}

export function createMemoryResultStore({ clock = Date.now, maxEntries = 1000 } = {}) {
  /** @type {Map<string, { result: object, expiresAt: number, usedAt: number|null }>} */
  const rows = new Map();

  function sweep() {
    const now = clock();
    for (const [h, r] of rows) {
      const doneAt = r.usedAt ?? r.expiresAt;
      if (now - doneAt > KEEP_AFTER_MS) rows.delete(h);
    }
  }

  return {
    put(result) {
      sweep();
      while (rows.size >= maxEntries) rows.delete(rows.keys().next().value); // Map은 넣은 순서
      const { token, tokenHash, expiresAt } = createResultToken({ now: clock() });
      rows.set(tokenHash, { result: toResultView(result), expiresAt, usedAt: null });
      return token;
    },
    redeem(token) {
      if (!isTokenFormat(token)) return { ok: false, reason: "missing" };
      const row = rows.get(hashToken(token));
      const state = tokenState(row, clock());
      if (state !== "valid") return { ok: false, reason: state };
      row.usedAt = clock();
      const { result } = row;
      row.result = null; // 한 번 보여 준 결과는 메모리에서도 버린다
      return { ok: true, result };
    },
    sweep,
    size: () => rows.size,
    _keys: () => [...rows.keys()],
  };
}
