import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickSample, writeSample } from "../review-sample.mjs";
import { readSyntheticDataset, verifySyntheticContents } from "../synthetic-review.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sourcePath = join(root, "eval", "holdout-2026-11.jsonl");
const fixture = new URL("./fixtures/mock-explanation-model.mjs", import.meta.url).href;
const execRunner = (...args) => spawnSync(process.execPath, ["--import", fixture, "eval/run.mjs", ...args], {
  cwd: root, encoding: "utf8",
  env: { SystemRoot: process.env.SystemRoot, TEMP: tmpdir(), TMP: tmpdir(), TMPDIR: tmpdir(),
    AI_API_KEY: "local-fixture", AI_BASE_URL: "https://fixture.invalid/model" },
});
const lines = path => readFileSync(path,"utf8").trim().split(/\r?\n/).map(s=>JSON.parse(s));
describe("합성 평가 설명과 검수 CSV", () => {
  it("보류 세트 2판은 1판에서 HO-B-02의 사람 기대 단계만 변경했다", () => {
    const casesFrom = path => readSyntheticDataset(path).text.trim().split(/\r?\n/).map(line => JSON.parse(line));
    const firstEdition = casesFrom(sourcePath);
    const secondEdition = casesFrom(join(root, "eval", "holdout-2026-11-v2.jsonl"));
    const courtNotice = firstEdition.find(c => c.case_id === "HO-B-02");
    assert.equal(firstEdition.length, 60);
    assert.equal(courtNotice.gold.level_human, "위험");
    assert.equal(courtNotice.gold.level_rule, "확인필요");
    courtNotice.gold.level_human = "주의";
    assert.deepEqual(secondEdition, firstEdition);
  });

  it("등록 위치와 내용을 함께 확인하고 수정된 판본·같은 이름의 외부 파일은 거절한다", () => {
    const { text, source } = readSyntheticDataset(sourcePath);
    assert.deepEqual(verifySyntheticContents(source.dataset, text.replace(/\r?\n/g,"\r\n")), source);
    assert.throws(() => verifySyntheticContents(source.dataset, text + " "), /승인 버전/);
    const dir = mkdtempSync(join(tmpdir(), "fs-review-"));
    const other = join(dir, "holdout-2026-11.jsonl");
    writeFileSync(other, text);
    const out = join(dir, "result.jsonl");
    const failed = execRunner("--data", other, "--out", out, "--save-explanations");
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /승인된 저장소 합성/);
    assert.ok(!existsSync(out));
  });

  it("기본 실행에는 설명 필드가 없고 오래된 결과에서 검수 CSV를 만들지 않는다", () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-review-"));
    const path = join(dir, "plain.jsonl");
    const run = execRunner("--data", sourcePath, "--out", path, "--model", "synthetic-mock");
    assert.ok([0,1].includes(run.status) && existsSync(path), run.stderr);
    const [header,...records] = lines(path);
    assert.equal(records.length, 60);
    assert.ok(!header.summary.synthetic_review && records.every(r => !("explanation_for_parent" in r)));
    assert.throws(() => writeSample(path, { out: join(dir, "plain.csv") }), /save-explanations/);
  });

  it("가짜 모델의 검증 뒤 설명만 남기고 세 판정에서 각각 10건을 기본 추출한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-review-"));
    const path = join(dir, "mock.jsonl"), out = join(dir, "mock.csv");
    const run = execRunner("--data", sourcePath, "--out", path, "--save-explanations", "--model", "synthetic-mock");
    assert.ok([0,1].includes(run.status) && existsSync(path), run.stderr);
    const [header,...records] = lines(path);
    assert.equal(header.summary.synthetic_review.dataset, "holdout-2026-11.jsonl");
    assert.equal(records.length,60);
    for (const r of records) {
      assert.ok(Array.isArray(r.explanation_for_parent));
      assert.ok(!("message_text" in r));
      assert.ok(!r.explanation_for_parent.includes("이상이 없어요."));
    }
    const cli = spawnSync(process.execPath, ["eval/review-sample.mjs", path, "--out", out], { cwd: root, encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const csv = readFileSync(out,"utf8");
    assert.ok(csv.startsWith("\uFEFF"));
    const [head,...body] = csv.trim().split("\r\n");
    assert.match(head, /맞춤법.*사실 오류.*‘안전’처럼 읽힘.*기타/);
    assert.equal(body.length, 30);
    for (const level of ["위험","주의","확인필요"]) assert.equal(body.filter(l=>l.includes(',"'+level+'",')).length,10);
    assert.ok(body.every(l=>l.endsWith(',"","","",""')));
    assert.throws(() => writeSample(path, { out }), /EEXIST/);
  });

  it("설명이 없는 행은 건너뛰고 부족한 단계의 몫은 남은 단계에서 중복 없이 채운다", () => {
    const rows = ["위험","위험","위험","주의","확인필요"].map((pred_level,i)=>({
      pred_level, case_id: String(i), fallback_used: i===4, explanation_for_parent: ["검토할 문장이에요."],
    }));
    const ids = new Set(rows.map(r=>r.case_id));
    const take = pickSample(rows, ids, 4, "test");
    assert.deepEqual(take, pickSample([...rows].reverse(), ids, 4, "test"));
    assert.equal(new Set(take.map(r=>r.case_id)).size,4);
    assert.ok(take.every(r=>r.case_id!=="4"));
    assert.throws(()=>pickSample([...rows,rows[0]], ids), /중복/);
    assert.throws(()=>pickSample(rows, new Set()), /사례 ID/);
    assert.throws(()=>pickSample(rows,ids,0), /양의 정수/);
  });
});
