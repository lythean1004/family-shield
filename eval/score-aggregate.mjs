// 로컬 규칙만으로 채점한다. 성공하면 분모와 오류 건수만 표준 출력에 한 줄 남긴다.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { analyze } from "../packages/core/src/pipeline.js";

const levels = new Set(["위험", "주의", "확인필요"]);
const parentFlags = ["call_in_progress", "called_before", "family_denied"];
const errorCounts = () => ({ danger: 0, nonDanger: 0, misses: 0, falseAlarms: 0 });

function countPrediction(counts, expected, predicted) {
  if (expected === "위험") {
    counts.danger++;
    if (predicted !== "위험") counts.misses++;
  } else {
    counts.nonDanger++;
    if (predicted === "위험") counts.falseAlarms++;
  }
}

try {
  const [file, ...args] = process.argv.slice(2);
  const includeHuman = args.at(-1) === "--with-human";
  if (includeHuman) args.pop();
  if (!file || (args.length && (args.length !== 2 || args[0] !== "--sha256" || !/^[0-9a-f]{64}$/.test(args[1])))) throw new Error();
  const bytes = readFileSync(file);
  if (args.length && createHash("sha256").update(bytes).digest("hex") !== args[1]) throw new Error();
  const data = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const counts = { cases: 0, ...errorCounts() };
  if (includeHuman) counts.human = errorCounts();
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    const expected = item.gold?.level_rule;
    if (!levels.has(expected) || typeof item.message_text !== "string") throw new Error();
    if (includeHuman && !levels.has(item.gold.level_human)) throw new Error();
    const parentInputs = item.parent_inputs ?? {};
    if (parentFlags.some(flag => Object.hasOwn(parentInputs, flag) && typeof parentInputs[flag] !== "boolean")) {
      throw new Error();
    }
    const { level } = await analyze({
      text: item.message_text,
      parentInputs,
      registeredLast4: item.fixture?.registered_member?.last4,
      ai: null,
    });
    if (!levels.has(level)) throw new Error();
    counts.cases++;
    countPrediction(counts, expected, level);
    if (includeHuman) countPrediction(counts.human, item.gold.level_human, level);
  }
  if (!counts.cases) throw new Error();
  console.log(JSON.stringify(counts));
} catch {
  // JSON 해석 오류에는 입력 일부가 포함될 수 있다. 중간 집계도 출력하지 않는다.
  console.error("평가 자료의 전체 집계를 완료하지 못했습니다.");
  process.exitCode = 2;
}
