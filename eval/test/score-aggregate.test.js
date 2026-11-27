import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../score-aggregate.mjs", import.meta.url));
function run(contents, args = []) {
  const path = join(mkdtempSync(join(tmpdir(), "fs-score-")), "sample.jsonl");
  writeFileSync(path, contents);
  return spawnSync(process.execPath, [script, path, ...args], { encoding: "utf8" });
}

it("작성자가 고정한 파일 지문이 일치할 때만 집계한다", () => {
  const sample = JSON.stringify({ gold: { level_rule: "확인필요" }, message_text: "수업 장소 안내" }) + "\n";
  const digest = createHash("sha256").update(sample).digest("hex");
  const result = run(sample, ["--sha256", digest]);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { cases: 1, danger: 0, nonDanger: 1, misses: 0, falseAlarms: 0 });
  const changed = run(sample + "\n", ["--sha256", digest]);
  assert.equal(changed.status, 2);
  assert.equal(changed.stdout, "");
  assert.equal(changed.stderr.trim(), "평가 자료의 전체 집계를 완료하지 못했습니다.");
});

it("가족 응답과 규칙 정답을 적용하고 총 다섯 개의 건수만 출력한다", () => {
  const rows = [
    { expected: "위험", denied: false }, { expected: "위험", denied: true },
    { expected: "주의", denied: true }, { expected: "확인필요", denied: false },
  ].map(({ expected, denied }) => JSON.stringify({
    case_id: "공개하지 않을 예시", message_text: "종이접기 수업 안내",
    parent_inputs: { family_denied: denied }, gold: { level_rule: expected, level_human: "주의" },
  }));
  const result = run(rows.join("\n"));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), { cases: 4, danger: 2, nonDanger: 2, misses: 1, falseAlarms: 1 });
});

it("잘못된 행에서도 원문과 부분 집계를 출력하지 않는다", () => {
  const result = run('{"gold":{"level_rule":"주의"},"message_text":"예시"}\n이 줄은 외부에 표시하면 안 됨');
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "평가 자료의 전체 집계를 완료하지 못했습니다.");
});

it("동일한 예측을 규칙 정답과 독립 작성자의 사람 기대 등급에 각각 집계한다", () => {
  const data = [
    { parent_inputs: { family_denied: true }, gold: { level_rule: "위험", level_human: "주의" } },
    { gold: { level_rule: "주의", level_human: "위험" } },
  ].map(row => JSON.stringify({ ...row, message_text: "합창 수업 안내" })).join("\n");
  const digest = createHash("sha256").update(data).digest("hex");
  const result = run(data, ["--sha256", digest, "--with-human"]);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    cases: 2, danger: 1, nonDanger: 1, misses: 0, falseAlarms: 0,
    human: { danger: 1, nonDanger: 1, misses: 1, falseAlarms: 1 },
  });
});

it("사람 기준도 요청하면 잘못된 사람 등급에서 부분 집계를 쓰지 않는다", () => {
  const data = JSON.stringify({ message_text: "그림 수업 안내", gold: { level_rule: "주의" } });
  const result = run(data, ["--with-human"]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
});
