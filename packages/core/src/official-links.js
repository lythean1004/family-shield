/**
 * 공식 주소 링크 판단 (멘토링 2026-11-26: 정상 링크 오경보)
 *
 * - 링크에 접속하지 않는다. 링크 글자만 본다.
 * - 공식으로 보는 경우(근거 카드에서만 가져온다):
 *   ① official-link-hosts.json의 정확한 호스트(포털 첫 화면 등)
 *   ② official-domains.json 카드의 공식 도메인과 그 하위 주소.
 *      단, 누구나 글·채널·판매 페이지를 만드는 서비스(대형 포털 하위, 텔레그램, 중고거래)는 뺀다.
 * - 주소 안에 다른 주소가 들어 있으면(넘겨주기) 공식으로 보지 않는다.
 * - status가 source_checked인 카드만 쓴다.
 * 공식 주소라고 ‘안전’하다는 뜻은 아니다. 링크만으로 ‘주의’를 내지 않을 뿐, 판정은 ‘확인 필요’에 머문다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFFICIAL_DOMAIN_CARDS } from "./lookalike.js";
import { SHARED_PARENTS, normalizeHost } from "./phishing-list.js";
import { toDomain, isShortener } from "./links.js";

const HOST_FILE = join(import.meta.dirname, "..", "..", "..", "content", "evidence", "official-link-hosts.json");

/** @type {{ id:string, hosts:string[], status:string }[]} */
export const OFFICIAL_LINK_HOST_CARDS = JSON.parse(readFileSync(HOST_FILE, "utf8")).cards;

const EXACT_HOSTS = new Set(
  OFFICIAL_LINK_HOST_CARDS.filter((c) => c.status === "source_checked").flatMap((c) => c.hosts.map((h) => normalizeHost(h))),
);

// 공식 도메인이어도 하위 주소를 누구나 만들 수 있는 서비스
const USER_CONTENT_CARD_IDS = new Set(["EV-DOM-TELEGRAM", "EV-DOM-DAANGN"]);

const SUBTREE_DOMAINS = OFFICIAL_DOMAIN_CARDS
  .filter((c) => c.status === "source_checked" && !USER_CONTENT_CARD_IDS.has(c.id))
  .flatMap((c) => c.official_domains.map((d) => d.toLowerCase()));

const isUnder = (host, domain) => host === domain || host.endsWith(`.${domain}`);

// 주소 안에 또 다른 주소가 있으면 넘겨주기(오픈 리다이렉트)로 본다
const EMBEDDED_URL_RE = /(?:https?:|%3a%2f%2f|\/\/|www\.|%2f%2f|[?&](?:url|u|q|to|go|goto|link|target|redirect\w*|return\w*|next|dest\w*)=)/i;

/**
 * @param {string} link 문자 속 링크 원문
 * @returns {boolean}
 */
export function isOfficialLink(link) {
  if (typeof link !== "string" || !link) return false;
  const noScheme = link.replace(/^(?:https?|ftp):\/\//i, "");
  const authority = noScheme.split(/[/?#]/)[0];
  if (authority.includes("@")) return false; // https://공식@가짜 속임수
  const host = normalizeHost(toDomain(link));
  if (!host || isShortener(host)) return false;
  const rest = noScheme.slice(authority.length);
  if (EMBEDDED_URL_RE.test(rest)) return false;

  if (EXACT_HOSTS.has(host)) return true;
  if (SHARED_PARENTS.some((p) => isUnder(host, p))) return false; // 포털 하위 주소는 정확한 호스트만
  return SUBTREE_DOMAINS.some((d) => isUnder(host, d));
}

/** 링크가 하나 이상 있고 모두 공식 주소인지 */
export function allLinksOfficial(links) {
  return Array.isArray(links) && links.length > 0 && links.every(isOfficialLink);
}
