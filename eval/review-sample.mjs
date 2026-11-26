#!/usr/bin/env node
// node eval/review-sample.mjs 결과.jsonl [--count 30] [--seed 2026-11] [--out 검수.csv]
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { approvedReviewCases } from "./synthetic-review.mjs";
import { filterExplanation } from "../packages/core/src/validator.js";

const levels = ["위험", "주의", "확인필요"];
export function pickSample(rows, validIds, count = 30, seed = "2026-11") {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("표본 수는 양의 정수여야 합니다.");
  const buckets = new Map(levels.map(l => [l, []]));
  const seen = new Set();
  for (const row of rows) {
    if (!validIds.has(row.case_id) || seen.has(row.case_id)) throw new Error("승인 자료와 결과의 사례 ID가 다르거나 중복됩니다.");
    seen.add(row.case_id);
    if (!buckets.has(row.pred_level) || !Array.isArray(row.explanation_for_parent)) throw new Error("판정 또는 설명 필드가 없는 결과입니다.");
    const sentences = filterExplanation(row.explanation_for_parent);
    if (row.fallback_used || !sentences.length) continue;
    const order = createHash("sha256").update(seed + "\n" + row.case_id).digest("hex");
    buckets.get(row.pred_level).push({ case_id: row.case_id, level: row.pred_level, sentences, order });
  }
  for (const bucket of buckets.values()) bucket.sort((a,b) => a.order.localeCompare(b.order));
  const selected = [];
  for (let i = 0; selected.length < count; i++) {
    const round = levels.map(l => buckets.get(l)[i]).filter(Boolean);
    if (!round.length) break;
    selected.push(...round.slice(0, count - selected.length));
  }
  return selected;
}

const columns = ["case_id", "판정", "설명 문장", "맞춤법", "사실 오류", "‘안전’처럼 읽힘", "기타"];
function csvCell(value) {
  const text = /^[\s]*[=+@-]/u.test(value) ? "'" + value : value;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function writeSample(input, { count = 30, seed, out } = {}) {
  const [header, ...rows] = readFileSync(input, "utf8").trim().split(/\r?\n/).map(l => JSON.parse(l));
  const ids = approvedReviewCases(header.summary?.synthetic_review);
  const chosen = pickSample(rows, ids, count, seed);
  if (!chosen.length) throw new Error("표본으로 쓸 AI 설명이 0개입니다.");
  const target = out ?? join(dirname(fileURLToPath(import.meta.url)), "review", basename(input, extname(input)) + "-sample.csv");
  const table = [columns, ...chosen.map(r => [r.case_id, r.level, r.sentences.join(" "), "", "", "", ""])];
  mkdirSync(dirname(resolve(target)), { recursive: true });
  writeFileSync(target, "\uFEFF" + table.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n", { flag: "wx" });
  return { path: target, counts: Object.fromEntries(levels.map(l => [l, chosen.filter(r => r.level === l).length])) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { positionals, values } = parseArgs({ allowPositionals: true,
    options: { count: { type: "string" }, seed: { type: "string" }, out: { type: "string" } } });
  if (positionals.length !== 1) throw new Error("결과 JSONL 경로 하나를 지정하세요.");
  const { path, counts } = writeSample(positionals[0], { ...values, count: Number(values.count ?? 30) });
  console.log(path, counts);
}
