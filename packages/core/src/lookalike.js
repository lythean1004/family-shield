/**
 * 공식 도메인 사칭 감지 (D40 ②)
 *
 * - 링크에 접속하지 않는다. 문자 속 링크의 도메인 이름만 본다.
 * - 도메인을 점·하이픈으로 나눈 조각(최상위 도메인 제외)의 앞부분에 기관 이름이 있으면 사칭 후보.
 *   정부(gov)는 "gov.무작위.일반도메인" 모양만 본다(2026-11-11 Tranco 오탐 시험 결과).
 * - go.kr·or.kr 등 공공기관 도메인은 일반인이 등록할 수 없으므로 항상 뺀다.
 *   단어 중간은 보지 않는다(redefine.com의 efine 같은 오탐 방지).
 * - 그 기관의 공식 도메인과 그 하위 주소는 빼고 SIG_LOOKALIKE_DOMAIN 을 켠다.
 * - 기관 이름·공식 도메인은 근거 카드(content/evidence/official-domains.json)에서만 가져온다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeHost, isProtectedHost, SECOND_LEVEL } from "./phishing-list.js";

const CARD_FILE = join(import.meta.dirname, "..", "..", "..", "content", "evidence", "official-domains.json");

/** @type {{ id:string, name:string, official_domains:string[], prefixes?:string[], regex?:string[], first_label_on_generic?:string[] }[]} */
export const OFFICIAL_DOMAIN_CARDS = JSON.parse(readFileSync(CARD_FILE, "utf8")).cards;

const COMPILED = OFFICIAL_DOMAIN_CARDS.map((c) => ({
  id: c.id,
  official: c.official_domains.map((d) => d.toLowerCase()),
  prefixes: c.prefixes ?? [],
  regex: (c.regex ?? []).map((r) => new RegExp(r)),
  firstLabel: new Set(c.first_label_on_generic ?? []),
}));

/** 최상위 도메인(2단계 국가 도메인 포함)을 뺀 나머지를 점·하이픈으로 나눈 조각 */
export function domainSegments(host) {
  const h = normalizeHost(host);
  if (!h) return [];
  const labels = h.split(".");
  const drop = SECOND_LEVEL.has(labels.slice(-2).join(".")) ? 2 : 1;
  return labels.slice(0, -drop).join(".").split(/[.-]+/).filter(Boolean);
}

const isUnder = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/**
 * @param {string[]} domains
 * @returns {{ domain: string, card_id: string }[]}
 */
export function findLookalikes(domains) {
  const out = [];
  for (const d of new Set(domains ?? [])) {
    const host = normalizeHost(d);
    if (!host || isProtectedHost(host)) continue; // go.kr·or.kr 등은 일반인이 등록할 수 없다
    const segs = domainSegments(host);
    const labels = host.split(".");
    // "이름.무작위.일반도메인" 모양(KISA에서 본 gov.aw1y.bar). 국가 도메인(gov.uk 등)은 아님
    const firstOnGeneric = labels.length === 3 && labels[2].length >= 3 ? labels[0] : null;
    for (const c of COMPILED) {
      if (c.official.some((o) => isUnder(host, o))) continue;
      const matched = (firstOnGeneric !== null && c.firstLabel.has(firstOnGeneric)) ||
        segs.some((s) => c.prefixes.some((p) => s.startsWith(p)) || c.regex.some((re) => re.test(s)));
      if (matched) { out.push({ domain: d, card_id: c.id }); break; }
    }
  }
  return out;
}
