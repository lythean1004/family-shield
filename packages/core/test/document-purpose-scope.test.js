import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const address = "https://form.invalid/documents";
const documents = "서류로 신분증 사진과 통장 사본을 함께 제출해야 한다는 안내를 받았습니다. 두 서류를 낼 곳은 " + address;
const purposeField = purpose => [
  "받은 신청 양식", "신청 목적: " + purpose, "필수 첨부 서류: 신분증 사진과 통장 사본", "제출 주소: " + address,
].join("\n");

const cases = [
  ["지원금 신청 목적과 묶음 제출이 명시됨", "지원금 신청에 관한 안내였습니다. " + documents, true],
  ["다른 명목만 부정하고 실제 목적을 밝힘", "부업 신청은 아니고 지원금 신청이라는 안내였습니다. " + documents, true],
  ["양식의 명시적 사업명", purposeField("부업 모집"), true],
  ["명목 없이 묶음 제출만 요구", documents, false],
  ["일반 생활 상담", "일상생활 상담을 접수한다는 연락이었습니다. " + documents, false],
  ["지원금과 부업을 모두 부정한 접수", "지원금이나 부업 신청을 위한 절차가 아니라고 적혀 있었습니다. " + documents, false],
  ["양식에서 지원금과의 관련성을 부정", purposeField("지원금 신청과 무관한 동호회 가입"), false],
  ["다른 신청의 서류임을 명시", "부업 신청 서류가 아니라 동호회 가입에 쓰는 자료라고 했습니다. " + documents, false],
  ["기재란에 근무 장소가 우연히 등장", purposeField("재택 근무 중인 회원의 일반 생활 상담"), false],
  ["수신자의 일하는 장소가 서류 접수의 목적은 아님", "저는 재택 근무 중이었습니다. " + documents, false],
  ["본문에 들어 있는 별도 공지의 목적", "지원금 안내를 읽었습니다. 별개로 회원 등록 " + documents, false],
];

for (const [name, text, expected] of cases) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.fired_rules.includes("R17"), expected);
    assert.equal(result.signals_code.includes("SIG_DOCUMENT_BUNDLE"), expected);
  });
}

test("서류 목적이 없어도 확인한 다른 위험 사유가 적용된다", async () => {
  const result = await analyze({ text: documents, parentInputs: { family_denied: true }, ai: null });
  assert.ok(!result.fired_rules.includes("R17"));
  assert.ok(result.fired_rules.includes("R5"));
  assert.equal(result.level, "위험");
});
