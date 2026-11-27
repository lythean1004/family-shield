import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const cases = [
  ["사용자가 부모의 값과 별개 주어로 등장하면 소유 관계를 가정하지 않음", false,
    "원격 지원을 제안한 문자에서 제가 부모 본인에게 생성된 일회성 화면 공유 번호를 발신자에게 전달하라는 요청이 있었습니다."],
  ["부모에게 발급된 값을 보고자가 전달하는 경우를 사용자 값으로 보지 않음", false,
    "원격 지원을 제안한 메시지에서 제가 부모에게 발급된 임시 화면 공유 값을 발신인에게 전달하라는 지시가 있었습니다."],
  ["같은 문장 안의 본인이 어느 역할인지 구분할 수 없음", false,
    "원격 도움을 제안한 사람이 제게 발급된 화면공유용 임시 값을 본인에게 건네라고 요청했습니다."],
  ["코드 소유자인 부모 본인과 수취인 본인이 같은 사람일 수 있음", false,
    "원격 지원을 제안한 사람이 부모 본인에게 표시된 화면공유용 일회성 번호를 본인에게 전달하라고 했습니다."],
  ["별도로 명시된 전달 주체 없이 문서가 지목한 값 소유자와 상대", true,
    "원격 수리를 제안한 문자에서 부모 본인에게 발급된 임시 화면공유 값을 보낸 사람에게 전달하라는 요청이 있었습니다."],
  ["지원 상대가 자신을 실제 전달 대상으로 지목", true,
    "원격으로 기기를 고쳐 준다는 사람이 자신에게 제 화면에 나타난 일회성 화면 공유 값을 보내라고 요청했습니다."],
];
for (const [title, expected, text] of cases) test(title, async () => {
  const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
  assert.equal(result.fired_rules.includes("R16"), expected);
  assert.equal(result.signals_code.includes("SIG_CREDENTIAL_DISCLOSURE"), expected);
});
