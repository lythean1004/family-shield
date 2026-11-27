// 로컬 규칙만으로 채점한다. 성공하면 분모와 오류 건수만 표준 출력에 한 줄 남긴다.
import { readFileSync } from "node:fs";
import { analyze } from "../packages/core/src/pipeline.js";

const levels = new Set(["위험", "주의", "확인필요"]);
try {
  if (process.argv.length !== 3) throw new Error();
  const data = readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "");
  const counts = { cases: 0, danger: 0, nonDanger: 0, misses: 0, falseAlarms: 0 };
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    const expected = item.gold?.level_rule;
    if (!levels.has(expected) || typeof item.message_text !== "string") throw new Error();
    const { level } = await analyze({
      text: item.message_text,
      parentInputs: item.parent_inputs ?? {},
      registeredLast4: item.fixture?.registered_member?.last4,
      ai: null,
    });
    if (!levels.has(level)) throw new Error();
    counts.cases++;
    if (expected === "위험") {
      counts.danger++;
      if (level !== "위험") counts.misses++;
    } else {
      counts.nonDanger++;
      if (level === "위험") counts.falseAlarms++;
    }
  }
  if (!counts.cases) throw new Error();
  console.log(JSON.stringify(counts));
} catch {
  // JSON 해석 오류에는 입력 일부가 포함될 수 있다. 중간 집계도 출력하지 않는다.
  console.error("평가 자료의 전체 집계를 완료하지 못했습니다.");
  process.exitCode = 2;
}
