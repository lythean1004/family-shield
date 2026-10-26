#!/usr/bin/env node
/**
 * 평가 데이터 검사기 (PRD 15-1)
 *
 *   node eval/validate.mjs [eval/dev.jsonl] [eval/test.jsonl ...]
 *
 * 확인하는 것:
 *   - 필수 필드와 값 범위(group, split, level, 신호 ID, 사칭 유형)
 *   - case_id 중복(파일끼리도)
 *   - 작성 원칙: 번호는 010-0000-XXXX만, 링크 도메인은 .invalid만(단축 URL 서비스 예외)
 *   - level_rule이 규칙 엔진 결과와 같은지(정답을 규칙에 맞춰 바꾸지 말 것 — 다르면 알려만 준다)
 *   - 묶음별 건수(목표 A35 B45 C25 D1 50 D2 35 E10)
 *   - 평가용(test)과 개발용(dev) 문장이 너무 비슷하지 않은지(말만 바꿔 쓰기 방지, 15-1)
 * 출력에 원문을 찍지 않는다(case_id로만).
 */
import { readFileSync } from "node:fs";
import { decide } from "../packages/core/src/rule-engine.js";
import { AI_ALLOWED_SIGNALS, IMPERSONATION_TYPES } from "../packages/core/src/signals.js";
import * as SIG from "../packages/core/src/signals.js";
import { findLinks, toDomain, isShortener } from "../packages/core/src/links.js";

const ALL_SIGNALS = new Set(Object.entries(SIG).filter(([k]) => k.startsWith("SIG_")).map(([, v]) => v));
const LEVELS = new Set(["위험", "주의", "확인필요"]);
const GROUPS = new Set(["A", "B", "C", "D1", "D2", "E"]);
const TARGET = { A: 35, B: 45, C: 25, D1: 50, D2: 35, E: 10 };

export function loadJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`${path}:${i + 1} JSON 오류`); }
  });
}

/** @returns {string[]} 이 케이스의 문제 목록 */
export function checkCase(c) {
  const errs = [];
  const need = ["case_id", "split", "group", "message_text", "gold"];
  for (const k of need) if (c[k] == null) errs.push(`필드 없음: ${k}`);
  if (errs.length) return errs;
  if (!["dev", "test"].includes(c.split)) errs.push(`split 값: ${c.split}`);
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
  for (const link of findLinks(text)) {
    const d = toDomain(link);
    if (d && !isShortener(d) && !d.endsWith(".invalid")) errs.push(`.invalid가 아닌 링크 도메인`);
  }
  return [...new Set(errs)];
}

/** 규칙 엔진 결과와 level_rule이 다르면 문구, 같으면 null */
export function ruleMismatch(c) {
  const pi = c.parent_inputs ?? {};
  const all = [...new Set([...(c.gold.signals_code ?? []), ...(c.gold.signals_ai ?? [])])];
  const { level } = decide({
    signals_final: all,
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
    const errs = checkCase(c);
    if (seen.has(c.case_id)) errs.push(`case_id 중복(${seen.get(c.case_id)})`);
    seen.set(c.case_id, c._file);
    if (errs.length) { bad++; console.log(`ERR  ${c.case_id ?? "?"}  ${errs.join(" / ")}`); }
    else {
      const mm = ruleMismatch(c);
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

  const count = (arr) => Object.fromEntries(Object.keys(TARGET).map((g) => [g, arr.filter((c) => c.group === g).length]));
  console.log("-".repeat(60));
  console.log(`전체 ${cases.length}건 (dev ${dev.length}, test ${test.length})  문제 ${bad}건`);
  if (test.length) {
    const tc = count(test);
    console.log("평가용 묶음별: " + Object.entries(TARGET).map(([g, n]) => `${g} ${tc[g]}/${n}`).join("  "));
  }
  process.exitCode = bad ? 1 : 0;
}

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  main(args.length ? args : ["eval/dev.jsonl"]);
}
