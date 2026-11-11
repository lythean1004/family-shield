/**
 * 도메인 생성일 확인 (D41, D40 ③)
 *
 * - 링크에 접속하지 않는다. 링크의 "등록 도메인 이름"만 그 도메인의 등록 기관 RDAP에 묻는다.
 * - 조회 주소는 저장소의 IANA 안내 파일(content/rdap/dns.json)만 쓴다. 실행 중에 내려받지 않는다.
 * - 문자 1건당 최대 2개. 단축 URL·공용·공공기관·근거 카드 공식·우리 도메인은 묻지 않는다.
 * - 등록일이 기준(30일) 이내면 young. 시간 초과·오류는 ok=false, 신호 없음(판정을 낮추지 않음).
 * - 결과는 서버 메모리에 24시간 캐시. 도메인 이름은 파일·DB·로그에 남기지 않는다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeHost, isSharedHost, registrableDomain } from "./phishing-list.js";
import { isShortener } from "./links.js";
import { OFFICIAL_DOMAIN_CARDS } from "./lookalike.js";

const DAY = 86400000;
export const DEFAULT_THRESHOLD_DAYS = 30;
export const DEFAULT_TIMEOUT_MS = 2500;
const CACHE_MS = DAY;
const MAX_TARGETS = 2;

/** 우리 서비스 도메인(2026-10-27 등록이라 30일 기준에 걸린다) */
const OWN_DOMAINS = ["familyshield.kr"];
const OFFICIAL = [...OWN_DOMAINS, ...OFFICIAL_DOMAIN_CARDS.flatMap((c) => c.official_domains)].map((d) => d.toLowerCase());
const isUnder = (h, d) => h === d || h.endsWith(`.${d}`);

const BOOTSTRAP_FILE = join(import.meta.dirname, "..", "..", "..", "content", "rdap", "dns.json");
let defaultBootstrap = null;
function loadDefaultBootstrap() {
  defaultBootstrap ??= JSON.parse(readFileSync(BOOTSTRAP_FILE, "utf8"));
  return defaultBootstrap;
}

/** 끝부분 → RDAP 기본 주소 */
function baseMap(bootstrap) {
  const m = new Map();
  for (const [tlds, urls] of bootstrap.services ?? []) {
    const base = urls.find((u) => u.startsWith("https://"));
    if (!base) continue;
    for (const t of tlds) m.set(t.toLowerCase(), base.replace(/\/?$/, "/"));
  }
  return m;
}

export function rdapUrlFor(domain, bootstrap = loadDefaultBootstrap()) {
  const base = baseMap(bootstrap).get(domain.split(".").pop());
  return base ? `${base}domain/${encodeURIComponent(domain)}` : null;
}

/** 링크 도메인 → 물어볼 등록 도메인(중복 없이, 최대 2개) */
export function lookupTargets(domains) {
  const out = [];
  for (const d of domains ?? []) {
    const host = normalizeHost(d);
    if (!host || isShortener(host) || isSharedHost(host)) continue;
    if (OFFICIAL.some((o) => isUnder(host, o))) continue;
    const reg = registrableDomain(host);
    if (!reg || isSharedHost(reg) || out.includes(reg)) continue;
    out.push(reg);
    if (out.length >= MAX_TARGETS) break;
  }
  return out;
}

/**
 * @param {{ bootstrap?: object, fetchImpl?: typeof fetch, timeoutMs?: number,
 *           thresholdDays?: number, clock?: () => number }} opts
 * @returns {(domains: string[]) => Promise<{ ok: boolean, young: string[], reason?: string }>}
 */
export function createDomainAgeChecker({
  bootstrap = loadDefaultBootstrap(),
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  thresholdDays = DEFAULT_THRESHOLD_DAYS,
  clock = Date.now,
} = {}) {
  const bases = baseMap(bootstrap);
  /** 등록 도메인 → { expiresAt, registeredAt: number|null } */
  const cache = new Map();

  async function registeredAt(reg) {
    const hit = cache.get(reg);
    if (hit && hit.expiresAt > clock()) return { ok: true, registeredAt: hit.registeredAt };
    const base = bases.get(reg.split(".").pop());
    if (!base) return { ok: true, registeredAt: null }; // 안내 파일에 없는 끝부분: 알 수 없음
    let timer;
    try {
      const res = await Promise.race([
        fetchImpl(`${base}domain/${encodeURIComponent(reg)}`, { headers: { accept: "application/rdap+json" } }),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), timeoutMs); }),
      ]);
      let value = null;
      if (res.ok) {
        const body = await res.json();
        const ev = (body.events ?? []).find((e) => /registration/i.test(e?.eventAction ?? ""));
        const t = ev?.eventDate ? Date.parse(ev.eventDate) : NaN;
        value = Number.isFinite(t) ? t : null;
      } else if (res.status !== 404) {
        return { ok: false, reason: `http ${res.status}` };
      }
      cache.set(reg, { expiresAt: clock() + CACHE_MS, registeredAt: value });
      return { ok: true, registeredAt: value };
    } catch (e) {
      return { ok: false, reason: e?.message === "timeout" ? "timeout" : "error" };
    } finally {
      clearTimeout(timer);
    }
  }

  return async function check(domains) {
    const list = [...new Set(domains ?? [])];
    const targets = lookupTargets(list);
    if (targets.length === 0) return { ok: true, young: [] };
    const results = await Promise.all(targets.map(async (reg) => ({ reg, ...(await registeredAt(reg)) })));
    const now = clock();
    const youngRegs = new Set(results
      .filter((r) => r.ok && r.registeredAt != null && now - r.registeredAt <= thresholdDays * DAY && now >= r.registeredAt)
      .map((r) => r.reg));
    const young = list.filter((d) => youngRegs.has(registrableDomain(normalizeHost(d))));
    const failed = results.filter((r) => !r.ok);
    return failed.length ? { ok: false, young, reason: failed.map((r) => r.reason).join(",") } : { ok: true, young };
  };
}
