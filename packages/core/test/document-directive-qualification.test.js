import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_DOCUMENT_BUNDLE } from "../src/signals.js";

const form = "재택 부업 신청 안내에서 접수 양식 https://submission-observation.invalid/form 이 안내됐습니다.";
const request = "신분증 사본과 통장 사본을 그 양식에 함께 첨부하라고 했습니다.";

for (const [name, continuation] of [
  ["발신자가 직접 첨부하라고 한 사실을 부인", "같은 발신자는 신분증 사본과 통장 사본을 그 양식에 첨부하라고 한 적이 없다고 밝혔습니다."],
  ["발신자가 첨부하라는 뜻이 아니었다고 설명", "발신자는 신분증 사본과 통장 사본을 그 양식에 첨부하라는 뜻은 아니었다고 밝혔습니다."],
  ["바로 앞에 인용한 첨부 요청은 교육 예시", request + " 앞의 첨부 요청은 실제 요구가 아니라 교육 예시였습니다."],
  ["그 제출 지시는 작성 예시였다고 명시", request + " 그 제출 지시는 작성 예시였습니다."],
  ["상대가 제출 지시를 명시적으로 철회", request + " 그 요청은 철회됐습니다."],
]) {
  test(name, async () => {
    const result = await analyze({ text: form + " " + continuation, ai: null });
    assert.ok(!result.signals_code.includes(SIG_DOCUMENT_BUNDLE));
    assert.ok(!result.fired_rules.includes("R17"));
  });
}

for (const [name, continuation] of [
  ["현재 발신자의 명시적 두 서류 첨부 요구", request],
  ["수신자가 이행한 적이 없다고 기록", request + " 수신자인 저는 두 서류를 제출한 적이 없다고 밝혔습니다."],
  ["수신자가 요구를 거절해도 현재 발신자 요구는 유지", request + " 저는 받은 요구에 응하지 않겠다고 답했습니다."],
  ["별개 교육 자료는 현재 요구의 상태를 바꾸지 않음", request + " 별개 교육 자료에서도 첨부 예시를 봤습니다."],
  ["앞의 요구와 별개로 다른 설명을 교육 예시라고 함", request + " 그와 별개로 행사 안내문은 교육 예시였습니다."],
]) {
  test(name, async () => {
    const result = await analyze({ text: form + " " + continuation, ai: null });
    assert.equal(result.level, "위험");
    assert.ok(result.signals_code.includes(SIG_DOCUMENT_BUNDLE));
    assert.ok(result.fired_rules.includes("R17"));
  });
}
