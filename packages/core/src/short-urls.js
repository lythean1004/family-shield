/**
 * 단축 주소 목록 대조 (멘토링 2026-11-26, D48 ①)
 *
 * - 단축 URL을 펼치지 않는다(D11). 링크에 접속하지 않고 글자만 정규화해 대조한다.
 * - KISA 피싱 목록에 있던 단축 주소(서비스 호스트 + 경로)의 SHA-256 앞 16자리만 저장소에 둔다.
 *   피싱 주소 원문은 커밋하지 않는다(content/phishing/build-kisa.mjs가 만든다).
 * - 그대로 같은 주소만 맞는다. 목록은 2024년 말까지라 새 단축 주소는 못 잡는다(맞지 않는다고 안전한 것은 아님).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeHost, parseKeyFile } from "./phishing-list.js";

const SHORT_URL_FILE = join(import.meta.dirname, "..", "..", "..", "content", "phishing", "kisa-short-urls.txt");

/**
 * 링크 원문 → 대조 키. 경로가 없거나(서비스 첫 화면) 주소 앞부분에 @가 있으면 null.
 * 호스트는 소문자·www 제거, 경로는 대소문자 유지(단축 코드는 대소문자를 구분), 끝의 / 와 문장부호는 뗀다.
 * 물음표·# 뒤는 보지 않는다.
 * @param {string} link
 * @returns {string|null}
 */
export function shortUrlKey(link) {
  if (typeof link !== "string" || !link.trim()) return null;
  const noScheme = link.trim().replace(/^(?:https?|ftp):\/\//i, "");
  const authority = noScheme.split(/[/?#]/)[0];
  if (authority.includes("@")) return null;
  const host = normalizeHost(authority.split(":")[0]);
  if (!host) return null;
  const path = noScheme.slice(authority.length).split(/[?#]/)[0].replace(/[.,!?。…]+$/u, "").replace(/\/+$/, "");
  if (!path || path === "/") return null;
  return createHash("sha256").update(`${host}${path}`).digest("hex").slice(0, 16);
}

/**
 * @param {Set<string>} keys
 * @returns {(links: string[]) => boolean} 링크 중 하나라도 목록에 있으면 true
 */
export function createShortUrlMatcher(keys) {
  const set = keys ?? new Set();
  return (links) => set.size > 0 && (links ?? []).some((l) => {
    const k = shortUrlKey(l);
    return k !== null && set.has(k);
  });
}

function loadKeys() {
  try { return parseKeyFile(readFileSync(SHORT_URL_FILE, "utf8")); } catch { return new Set(); }
}

/** 저장소 목록 파일(없으면 빈 목록) */
export const SHORT_URL_KEYS = loadKeys();
