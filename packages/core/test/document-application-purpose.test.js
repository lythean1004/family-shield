import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const documents = " 신분증 사진과 통장 사본을 함께 제출해야 한다는 안내를 받았습니다. 두 서류를 낼 곳은 https://purpose-only.invalid/form";
const cases = [
  ["본인이 지원금 지급을 신청한 절차", "지원금 지급을 신청한 절차였습니다.", true],
  ["긴급 생계비 지급 신청을 수신 기록에 명시", "긴급 생계비 지급을 신청했다는 수신 기록입니다.", true],
  ["신규 부업에 지원하는 목적을 명시", "부업에 지원하기 위한 신청 절차였습니다.", true],
  ["지원금 상담 후 서비스 만족도 조사", "지원금 상담을 받은 분들의 만족도 조사입니다.", false],
  ["부업 문의 후 서비스 이용 조사", "부업 문의 서비스를 이용한 사람에 대한 설문입니다.", false],
  ["지원금 공지를 읽은 독자 조사", "지원금 안내를 읽은 분에게 하는 설문입니다.", false],
  ["신청자도 참여하는 별도 의견 수집", "지원금 신청자 대상 만족도 조사입니다.", false],
  ["목적이 명시되지 않은 상담 메모", "부업 상담을 마친 기록입니다.", false],
  ["종료된 설문 다음에 실제로 신청한 다른 지원", "설문은 끝났습니다. 긴급 생계비 지급을 신청했습니다.", true],
  ["이전 조사를 끝내고 같은 문장에서 새 신청을 밝힘", "만족도 조사는 끝났고 그와 별개로 지원금 지급을 신청했습니다.", true],
  ["발신 안내가 지원금 접수라고 밝히고 같은 신청의 접수처를 지정", "지원금이라는 안내에서 접수처로 보낼 신청 서류를 명시했습니다.", true],
];
for (const [name, context, expected] of cases) {
  test(name, async () => {
    const result = await analyze({ text: context + documents, ai: null });
    assert.equal(result.fired_rules.includes("R17"), expected);
    assert.equal(result.signals_code.includes("SIG_DOCUMENT_BUNDLE"), expected);
  });
}
