#!/usr/bin/env node
/**
 * VM DB 마이그레이션 (D36)
 *
 *   node db/migrate.mjs            적용 안 된 파일만 순서대로 적용
 *   node db/migrate.mjs --status   적용 상태만 출력
 *
 * 순서: db/bootstrap/*.sql → supabase/migrations/*.sql → db/migrations/*.sql (각각 이름 순)
 * 파일마다 한 트랜잭션. 적용 기록은 private.schema_migrations(파일 이름 + sha256).
 * 이미 적용된 파일의 내용이 바뀌면 멈춘다(고치려면 새 파일을 추가).
 * 접속 정보: DATABASE_HOST/PORT/NAME/USER/PASSWORD (systemd EnvironmentFile 또는 ~/.pgpass)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../skill/package.json"));
const { Client } = require("pg");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["db/bootstrap", "supabase/migrations", "db/migrations"];
const statusOnly = process.argv.includes("--status");

const files = DIRS.flatMap((d) => {
  const dir = join(root, d);
  return existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => ({ name: `${d}/${f}`, path: join(dir, f) }))
    : [];
});

const client = new Client({
  host: process.env.DATABASE_HOST || "127.0.0.1",
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME || "familyshield",
  user: process.env.DATABASE_USER || "fs_app",
  password: process.env.DATABASE_PASSWORD || undefined, // 없으면 ~/.pgpass
});

await client.connect();
await client.query(`create schema if not exists private`);
await client.query(`create table if not exists private.schema_migrations (
  name text primary key, sha256 text not null, applied_at timestamptz not null default now())`);
const done = new Map((await client.query(`select name, sha256 from private.schema_migrations`)).rows.map((r) => [r.name, r.sha256]));

let applied = 0;
for (const f of files) {
  const sql = readFileSync(f.path, "utf8");
  const sha = createHash("sha256").update(sql).digest("hex");
  if (done.has(f.name)) {
    if (done.get(f.name) !== sha) {
      console.error(`STOP: ${f.name} 는 이미 적용됐는데 내용이 바뀌었다. 새 마이그레이션 파일로 고칠 것.`);
      process.exit(1);
    }
    if (statusOnly) console.log(`ok   ${f.name}`);
    continue;
  }
  if (statusOnly) { console.log(`TODO ${f.name}`); continue; }
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(`insert into private.schema_migrations(name, sha256) values ($1, $2)`, [f.name, sha]);
    await client.query("commit");
    console.log(`applied ${f.name}`);
    applied++;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error(`FAIL ${f.name}: ${e.message}${e.position ? ` (position ${e.position})` : ""}`);
    process.exit(1);
  }
}
if (!statusOnly) console.log(`done: ${applied} applied, ${files.length - applied} already up to date`);
await client.end();
