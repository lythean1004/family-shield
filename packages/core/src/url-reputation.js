/**
 * URL 평판 조회 (F4-11, D11) — Google Safe Browsing v5 hashes.search
 *
 * - 링크에 접속하지 않는다. 단축 URL은 이 함수에 오지 않는다(extract.js가 빼고 SIG_SHORT_URL).
 * - 경로는 쓰지 않고 호스트만(경로에 개인 토큰이 있을 수 있음, PRD 12-3).
 *   그래서 경로 단위 위협은 놓칠 수 있다 → 보조 신호로만 쓴다(feasibility 13-1).
 * - 서버로는 "호스트/" 표현식의 SHA-256 앞 4바이트만 보낸다. 받은 전체 해시는 로컬에서 비교한다.
 * - 실패·시간 초과면 ok:false + malicious=[] → 판정을 낮추지 않는다(PRD 9-1).
 * - 응답의 cacheDuration 동안 같은 접두어는 다시 묻지 않는다(API 규칙).
 * - Safe Browsing은 비상업 용도만. 상업 전환 시 Web Risk API로 바꾼다(PRD 19 확인 항목).
 */
import { createHash } from "node:crypto";

export const SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v5/hashes:search";
const KNOWN_THREATS = new Set(["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"]);
const IGNORE_ATTRS = new Set(["CANARY", "THREAT_ATTRIBUTE_UNSPECIFIED"]);
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * 호스트 → 조회 표현식 목록 (경로는 "/"만).
 * 정확한 호스트 + 마지막 5개 구성요소에서 앞을 하나씩 뗀 것(최대 4개), 최상위 도메인 하나만은 제외.
 */
export function hostExpressions(host) {
  const h = String(host ?? "").trim().toLowerCase().replace(/\.+$/, "");
  if (IPV4_RE.test(h)) return [`${h}/`];
  if (!HOST_RE.test(h)) return [];
  const parts = h.split(".");
  const out = [h];
  const tail = parts.slice(-5);
  for (let i = 0; i < tail.length - 1; i++) {
    const s = tail.slice(i).join(".");
    if (!out.includes(s)) out.push(s);
  }
  return out.map((s) => `${s}/`);
}

export function expressionHashes(expressions) {
  return expressions.map((expression) => {
    const digest = createHash("sha256").update(expression).digest();
    return { expression, fullHash: digest.toString("base64"), prefix: digest.subarray(0, 4).toString("base64") };
  });
}

function parseDurationMs(s) {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(String(s ?? ""));
  return m ? Math.round(Number(m[1]) * 1000) : 300_000;
}

/** 유효한 위협이 하나라도 있는가(알 수 없는 종류·CANARY는 버림) */
function isThreat(details = []) {
  return details.some((d) =>
    KNOWN_THREATS.has(d?.threatType) && !(d.attributes ?? []).some((a) => IGNORE_ATTRS.has(a)));
}

/**
 * @param {{ apiKey: string, fetchImpl?: typeof fetch, timeoutMs?: number, clock?: () => number }} opts
 * @returns {null | ((domains: string[]) => Promise<{ ok: boolean, malicious: string[], reason?: string }>)}
 */
export function createSafeBrowsingChecker({ apiKey, fetchImpl = fetch, timeoutMs = 800, clock = Date.now } = {}) {
  if (!apiKey) return null;
  /** prefix → { expiresAt, threats: Set<fullHash> } */
  const cache = new Map();

  return async function check(domains) {
    const byDomain = [...new Set(domains ?? [])].map((d) => ({ domain: d, hashes: expressionHashes(hostExpressions(d)) }));
    const all = byDomain.flatMap((d) => d.hashes);
    if (all.length === 0) return { ok: true, malicious: [] };

    const now = clock();
    const need = [...new Set(all.map((h) => h.prefix))].filter((p) => !(cache.get(p)?.expiresAt > now));

    if (need.length) {
      const qs = need.map((p) => `hashPrefixes=${encodeURIComponent(p)}`).join("&");
      const url = `${SAFE_BROWSING_URL}?${qs}&alt=json&key=${encodeURIComponent(apiKey)}`;
      let res;
      try {
        res = await Promise.race([
          fetchImpl(url, { headers: { accept: "application/json" } }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
        ]);
      } catch (e) {
        return { ok: false, malicious: [], reason: e.message === "timeout" ? "timeout" : "network" };
      }
      if (!res.ok) return { ok: false, malicious: [], reason: `http ${res.status}` };
      let body;
      try { body = await res.json(); } catch { return { ok: false, malicious: [], reason: "bad json" }; }

      const threats = new Set((body.fullHashes ?? []).filter((f) => isThreat(f.fullHashDetails)).map((f) => f.fullHash));
      const expiresAt = clock() + parseDurationMs(body.cacheDuration);
      for (const p of need) cache.set(p, { expiresAt, threats });
    }

    const malicious = byDomain
      .filter(({ hashes }) => hashes.some((h) => cache.get(h.prefix)?.threats.has(h.fullHash)))
      .map((d) => d.domain);
    return { ok: true, malicious };
  };
}
