import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_ISOLATION } from "../src/signals.js";

const reports = [
  ["외부 자문 제안에 상대가 지원망 상의를 금지",true,"외부 자문을 받아 보겠다고 설명했더니 배우자와는 일절 상의하지 말라는 답이 돌아왔다."],
  ["도움 요청 계획 뒤 별개 상담 창구까지 차단",true,"도움을 구해 보겠다고 말했더니 친척이나 상담센터와는 아예 이야기하지 말라는 대답을 들었다."],
  ["상대의 금지 응답을 수신 기록에 남김",true,"조언을 얻어 보겠다고 했더니 친척에게는 전혀 말하지 말라는 응답을 들었다고 적었다."],
  ["상담사에게 도움 받으라는 안내",false,"외부 도움을 받겠다고 했더니 가족과 의논하고 상담사에게도 도움을 요청할 수 있다는 안내가 왔다."],
  ["고객의 민감정보 외부 공개에 한정된 업무상 금지",false,"자문을 구하겠다고 말했더니 상담은 가능하며 친구에게도 고객의 민감정보를 외부 공개하지 말라는 업무 안내가 돌아왔다."],
  ["자문과 별개 주제의 통화 금지",false,"외부 자문을 구하겠다고 했더니 의견을 받고 다시 검토하자는 답을 받았다. 한편 공연장 안에서는 전화하지 말라는 공지를 읽었다."],
  ["상대가 같은 요구를 철회",false,"자문을 구하겠다고 했더니 친척과는 일절 상의하지 말라는 응답이 왔다. 같은 요청은 취소됐다."],
  ["교육 사례를 기록",false,"예방 교육에서 읽은 사례다. 외부 자문을 받아 보겠다고 했더니 친구와 상담하지 말라는 답이었다."],
];

for (const [description, expected, text] of reports) {
  test(description, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_ISOLATION), expected);
    assert.equal(result.level === "위험", expected);
  });
}
