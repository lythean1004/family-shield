import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../score-aggregate.mjs", import.meta.url));
function run(contents) {
  const path = join(mkdtempSync(join(tmpdir(), "fs-score-")), "sample.jsonl");
  writeFileSync(path, contents);
  return spawnSync(process.execPath, [script, path], { encoding: "utf8" });
}

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
