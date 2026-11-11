// 도메인 생성일 측정 (D41 설계안 4장, 구현 전 측정용)
//
//   A: node eval/domain-age-measure.mjs kisa data/kisa/kisa-2024.csv [표본 200]
//   B: node eval/domain-age-measure.mjs tranco data/tranco/top-1m.csv [표본 1000]
//   C: 같은 명령을 서버에서 작은 표본으로 실행해 속도만 본다
//
// - 링크에 접속하지 않는다. 등록 기관 RDAP에 "등록 도메인 이름"만 묻는다.
// - 조회는 한 번에 하나씩, 사이에 쉬는 시간을 둔다(등록 기관 부담·차단 방지).
// - 결과 요약만 출력한다. 도메인별 결과는 data/(커밋 안 함)에만 쓴다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { toDomain } from "../packages/core/src/links.js";
import { normalizeHost, isSharedHost, registrableDomain } from "../packages/core/src/phishing-list.js";

const ROOT = join(import.meta.dirname, "..");
const [mode, file, nArg] = process.argv.slice(2);
const N = Number(nArg ?? (mode === "kisa" ? 200 : 1000));
const TIMEOUT_MS = Number(process.env.RDAP_TIMEOUT_MS ?? 3000);
const GAP_MS = Number(process.env.RDAP_GAP_MS ?? 400);
const DAY = 86400000;

const boot = JSON.parse(readFileSync(join(ROOT, "content", "rdap", "dns.json"), "utf8"));
const rdapBase = new Map();
for (const [tlds, urls] of boot.services) for (const t of tlds) rdapBase.set(t, urls.find((u) => u.startsWith("https://")) ?? urls[0]);

// 재현 가능한 무작위 표본(시드 고정)
let seed = 20261111;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const sample = (arr, n) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};

async function lookup(domain) {
  const tld = domain.split(".").pop();
  const base = rdapBase.get(tld);
  if (!base) return { status: "no_rdap" };
  const url = `${base.replace(/\/?$/, "/")}domain/${encodeURIComponent(domain)}`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: "application/rdap+json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const ms = Math.round(performance.now() - t0);
    if (res.status === 404) return { status: "not_found", ms };
    if (!res.ok) return { status: `http_${res.status}`, ms };
    const j = await res.json();
    const ev = (j.events ?? []).find((e) => /registration/i.test(e.eventAction ?? ""));
    return ev?.eventDate ? { status: "ok", ms, registered: ev.eventDate.slice(0, 10) } : { status: "no_date", ms };
  } catch (e) {
    return { status: e.name === "TimeoutError" ? "timeout" : "error", ms: Math.round(performance.now() - t0) };
  }
}

// 대상 만들기: { domain, refDate } (refDate = KISA 첫 탐지일 또는 오늘)
let targets = [];
if (mode === "kisa") {
  const first = new Map();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/).slice(1)) {
    const c = line.indexOf(",");
    if (c < 0) continue;
    const date = line.slice(0, c).trim();
    const host = normalizeHost(toDomain(line.slice(c + 1).trim()));
    if (!host || isSharedHost(host)) continue;
    const reg = registrableDomain(host);
    if (!first.has(reg) || date < first.get(reg)) first.set(reg, date);
  }
  // RDAP을 지원하는 끝부분만 표본으로(지원 안 하는 비율은 따로 센다)
  const all = [...first.keys()];
  const supported = all.filter((d) => rdapBase.has(d.split(".").pop()));
  console.log(`KISA 등록 도메인 ${all.length}개 중 RDAP 지원 끝부분 ${supported.length}개 (${(100 * supported.length / all.length).toFixed(1)}%)`);
  targets = sample(supported, N).map((d) => ({ domain: d, refDate: first.get(d) }));
} else if (mode === "tranco") {
  const regs = new Set();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const c = line.indexOf(",");
    if (c < 0) continue;
    const reg = registrableDomain(line.slice(c + 1).trim());
    if (reg) regs.add(reg);
  }
  const all = [...regs];
  const supported = all.filter((d) => rdapBase.has(d.split(".").pop()));
  console.log(`Tranco 등록 도메인 ${all.length}개 중 RDAP 지원 끝부분 ${supported.length}개 (${(100 * supported.length / all.length).toFixed(1)}%)`);
  const today = new Date().toISOString().slice(0, 10);
  targets = sample(supported, N).map((d) => ({ domain: d, refDate: today }));
} else {
  console.error("mode: kisa | tranco"); process.exit(1);
}

const rows = [];
for (const [i, t] of targets.entries()) {
  const r = await lookup(t.domain);
  const ageDays = r.registered ? Math.round((Date.parse(t.refDate) - Date.parse(r.registered)) / DAY) : null;
  rows.push({ ...t, ...r, ageDays });
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${targets.length}`);
  await new Promise((s) => setTimeout(s, GAP_MS));
}

mkdirSync(join(ROOT, "data", "rdap"), { recursive: true });
writeFileSync(join(ROOT, "data", "rdap", `${mode}-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(rows, null, 1));

const count = (f) => rows.filter(f).length;
const ok = rows.filter((r) => r.status === "ok");
const valid = ok.filter((r) => r.ageDays >= 0); // 기준일 뒤에 등록된 것은 재등록으로 보고 뺀다
const ms = rows.filter((r) => r.ms != null).map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : null;
console.log(`\n== ${mode}: 조회 ${rows.length}개`);
console.log("상태:", Object.fromEntries([...new Set(rows.map((r) => r.status))].map((s) => [s, count((r) => r.status === s)])));
console.log(`등록일 확인 ${ok.length}개, 그중 기준일 이후 등록(재등록으로 제외) ${ok.length - valid.length}개`);
for (const d of [7, 14, 30, 60, 90, 180, 365]) {
  const n = count((r) => valid.includes(r) && r.ageDays <= d);
  console.log(`  기준일에 ${String(d).padStart(3)}일 이내: ${n}/${valid.length} (${valid.length ? (100 * n / valid.length).toFixed(1) : "-"}%)`);
}
const ages = valid.map((r) => r.ageDays).sort((a, b) => a - b);
if (ages.length) console.log(`  나이 중앙값 ${ages[Math.floor(ages.length / 2)]}일`);
console.log(`응답 시간 p50 ${pct(0.5)}ms, p95 ${pct(0.95)}ms, 최대 ${ms.at(-1)}ms, ${TIMEOUT_MS}ms 초과 ${count((r) => r.status === "timeout")}개`);
