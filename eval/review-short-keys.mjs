// 로컬 KISA CSV를 저장소 키와 대조한다. 출력은 집계·익명 표본이며 주소와 키는 출력하지 않는다.
import { readFileSync } from "node:fs";
import { toDomain, isShortener } from "../packages/core/src/links.js";
import { normalizeHost, hostKey, parseKeyFile } from "../packages/core/src/phishing-list.js";
import { shortUrlKey, SHORT_URL_KEYS } from "../packages/core/src/short-urls.js";

const automatic = parseKeyFile(readFileSync(new URL("../content/phishing/kisa-shorteners.txt", import.meta.url), "utf8"));
const files = process.argv.slice(2);
if (!files.length) throw new Error("로컬 KISA CSV 경로가 필요합니다.");
const hosts = new Map(), rebuilt = new Set(), excluded = new Set();
let input = 0, eligible = 0, shortInList = 0;
for (const file of files) {
  const [header, ...lines] = readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  if (!header.startsWith("날짜,홈페이지주소")) throw new Error("KISA CSV 헤더 확인 필요");
  for (const line of lines) {
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    input++;
    // 공식 빌더와 같은 입력 경계. 원문은 메모리에서만 사용한다.
    const raw = line.slice(comma + 1).trim();
    const host = normalizeHost(toDomain(raw));
    if (!host) continue;
    const auto = automatic.has(hostKey(host));
    if (!auto && !isShortener(host)) continue;
    eligible++;
    if (auto && !hosts.has(host)) hosts.set(host, new Map());
    const path = raw.replace(/^(?:https?|ftp):\/\//i, "").replace(/^[^/?#]*/, "").split(/[?#]/)[0].replace(/\/+$/, "");
    const key = shortUrlKey(raw);
    if (!key) continue;
    if (path.length < 4) { excluded.add(key); continue; }
    rebuilt.add(key);
    const canonical = path.replace(/[.,!?。…]+$/u, "").replace(/\/+$/, "").slice(1);
    if (canonical.length <= 2) shortInList++;
    if (!auto) continue;
    // 흔한 경로·문서/다단계는 일반 서비스일 가능성의 단서일 뿐이다.
    const kind = /^(?:login|index|main|home|about|help|account|notice|guide)(?:\.[a-z0-9]+)?$/i.test(canonical) ? "공통"
      : canonical.includes("/") ? "다단계" : /\.[a-z0-9]{2,5}$/i.test(canonical) ? "파일형"
      : /^[a-z0-9_-]+$/i.test(canonical) ? "한구간" : "기타";
    hosts.get(host).set(key, { length: canonical.length, kind });
  }
}
const missing = [...SHORT_URL_KEYS].filter(k => !rebuilt.has(k)).length;
const extra = [...rebuilt].filter(k => !SHORT_URL_KEYS.has(k)).length;
const labels = [...hosts.keys()].sort((a,b) => hostKey(a).localeCompare(hostKey(b)));
const priority = ["공통","다단계","파일형","기타","한구간"];
const counts = {}, serviceCounts = {}, pool = [];
for (const [i, host] of labels.entries()) {
  const records = [...hosts.get(host)].sort(([a], [b]) => a.localeCompare(b));
  for (const kind of priority) {
    const ofKind = records.filter(([,r]) => r.kind === kind);
    counts[kind] = (counts[kind] || 0) + ofKind.length;
    serviceCounts[kind] = (serviceCounts[kind] || 0) + Number(ofKind.length > 0);
    if (ofKind.length) pool.push({ service: "H" + String(i+1).padStart(2,"0"), ...ofKind[0][1] });
  }
}
const sample = [], used = new Set();
for (const kind of priority) {
  for (const r of pool.filter(x => x.kind === kind)) {
    if (sample.length === 20 || used.has(r.service)) continue;
    sample.push(r);
    used.add(r.service);
  }
}
console.log(JSON.stringify({ input, eligible, services: hosts.size, rebuilt: rebuilt.size, missing, extra,
  excludedShortKeys: excluded.size, excludedStillPresent: [...excluded].filter(k => rebuilt.has(k)).length,
  shortCanonicalRowsKept: shortInList, counts, serviceCounts, sample }, null, 1));
if (missing || extra || hosts.size !== automatic.size) process.exitCode = 1;
