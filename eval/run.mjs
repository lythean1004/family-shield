#!/usr/bin/env node
/**
 * 평가 실행기 (PRD 15장)
 *
 *   node eval/run.mjs [--model gemini-3.1-flash-lite] [--timeout 3000] [--out eval/results/x.jsonl] [--no-ai]
 *
 * 환경 변수: AI_API_KEY(필수, --no-ai면 불필요), AI_BASE_URL(선택, 전체 chat/completions 주소)
 *
 * 케이스별 통과 조건:
 *   level_match    : 예측 판정 == gold.level_rule
 *   ai_sig_recall  : gold.signals_ai ⊆ (예측 signals_final)   ← 합집합 기준
 *   code_sig_match : gold.signals_code ⊆ 예측 signals_code
 * 출력 파일에는 원문을 담지 않는다(case_id로만 연결).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";
import { analyze } from "../packages/core/src/pipeline.js";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const NO_AI = argv.includes("--no-ai");
const MODEL = flag("--model", "gemini-3.1-flash-lite");
const TIMEOUT_MS = Number(flag("--timeout", "3000"));
const OUT_PATH = flag("--out", null);
const API_KEY = process.env.AI_API_KEY;
const BASE_URL = process.env.AI_BASE_URL || undefined;

if (!NO_AI && !API_KEY) {
  console.error("AI_API_KEY 환경 변수가 없습니다. (--no-ai로 코드 신호만 평가할 수 있음)");
  process.exit(1);
}

const cases = readFileSync(join(here, "dev.jsonl"), "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const ai = NO_AI
  ? null
  : { model: MODEL, apiKey: API_KEY, baseUrl: BASE_URL, timeoutMs: TIMEOUT_MS, promptVersion: "v1" };

console.log(`모델: ${NO_AI ? "(AI 끔)" : MODEL}  제한: ${TIMEOUT_MS}ms  케이스: ${cases.length}건`);
console.log("-".repeat(80));

const rows = [];
for (const c of cases) {
  const g = c.gold;
  const r = await analyze({
    text: c.message_text,
    parentInputs: c.parent_inputs ?? {},
    registeredLast4: c.fixture?.registered_member?.last4,
    ai,
  });

  const missedAi = g.signals_ai.filter((s) => !r.signals_final.includes(s));
  const missedCode = g.signals_code.filter((s) => !r.signals_code.includes(s));
  const extraAi = r.signals_ai.filter((s) => !g.signals_ai.includes(s));
  const row = {
    case_id: c.case_id,
    group: c.group,
    difficulty: c.difficulty,
    gold_level: g.level_rule,
    pred_level: r.level,
    level_match: r.level === g.level_rule,
    ai_sig_recall: missedAi.length === 0,
    code_sig_match: missedCode.length === 0,
    missed_ai: missedAi,
    missed_code: missedCode,
    extra_ai: extraAi,
    fired_rules: r.fired_rules,
    impersonation_type: r.impersonation_type,
    gold_impersonation_type: g.impersonation_type,
    fallback_used: r.fallback_used,
    fallback_reason: r.fallback_reason,
    timed_out: Boolean(r.ai_meta?.timed_out),
    latency_ms: r.ai_meta?.latency_ms ?? 0,
    cost_usd: r.ai_meta?.cost_usd ?? null,
  };
  row.pass = row.level_match && row.ai_sig_recall && row.code_sig_match;
  rows.push(row);

  const note = [
    missedAi.length ? `놓침:${missedAi.join(",")}` : "",
    missedCode.length ? `코드놓침:${missedCode.join(",")}` : "",
    extraAi.length ? `추가:${extraAi.join(",")}` : "",
    r.fallback_used ? `대체:${r.fallback_reason}` : "",
  ].filter(Boolean).join(" ");
  console.log(
    `${row.pass ? "PASS" : "FAIL"} ${c.case_id.padEnd(8)} ${r.level.padEnd(4)} (정답 ${g.level_rule.padEnd(4)}) ` +
    `${String(row.latency_ms).padStart(5)}ms ${note}`,
  );
}

// ── 집계 (PRD 15-2) ──────────────────────────────────────────────────────────
const n = rows.length;
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "N/A");
const RANK = { 확인필요: 0, 주의: 1, 위험: 2 };

const danger = rows.filter((r) => r.gold_level === "위험");
const notDanger = rows.filter((r) => r.gold_level !== "위험");
const check = rows.filter((r) => r.gold_level === "확인필요");
const missed = danger.filter((r) => r.pred_level !== "위험");
const falseAlarm = notDanger.filter((r) => r.pred_level === "위험");
const overCaution = check.filter((r) => r.pred_level === "주의");
const underCall = rows.filter((r) => RANK[r.pred_level] < RANK[r.gold_level]);

const lat = rows.filter((r) => !r.fallback_used || r.timed_out).map((r) => r.latency_ms).sort((a, b) => a - b);
const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.ceil(lat.length * p) - 1)] : 0);
const cost = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
const costKnown = rows.filter((r) => r.cost_usd != null).length;
const typeOk = rows.filter((r) => !r.fallback_used && r.impersonation_type === r.gold_impersonation_type).length;
const aiOk = rows.filter((r) => !r.fallback_used).length;

const summary = {
  run_at: new Date().toISOString(),
  model: NO_AI ? null : MODEL,
  timeout_ms: TIMEOUT_MS,
  cases: n,
  pass: rows.filter((r) => r.pass).length,
  level_match: rows.filter((r) => r.level_match).length,
  miss_rate: pct(missed.length, danger.length),
  false_alarm_rate: pct(falseAlarm.length, notDanger.length),
  over_caution_rate: pct(overCaution.length, check.length),
  under_call: underCall.map((r) => r.case_id),
  impersonation_type_acc: pct(typeOk, aiOk),
  fallback: rows.filter((r) => r.fallback_used).length,
  timeouts: rows.filter((r) => r.timed_out).length,
  timeout_rate: pct(rows.filter((r) => r.timed_out).length, n),
  latency_p50_ms: q(0.5),
  latency_p95_ms: q(0.95),
  latency_max_ms: lat.at(-1) ?? 0,
  cost_usd_total: Number(cost.toFixed(6)),
  cost_usd_per_case: costKnown ? Number((cost / costKnown).toFixed(6)) : null,
};

console.log("-".repeat(80));
console.log(`통과 ${summary.pass}/${n}  판정 일치 ${summary.level_match}/${n}`);
console.log(`놓침률 ${summary.miss_rate} (목표 5% 이하)  오경보율 ${summary.false_alarm_rate}  과잉 주의율 ${summary.over_caution_rate}`);
console.log(`사칭 유형 정확도 ${summary.impersonation_type_acc}  대체 ${summary.fallback}건  시간 초과 ${summary.timeouts}건 (${summary.timeout_rate})`);
console.log(`지연 p50 ${summary.latency_p50_ms}ms  p95 ${summary.latency_p95_ms}ms  최대 ${summary.latency_max_ms}ms`);
console.log(`비용 합계 $${summary.cost_usd_total}  건당 $${summary.cost_usd_per_case ?? "-"}`);
if (summary.under_call.length) console.log(`정답보다 낮게 판정: ${summary.under_call.join(", ")}`);

if (OUT_PATH) {
  const out = resolve(OUT_PATH);
  mkdirSync(dirname(out), { recursive: true });
  const body = [JSON.stringify({ summary }), ...rows.map((r) => JSON.stringify(r))].join("\n") + "\n";
  writeFileSync(out, body);
  console.log(`저장: ${out}`);
}

// 놓침이 있으면 종료 코드 1 (CI에서 확인용)
process.exitCode = missed.length ? 1 : 0;

