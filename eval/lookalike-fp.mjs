// 정상 도메인 오탐 시험 (D40 ①②, R10·R11 수준 확정용)
// 사용: node eval/lookalike-fp.mjs data/tranco/top-1m.csv [상위 N=100000]
// - Tranco 인기 사이트 목록을 "정상 도메인"으로 보고, 사칭 감지·KISA 목록 대조에 걸리는 수를 센다.
// - 상위 N개와, 100만 개 중 .kr 도메인 전체를 따로 센다.
// - 인기 목록에도 악성 도메인이 섞일 수 있으므로, 걸린 도메인은 사람이 하나씩 분류한다.
import { readFileSync } from "node:fs";
import { findLookalikes } from "../packages/core/src/lookalike.js";
import { loadPhishingListChecker } from "../packages/core/src/phishing-list.js";

const [file, nArg] = process.argv.slice(2);
if (!file) { console.error("Tranco CSV 경로를 주세요"); process.exit(1); }
const topN = Number(nArg ?? 100000);

const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => {
  const i = l.indexOf(",");
  return { rank: Number(l.slice(0, i)), domain: l.slice(i + 1).trim().toLowerCase() };
});
const sets = {
  [`top${topN}`]: rows.filter((r) => r.rank <= topN),
  kr_all: rows.filter((r) => r.domain.endsWith(".kr")),
};

const { check } = loadPhishingListChecker();
for (const [name, list] of Object.entries(sets)) {
  const domains = list.map((r) => r.domain);
  const rankOf = new Map(list.map((r) => [r.domain, r.rank]));
  const look = findLookalikes(domains);
  const rep = check ? await check(domains) : { malicious: [], shortened: [] };
  console.log(`\n== ${name}: ${domains.length}개`);
  console.log(`사칭 감지(R11) ${look.length}개 (${(100 * look.length / domains.length).toFixed(4)}%)`);
  for (const x of look) console.log(`  #${rankOf.get(x.domain)} ${x.domain} ← ${x.card_id}`);
  console.log(`KISA 목록(R10) ${rep.malicious.length}개`);
  for (const d of rep.malicious) console.log(`  #${rankOf.get(d)} ${d}`);
  console.log(`KISA 단축 서비스 ${rep.shortened?.length ?? 0}개: ${(rep.shortened ?? []).join(", ")}`);
}
