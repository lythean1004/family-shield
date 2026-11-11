/**
 * 국내 피싱 사이트 목록 대조 (D40 ①, KISA 공공데이터)
 *
 * - 링크에 접속하지 않는다. 문자 속 링크의 호스트만 서버 메모리에서 대조한다(외부 전송 없음).
 * - 저장소에는 호스트의 SHA-256 앞 16자리만 둔다. 피싱 주소 원문은 커밋하지 않는다.
 * - 목록 항목과 그 하위 주소를 잡는다. 목록 항목의 상위 도메인은 잡지 않는다.
 * - 단축 URL·공용 호스팅·대형 포털 자체는 목록에서 뺀다(정상 사이트 오탐 방지).
 * - 목록에 없다고 안전한 것은 아니다. 최신 자료가 2024년 말까지라 새 도메인은 없다.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toDomain, SHORTENER_DOMAINS } from "./links.js";

const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const KEY_RE = /^[0-9a-f]{16}$/;

/** 2단계 국가 도메인: 이것 자체는 대조 후보가 아니다 */
const SECOND_LEVEL = new Set([
  "co.kr", "or.kr", "go.kr", "ne.kr", "re.kr", "pe.kr", "ac.kr", "hs.kr", "ms.kr", "es.kr", "kg.kr", "sc.kr", "mil.kr",
  "co.jp", "ne.jp", "or.jp", "com.cn", "net.cn", "com.hk", "co.uk", "com.au",
]);

/**
 * 여러 사람이 함께 쓰는 도메인. 이것 자체가 목록에 있으면 정상 사용자까지 잡히므로 뺀다.
 * 하위 주소(예: 누군가.github.io)는 그 사람만 쓰므로 목록에 남긴다.
 */
const SHARED_HOSTS = new Set([
  ...SHORTENER_DOMAINS,
  "naver.com", "daum.net", "kakao.com", "google.com", "youtube.com", "facebook.com", "instagram.com",
  "github.io", "github.com", "blogspot.com", "tistory.com", "wordpress.com", "wixsite.com", "weebly.com",
  "notion.site", "web.app", "firebaseapp.com", "pages.dev", "workers.dev", "netlify.app", "vercel.app",
  "herokuapp.com", "glitch.me", "000webhostapp.com", "sites.google.com", "docs.google.com", "forms.gle",
  "linktr.ee", "appspot.com", "azurewebsites.net", "cloudfront.net", "amazonaws.com", "ngrok.io", "ngrok-free.app",
  "duckdns.org", "ddns.net", "kr.ly", "modoo.at",
  // 무료 하위 도메인 서비스(누구나 하위 주소를 만들 수 있음)
  "kro.kr", "o-r.kr", "p-e.kr", "r-e.kr", "n-e.kr", "e-r.kr",
]);

export function normalizeHost(host) {
  const h = String(host ?? "").trim().toLowerCase().replace(/\.+$/, "").replace(/^www\./, "");
  return HOST_RE.test(h) || IPV4_RE.test(h) ? h : "";
}

export function hostKey(host) {
  return createHash("sha256").update(normalizeHost(host)).digest("hex").slice(0, 16);
}

/** 호스트 자신 + 상위 도메인(라벨 2개 이상, 2단계 국가 도메인 자체는 제외) */
export function candidateHosts(host) {
  const h = normalizeHost(host);
  if (!h) return [];
  if (IPV4_RE.test(h)) return [h];
  const parts = h.split(".");
  const out = [];
  for (let i = 0; i <= parts.length - 2; i++) {
    const s = parts.slice(i).join(".");
    if (!SECOND_LEVEL.has(s)) out.push(s);
  }
  return out;
}

/** 하위 주소까지 모두 공용으로 보는 대형 서비스(채널·블로그·카페 등은 누구나 만든다) */
const SHARED_PARENTS = [
  "naver.com", "kakao.com", "daum.net", "google.com", "youtube.com", "facebook.com", "instagram.com",
  "apple.com", "microsoft.com", "live.com", "coupang.com",
];

/** 일반인이 등록할 수 없는 공공·교육기관 도메인: 목록에 넣지 않는다(원본에 기관 주소가 섞여 있음) */
const PROTECTED_SUFFIXES = ["go.kr", "or.kr", "ac.kr", "mil.kr", "re.kr", "hs.kr", "ms.kr", "es.kr", "kg.kr", "sc.kr", "gov"];

const underAny = (h, list) => list.some((p) => h === p || h.endsWith(`.${p}`));

export function isSharedHost(host) {
  const h = normalizeHost(host);
  return SHARED_HOSTS.has(h) || underAny(h, SHARED_PARENTS) || underAny(h, PROTECTED_SUFFIXES);
}

/** 등록 도메인: 마지막 2단계, 2단계 국가 도메인(co.kr 등)이면 3단계 */
export function registrableDomain(host) {
  const h = normalizeHost(host);
  if (!h || IPV4_RE.test(h)) return h;
  const parts = h.split(".");
  return parts.slice(SECOND_LEVEL.has(parts.slice(-2).join(".")) ? -3 : -2).join(".");
}

/**
 * URL 문자열 목록 → 키 집합 (목록 만들기 스크립트용)
 *
 * - 호스트마다 키 하나. 공용 도메인 자체는 뺀다.
 * - 경로가 minServicePaths 개 이상 다른 호스트는 단축 URL 같은 서비스로 보고 빼며, services 로 따로 돌려준다
 *   (그 서비스를 쓰는 정상 링크까지 위험으로 보지 않기 위해).
 * - 같은 등록 도메인에 서로 다른 하위 주소가 2개 이상이면 사기범이 무작위 하위 주소를 붙인 것으로 보고
 *   등록 도메인도 키로 넣는다(공용·서비스 도메인은 제외).
 * @returns {{ keys: Set<string>, services: {host:string, rows:number, paths:number}[],
 *             stats: { input:number, invalid:number, shared:number, service:number,
 *                      hostKeys:number, registrableKeys:number, unique:number } }}
 */
export function buildKeys(urls, { minServicePaths = 20 } = {}) {
  const stats = { input: 0, invalid: 0, shared: 0, service: 0, hostKeys: 0, registrableKeys: 0, unique: 0 };
  /** host → { rows, paths:Set } */
  const hosts = new Map();
  for (const raw of urls) {
    stats.input++;
    const link = String(raw ?? "").trim();
    const host = normalizeHost(toDomain(link));
    if (!host) { stats.invalid++; continue; }
    if (isSharedHost(host)) { stats.shared++; continue; }
    const e = hosts.get(host) ?? { rows: 0, paths: new Set() };
    e.rows++;
    e.paths.add(link.replace(/^(?:https?|ftp):\/\//i, "").replace(/^[^/?#]*/, ""));
    hosts.set(host, e);
  }

  const services = [];
  const keys = new Set();
  /** registrable → Set<host> */
  const byReg = new Map();
  for (const [host, e] of hosts) {
    if (e.paths.size >= minServicePaths && host === registrableDomain(host)) {
      services.push({ host, rows: e.rows, paths: e.paths.size });
      stats.service += e.rows;
      continue;
    }
    keys.add(hostKey(host));
    stats.hostKeys++;
    const reg = registrableDomain(host);
    if (!byReg.has(reg)) byReg.set(reg, new Set());
    byReg.get(reg).add(host);
  }
  const serviceHosts = new Set(services.map((x) => x.host));
  for (const [reg, set] of byReg) {
    if (set.size < 2 || isSharedHost(reg) || serviceHosts.has(reg) || SECOND_LEVEL.has(reg)) continue;
    const k = hostKey(reg);
    if (!keys.has(k)) { keys.add(k); stats.registrableKeys++; }
  }
  services.sort((a, b) => b.rows - a.rows);
  stats.unique = keys.size;
  return { keys, services, stats };
}

/** 키 파일: 한 줄에 키 하나, # 로 시작하는 줄과 형식이 다른 줄은 무시 */
export function parseKeyFile(text) {
  const keys = new Set();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const k = line.trim();
    if (KEY_RE.test(k)) keys.add(k);
  }
  return keys;
}

/**
 * @param {{ keys?: Set<string>, shortenerKeys?: Set<string> }} opts
 *   keys: 피싱 호스트 키, shortenerKeys: 피싱에 많이 쓰인 단축 서비스 키(위험이 아니라 단축 URL 신호용)
 * @returns {null | ((domains: string[]) => Promise<{ ok: true, malicious: string[], shortened?: string[] }>)}
 */
export function createPhishingListChecker({ keys, shortenerKeys } = {}) {
  if (!keys || keys.size === 0) return null;
  const short = shortenerKeys ?? new Set();
  return async function check(domains) {
    const list = [...new Set(domains ?? [])];
    const malicious = list.filter((d) => candidateHosts(d).some((h) => keys.has(hostKey(h))));
    const shortened = list.filter((d) => !malicious.includes(d) && short.has(hostKey(d)));
    return shortened.length ? { ok: true, malicious, shortened } : { ok: true, malicious };
  };
}

/**
 * 여러 대조기를 하나로. 위험 도메인은 합집합(먼저 나온 순서), 하나라도 실패하면 ok=false.
 * 실패한 쪽이 있어도 다른 쪽에서 찾은 위험 도메인은 남긴다(판정을 낮추지 않음).
 */
export function combineCheckers(checkers) {
  const list = (checkers ?? []).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return async function check(domains) {
    const results = await Promise.all(list.map((c) =>
      Promise.resolve().then(() => c(domains)).catch(() => ({ ok: false, malicious: [], reason: "error" }))));
    const malicious = [...new Set(results.flatMap((r) => r?.malicious ?? []))];
    const shortened = [...new Set(results.flatMap((r) => r?.shortened ?? []))];
    const failed = results.filter((r) => !r?.ok);
    const out = failed.length === 0
      ? { ok: true, malicious }
      : { ok: false, malicious, reason: failed.map((r) => r?.reason ?? "error").join(",") };
    if (shortened.length) out.shortened = shortened;
    return out;
  };
}

/** 저장소의 목록 파일 위치(content/phishing) */
export const PHISHING_LIST_DIR = join(import.meta.dirname, "..", "..", "..", "content", "phishing");

/**
 * 목록 파일(kisa-hosts.txt, kisa-shorteners.txt)을 읽어 대조기를 만든다. 파일이 없으면 null.
 * @returns {{ check: null | Function, hostKeys: number, shortenerKeys: number }}
 */
export function loadPhishingListChecker(dir = PHISHING_LIST_DIR) {
  const read = (name) => { try { return parseKeyFile(readFileSync(join(dir, name), "utf8")); } catch { return new Set(); } };
  const keys = read("kisa-hosts.txt");
  const shortenerKeys = read("kisa-shorteners.txt");
  return { check: createPhishingListChecker({ keys, shortenerKeys }), hostKeys: keys.size, shortenerKeys: shortenerKeys.size };
}
