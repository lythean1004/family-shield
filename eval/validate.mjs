#!/usr/bin/env node
/**
 * 평가 데이터 검사기 (PRD 15-1)
 *
 *   node eval/validate.mjs [eval/dev.jsonl] [eval/test.jsonl ...]
 *
 * 확인하는 것:
 *   - 필수 필드와 값 범위(group, split, level, 신호 ID, 사칭 유형)
 *   - case_id 중복(파일끼리도)
 *   - 합성 연락처·주소 검사. 문자형 세트의 정상·경계 문장에는 근거 카드의 대표 홈페이지를 허용한다.
 *   - level_rule이 규칙 엔진 결과와 같은지(정답을 규칙에 맞춰 바꾸지 말 것 — 다르면 알려만 준다)
 *   - 묶음별 건수(기존 평가 200건, 문자형 평가 120건)
 *   - 평가용(test)과 개발용(dev) 문장이 너무 비슷하지 않은지(말만 바꿔 쓰기 방지, 15-1)
 * 출력에 원문을 찍지 않는다(case_id로만).
 */
import { readFileSync } from "node:fs";
import { decide } from "../packages/core/src/rule-engine.js";
import { AI_ALLOWED_SIGNALS, IMPERSONATION_TYPES } from "../packages/core/src/signals.js";
import * as SIG from "../packages/core/src/signals.js";
import { findLinks, toDomain, isShortener } from "../packages/core/src/links.js";
import { inspectLinkCandidates } from "../packages/core/src/link-candidates.js";
import { isOfficialLink, OFFICIAL_LINK_HOST_CARDS } from "../packages/core/src/official-links.js";
import { shortUrlKey, SHORT_URL_KEYS } from "../packages/core/src/short-urls.js";
import { OFFICIAL_DOMAIN_CARDS } from "../packages/core/src/lookalike.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ALL_SIGNALS = new Set(Object.entries(SIG).filter(([k]) => k.startsWith("SIG_")).map(([, v]) => v));
const LEVELS = new Set(["위험", "주의", "확인필요"]);
const GROUPS = new Set(["A", "B", "C", "D1", "D2", "E"]);
const TARGET = { A: 35, B: 45, C: 25, D1: 50, D2: 35, E: 10 };
const MESSAGE_TARGET = { A: 16, B: 18, C: 16, D1: 50, E: 20 };
// 문자형 세트: 1판(Codex, 가림 표시라 측정에 쓰지 않음·보관)과 2판(2026-11-27 Claude 독립 에이전트)
const MESSAGE_DATASETS = new Set(["./messages-2026-11.jsonl", "./messages-2026-11-v2.jsonl"].map((p) => fileURLToPath(new URL(p, import.meta.url))));
const isMessageDataset = (file) => MESSAGE_DATASETS.has(resolve(file));
const homeHosts = new Set(OFFICIAL_LINK_HOST_CARDS.filter(c => c.status === "source_checked").flatMap(c => c.hosts));
for (const card of OFFICIAL_DOMAIN_CARDS.filter(c => c.status === "source_checked")) {
  for (const domain of card.official_domains) {
    homeHosts.add(domain);
    homeHosts.add(`www.${domain}`);
  }
}

function fixtureHomepage(candidate, group) {
  return (group === "D1" || group === "E") && candidate.complete && homeHosts.has(candidate.host)
    && candidate.rest === "/" && isOfficialLink(candidate.raw);
}

export function loadJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`${path}:${i + 1} JSON 오류`); }
  });
}

/** @returns {string[]} 이 케이스의 문제 목록 */
export function checkCase(c, { messageDataset = false } = {}) {
  const errs = [];
  const need = ["case_id", "split", "group", "message_text", "gold"];
  for (const k of need) if (c[k] == null) errs.push(`필드 없음: ${k}`);
  if (errs.length) return errs;
  // supplement: 평가용 200건과 따로 두는 보충 세트(2026-11-12, D45 측정용). 묶음별 목표 건수에 넣지 않는다
  if (!["dev", "test", "supplement"].includes(c.split)) errs.push(`split 값: ${c.split}`);
  // 개발용 20건은 D1/D2 구분 전에 만들어 group "D"를 쓴다. 평가용은 D1/D2로 나눠야 한다.
  const groupOk = GROUPS.has(c.group) || (c.split === "dev" && c.group === "D");
  if (!groupOk) errs.push(`group 값: ${c.group}`);

  const g = c.gold;
  for (const k of ["signals_code", "signals_ai"]) {
    if (!Array.isArray(g[k])) { errs.push(`gold.${k} 배열 아님`); continue; }
    for (const s of g[k]) if (!ALL_SIGNALS.has(s)) errs.push(`gold.${k} 모르는 신호: ${s}`);
  }
  for (const s of g.signals_ai ?? []) if (ALL_SIGNALS.has(s) && !AI_ALLOWED_SIGNALS.has(s) && !(g.signals_code ?? []).includes(s)) {
    errs.push(`gold.signals_ai에 AI가 낼 수 없는 신호: ${s}`);
  }
  if (!LEVELS.has(g.level_rule)) errs.push(`gold.level_rule 값: ${g.level_rule}`);
  if (!LEVELS.has(g.level_human)) errs.push(`gold.level_human 값: ${g.level_human}`);
  if (g.impersonation_type != null && !IMPERSONATION_TYPES.has(g.impersonation_type)) errs.push(`impersonation_type 값: ${g.impersonation_type}`);

  // 작성 원칙(15-1)
  const text = String(c.message_text);
  for (const m of text.matchAll(/01[016789][-\s.]?(\d{3,4})[-\s.]?\d{4}/g)) {
    if (!/^01[016789][-\s.]?0000[-\s.]?\d{4}$/.test(m[0])) errs.push("010-0000-XXXX가 아닌 휴대폰 번호");
  }
  if (messageDataset) {
    const { candidates, complete } = inspectLinkCandidates(text);
    // 지어낸 단축 주소는 KISA 목록에 없을 때만 허용한다(우연히 실제 피싱 주소와 같으면 안 됨, 링크는 열지 않음)
    const syntheticShort = (link) => isShortener(link.host) && !SHORT_URL_KEYS.has(shortUrlKey(link.raw));
    if (!complete || candidates.some(link => !link.host.endsWith(".invalid") && !syntheticShort(link) && !fixtureHomepage(link, c.group))) {
      errs.push("문자형 평가 주소는 합성 주소 또는 정상·경계 사례의 공식 대표 홈페이지만 허용");
    }
  } else {
    for (const link of findLinks(text)) {
      const d = toDomain(link);
      if (d && !isShortener(d) && !d.endsWith(".invalid")) errs.push(".invalid가 아닌 링크 도메인");
    }
  }
  return [...new Set(errs)];
}

/** 규칙 엔진 결과와 level_rule이 다르면 문구, 같으면 null */
export function ruleMismatch(c, { messageDataset = false } = {}) {
  const pi = c.parent_inputs ?? {};
  const code = [...(c.gold.signals_code ?? [])];
  if (messageDataset && code.includes(SIG.SIG_LINK)) {
    const { candidates, complete } = inspectLinkCandidates(c.message_text);
    if (complete && candidates.length && candidates.every(link => fixtureHomepage(link, c.group))) {
      code.push(SIG.SIG_OFFICIAL_LINK);
    }
  }
  const all = [...new Set([...code, ...(c.gold.signals_ai ?? [])])];
  const { level } = decide({
    signals_final: all,
    ...(messageDataset ? { signals_code: code } : {}),
    call_in_progress: Boolean(pi.call_in_progress),
    called_before: Boolean(pi.called_before),
    family_denied: Boolean(pi.family_denied),
  });
  return level === c.gold.level_rule ? null : `규칙 엔진 ${level} ≠ level_rule ${c.gold.level_rule}`;
}

/** 글자 3-gram 자카드 유사도 */
export function similarity(a, b) {
  const grams = (s) => {
    const t = s.replace(/\s+/g, "");
    const out = new Set();
    for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
    return out;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export const SIMILARITY_LIMIT = 0.6;

function main(paths) {
  const cases = paths.flatMap((p) => loadJsonl(p).map((c) => ({ ...c, _file: p })));
  let bad = 0;
  const seen = new Map();
  for (const c of cases) {
    const options = { messageDataset: isMessageDataset(c._file) };
    const errs = checkCase(c, options);
    if (seen.has(c.case_id)) errs.push(`case_id 중복(${seen.get(c.case_id)})`);
    seen.set(c.case_id, c._file);
    if (errs.length) { bad++; console.log(`ERR  ${c.case_id ?? "?"}  ${errs.join(" / ")}`); }
    else {
      const mm = ruleMismatch(c, options);
      if (mm) console.log(`NOTE ${c.case_id}  ${mm} (정답을 규칙에 맞추지 말고 이유를 PRD 15-1에 기록)`);
    }
  }

  const dev = cases.filter((c) => c.split === "dev");
  const test = cases.filter((c) => c.split === "test");
  for (const t of test) {
    for (const d of dev) {
      const s = similarity(t.message_text, d.message_text);
      if (s >= SIMILARITY_LIMIT) { bad++; console.log(`ERR  ${t.case_id}  개발용 ${d.case_id}와 너무 비슷함(${s.toFixed(2)})`); }
    }
  }

  console.log("-".repeat(60));
  console.log(`전체 ${cases.length}건 (dev ${dev.length}, test ${test.length})  문제 ${bad}건`);
  for (const [label, target, rows] of [
    ["평가용 묶음별", TARGET, test.filter(c => !isMessageDataset(c._file))],
    ["문자형 묶음별", MESSAGE_TARGET, test.filter(c => isMessageDataset(c._file))],
  ]) {
    if (!rows.length) continue;
    const counts = Object.entries(target).map(([g, n]) => `${g} ${rows.filter(c => c.group === g).length}/${n}`);
    console.log(`${label}: ${counts.join("  ")}`);
  }
  process.exitCode = bad ? 1 : 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  main(args.length ? args : ["eval/dev.jsonl"]);
}
