import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_DOCUMENT_BUNDLE } from "../src/signals.js";

const reports = [
  ["서류 요구 뒤의 같은 접수 주소",true,"지원금 접수 안내를 받았다. 신분증 사본과 통장 사본을 함께 제출하라고 적혀 있었고, 제출 링크는 https://application-record.invalid 가 명시돼 있었다."],
  ["같은 기록에서 주소가 먼저 나온 경우",true,"받은 부업 접수 안내의 수신 기록. 같은 접수 링크는 https://submission-notes.invalid 로 기재돼 있었고, 통장 사본 및 신분증 사본을 함께 첨부해야 한다고 안내돼 있었다."],
  ["신청 기록에 두 서류의 공동 요구",true,"재택 채용 신청 메시지를 읽었다. 운전면허증 사본과 통장 사본을 동시에 제출해 달라는 요청을 받았고, 신청 주소로는 https://employment-intake.invalid 이 표시돼 있었다."],
  ["두 자료가 참고 목록에만 나옴",false,"지원금 신청 안내를 받았다. 신분증 사본과 통장 사본을 제출하라고 적혀 있지 않았다. 양식 견본 주소는 https://sample-sheet.invalid 로 표시돼 있었다."],
  ["표시된 주소가 다른 목적의 접수처",false,"부업 모집 안내를 받았다. 신분증 사본과 통장 사본을 함께 제출하라고 적혀 있었고, 다른 행사의 접수 주소는 https://separate-session.invalid 로 기재돼 있었다."],
  ["같은 제출 지시가 철회됨",false,"지원금 접수 안내를 받았다. 신분증 사본과 통장 사본을 함께 제출하라고 적혀 있었고, 제출 링크는 https://withdrawn-record.invalid 가 명시돼 있었다. 그 제출 요구는 철회됐다."],
  ["접수 주소 표시에 대한 명시 부정",false,"재택 채용 접수 안내를 읽었다. 신분증 사본과 통장 사본을 함께 제출하라고 적혀 있었고, 접수 주소로는 https://contact-notes.invalid 이 붙어 있지 않았다."],
];

for (const [name, expected, text] of reports) {
  test(name, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_DOCUMENT_BUNDLE), expected);
    assert.equal(result.level === "위험", expected);
  });
}
