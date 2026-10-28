#!/usr/bin/env node
/**
 * DB 권한 테스트 실행기 (D36, VM PostgreSQL)
 *
 *   node db/test.mjs                 supabase/tests/*.test.sql 전부
 *
 * 테스트 파일은 Supabase CLI(pgTAP)용 그대로 쓴다. 차이만 여기서 맞춘다.
 *   - pgtap 확장이 없으므로 db/test/tap.sql(같은 이름의 최소 함수, tap 스키마)을 같은 트랜잭션에서 먼저 실행
 *   - `create extension ... pgtap` 줄은 건너뜀
 *   - 파일 안의 `reset role`은 접속 계정(fs_app)으로 돌아간다. 테스트의 "postgres로 실행" 단계(픽스처 삽입,
 *     purge_expired 실행)는 Supabase에서 superuser였지만 여기서는 service_role로 바꿔 실행한다.
 *     service_role은 RLS를 우회하고 purge_expired 실행 권한이 있어 테스트 의미가 같다.
 *   - 파일은 begin … rollback 이라 DB에 아무것도 남지 않는다.
 * 각 select 결과를 TAP 줄로 모아 ok/not ok를 센다. not ok가 하나라도 있으면 종료 코드 1.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../skill/package.json"));
const { Client } = require("pg");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tap = readFileSync(join(root, "db/test/tap.sql"), "utf8");

// 문장 단위로 나눈다. $$ … $$ 와 '…' 안의 세미콜론은 무시.
function splitSql(sql) {
  const out = []; let cur = ""; let i = 0; let inDollar = false; let inQuote = false;
  while (i < sql.length) {
    if (!inQuote && sql.startsWith("$$", i)) { inDollar = !inDollar; cur += "$$"; i += 2; continue; }
    const ch = sql[i];
    if (!inDollar && ch === "'") inQuote = !inQuote;
    if (!inDollar && !inQuote && ch === "-" && sql[i + 1] === "-") { const e = sql.indexOf("\n", i); i = e < 0 ? sql.length : e; continue; }
    if (!inDollar && !inQuote && ch === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; i++; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const files = readdirSync(join(root, "supabase/tests")).filter((f) => f.endsWith(".test.sql")).sort();
let total = 0, failed = 0;

for (const f of files) {
  const client = new Client({
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || "familyshield",
    user: process.env.DATABASE_USER || "fs_app",
    password: process.env.DATABASE_PASSWORD || undefined,
  });
  await client.connect();
  const stmts = splitSql(readFileSync(join(root, "supabase/tests", f), "utf8"));
  const lines = [];
  // fs_app은 NOINHERIT라 자기 권한이 없다. "postgres 단계"는 service_role로.
  let asSuper = true;
  for (const s of stmts) {
    const low = s.toLowerCase();
    if (/^create extension .*pgtap/.test(low)) continue;
    if (low === "begin") {
      await client.query("begin");
      // tap.sql runs as fs_app (owner, can create the schema); errors here are a harness bug, not a test failure
      try { await client.query("reset role"); await client.query(tap); } catch (e) { console.error(`tap.sql failed: ${e.message}`); process.exit(2); }
      await client.query("set local role service_role");
      continue;
    }
    if (low === "rollback") { await client.query("rollback"); continue; }
    if (low === "reset role") { await client.query("reset role"); await client.query("set local role service_role"); asSuper = true; continue; }
    if (/^set local role /.test(low)) { asSuper = false; await client.query("reset role"); await client.query(s); continue; }
    // pgTAP 함수는 pg_temp에 있다. 테스트 문장의 이름을 그대로 찾도록 search_path에 pg_temp를 앞에 둔다.
    if (/^select /.test(low) && /\b(plan|is|ok|throws_ok|lives_ok|finish)\s*\(/.test(low)) {
      let res;
      try {
        await client.query("savepoint s");
        await client.query("set local search_path = tap, public, extensions");
        res = await client.query(s);
        await client.query("release savepoint s");
      } catch (e) {
        await client.query("rollback to savepoint s").catch(() => {});
        lines.push(`not ok - statement error: ${e.message} :: ${s.slice(0, 80)}`);
        continue;
      }
      for (const row of res.rows) for (const v of Object.values(row)) if (v != null) lines.push(String(v));
      continue;
    }
    try {
      // savepoint so one failing setup line does not abort the whole test transaction
      await client.query("savepoint s");
      await client.query(s);
      await client.query("release savepoint s");
    }
    catch (e) {
      await client.query("rollback to savepoint s").catch(() => {});
      lines.push(`not ok - setup failed (${asSuper ? "service_role" : "role"}): ${e.message} :: ${s.slice(0, 80)}`);
    }
  }
  await client.end();

  const results = lines.filter((l) => /^(not )?ok /.test(l));
  const bad = results.filter((l) => l.startsWith("not ok"));
  const plan = lines.find((l) => /^1\.\.\d+/.test(l));
  const planned = plan ? Number(plan.slice(3)) : null;
  const mismatch = planned !== null && planned !== results.length;
  total += results.length; failed += bad.length + (mismatch ? 1 : 0);
  console.log(`== ${f}: ${results.length - bad.length}/${results.length} ok${planned !== null ? ` (plan ${planned})` : ""}`);
  for (const l of [...bad, ...lines.filter((l) => l.startsWith("# PLAN MISMATCH"))]) console.log("   " + l);
}
console.log(`TOTAL ${total - failed}/${total} ${failed ? "FAILED" : "passed"}`);
process.exitCode = failed ? 1 : 0;
