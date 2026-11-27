import { it, describe } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_AGENCY_IMPERSONATION, SIG_PERSONAL_INFO } from "../src/signals.js";

describe("민감정보 항목을 실제로 전달하라는 요구", () => {
  const hasRequest = text => extractCodeSignals(text).signals.includes(SIG_PERSONAL_INFO);
  for (const text of [
    "모의 서식 항목 / CVC 세 자리만 답장 요청",
    "모의 서식 항목 / 카드 유효기간을 문자로 전달해 주세요.",
    "모의 서식 항목 / 신분증 앞뒷면 사진 좀 전달 부탁",
    "모의 서식 항목 / 카드 뒤 보안코드를 알려 주면 돼.",
  ]) it(text, () => assert.ok(hasRequest(text)));

  for (const text of [
    "쿠폰 유효기간을 알려 주세요.",
    "카드 유효기간을 가린 사본만 답장해 주세요.",
    "CVC 세 자리를 알려 주지 마세요.",
    "교육 자료에서 ‘카드 유효기간을 답장해 주세요’라는 사례를 읽었습니다.",
    "CVC를 전달 요청한 기록은 파기했습니다.",
    "보안 교육에서 CVC를 알려 주세요 라고 쓰인 사례를 살펴봤습니다.",
    "모의 서식에 남아 있는 CVC 전달 요청 처리 기록을 삭제했습니다.",
    "카드 유효기간이 지났습니다. 만족도만 회신 바랍니다.",
  ]) it(text, () => assert.ok(!hasRequest(text)));

  it("확인된 기관 발신 표기와 민감정보 문자 회신 요구가 함께 있으면 기관 주장도 인식한다", () => {
    const signals = extractCodeSignals("[국민건강보험] 견본 서식 / CVC 세 자리를 문자로 회신 요청").signals;
    assert.ok(signals.includes(SIG_PERSONAL_INFO) && signals.includes(SIG_AGENCY_IMPERSONATION));
  });
  it("기관 발신 표기만 있거나 교육 안내에서 회신 금지를 알리면 기관 사칭으로 올리지 않는다", () => {
    for (const text of ["[국민건강보험] 만족도만 회신 바랍니다.", "[국민건강보험] 사칭 예방 교육. CVC를 회신하지 마세요."]) {
      assert.ok(!extractCodeSignals(text).signals.includes(SIG_AGENCY_IMPERSONATION));
    }
  });
});

describe("민감한 사진·도착하는 인증값의 전달", () => {
  const has = t => extractCodeSignals(t).signals.includes(SIG_PERSONAL_INFO);
  for (const text of [
    "모의 양식 / 카드 앞뒤 사진 좀 찍어 보내 주세요.",
    "모의 양식 / 카드 뒷면 사본을 찍어서 전달해 주세요.",
    "모의 양식 / 신용카드 앞뒤 사진 찍어서 전달해 주세요~",
    "모의 양식 / 일회용 코드가 도착하면 그 번호만 바로 알려 주세요.",
  ]) it(text, () => assert.ok(has(text)));
  for (const text of [
    "카드 앞뒤 사진은 기기에만 보관하세요.",
    "카드 뒷면 사진을 찍어 보내지 마세요.",
    "순번표가 도착하면 그 번호만 알려 주세요.",
    "일회용 코드가 도착하면 그 번호를 알려 주지 마세요.",
    "교육용 문구 ‘카드 앞뒤 사진 좀 찍어 보내 주세요’는 위험한 요구입니다.",
    "교육용 문구 ‘카드 앞뒤 사진 좀 찍어 보내 주세요~’는 위험한 요구입니다.",
  ]) it(text, () => assert.ok(!has(text)));
});
