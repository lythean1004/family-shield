// KISA 피싱 사이트 목록(공공데이터포털 CSV) → 호스트 키 파일 (D40 ①)
// 사용: node content/phishing/build-kisa.mjs data/kisa/kisa-2023.csv data/kisa/kisa-2024.csv --allow data/tranco/top-1m.csv
// - --allow: Tranco 인기 사이트 목록(100만 개)의 등록 도메인은 목록에서 뺀다
//   (KISA 원본에 t.me, line.me, korea.kr, ilogen.com 같은 정상 사이트 위 피싱이 도메인째 들어 있음, 2026-11-11 오탐 시험).
// - 근거 카드(content/evidence/official-domains.json)의 공식 도메인도 항상 뺀다.
// - 원본 CSV는 data/(커밋 안 함)에만 둔다. 저장소에는 SHA-256 앞 16자리 키만 남긴다.
// - 서비스로 본 도메인(단축 URL 등)은 data/kisa/services.json 에 따로 쓴다(검토용, 커밋 안 함).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildKeys, hostKey, registrableDomain } from "../../packages/core/src/phishing-list.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const args = process.argv.slice(2);
const ai = args.indexOf("--allow");
const allowFile = ai >= 0 ? args[ai + 1] : null;
const files = args.filter((a, i) => a !== "--allow" && i !== ai + 1);
if (files.length === 0) { console.error("CSV 경로를 주세요"); process.exit(1); }

const ALLOW_TOP = 1000000;
const allow = new Set();
let allowNote = "허용 목록 없음";
if (allowFile) {
  for (const line of readFileSync(allowFile, "utf8").split(/\r?\n/)) {
    const i = line.indexOf(",");
    if (i < 0) continue;
    const rank = Number(line.slice(0, i));
    const domain = line.slice(i + 1).trim().toLowerCase();
    if (rank <= ALLOW_TOP) allow.add(registrableDomain(domain) || domain);
  }
  allowNote = `허용 목록: Tranco 상위 ${ALLOW_TOP}개의 등록 도메인 ${allow.size}개`;
}
const cards = JSON.parse(readFileSync(join(root, "content", "evidence", "official-domains.json"), "utf8")).cards;
for (const c of cards) for (const d of c.official_domains) allow.add(d.toLowerCase());
allowNote += ` + 근거 카드 공식 도메인`;

const urls = [];
let first = null, last = null;
for (const f of files) {
  const lines = readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/);
  if (!/^날짜,홈페이지주소/.test(lines[0])) { console.error(`${f}: 머리글이 다릅니다`); process.exit(1); }
  for (const line of lines.slice(1)) {
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const date = line.slice(0, comma).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      if (!first || date < first) first = date;
      if (!last || date > last) last = date;
    }
    urls.push(line.slice(comma + 1));
  }
}

const { keys, services, stats } = buildKeys(urls, { allow });
const header = [
  "# 가족방패 KISA 피싱 사이트 호스트 키 (D40)",
  "# 출처: 공공데이터포털 한국인터넷진흥원_피싱사이트(15143094), 한국인터넷진흥원_피싱사이트 URL(15109780)",
  "# 이용허락범위: 제한 없음. 원본 URL은 저장하지 않고 정규화한 호스트의 SHA-256 앞 16자리만 둔다.",
  `# 탐지 기간: ${first} ~ ${last}, 만든 날: ${new Date().toISOString().slice(0, 10)}`,
  `# ${allowNote}`,
  `# 입력 ${stats.input}행, 잘못된 값 ${stats.invalid}, 공용 도메인 ${stats.shared}, 허용 목록 ${stats.allowed}, 서비스로 본 행 ${stats.service}`,
  `# 키 ${stats.unique}개 (호스트 ${stats.hostKeys}, 상위 도메인 ${stats.registrableKeys})`,
];
writeFileSync(join(here, "kisa-hosts.txt"), [...header, ...[...keys].sort()].join("\n") + "\n");
writeFileSync(join(here, "kisa-shorteners.txt"), [
  "# 가족방패 KISA 목록에서 피싱에 많이 쓰인 단축 서비스 호스트 키 (D40). 위험이 아니라 단축 URL 신호용",
  `# 기준: 등록 도메인 자체이고 서로 다른 경로 20개 이상, ${services.length}개`,
  ...services.map((x) => hostKey(x.host)).sort(),
].join("\n") + "\n");
writeFileSync(join(root, "data", "kisa", "services.json"), JSON.stringify(services, null, 1));
console.log(header.join("\n"));
console.log(`서비스로 본 도메인 ${services.length}개 → data/kisa/services.json`);
