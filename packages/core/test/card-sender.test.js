import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_AGENCY_IMPERSONATION } from "../src/signals.js";

describe("근거 카드의 발신자 표기와 외부 주소", () => {
  const link = "https://catalog.invalid/spring";
  for (const title of [
    "[Web발신]\n[현대카드] 행사 주소 변경 신청서",
    "전북은행입니다. 주소 정정 양식",
    "CJ대한통운 배송 안내. 수령지 수정 접수",
    "[정부24] 주소 변경 신청서",
  ]) it(title, () => {
    const { signals } = extractCodeSignals(`${title} ${link}`);
    assert.ok(signals.includes(SIG_AGENCY_IMPERSONATION));
    assert.ok(decide({ signals_final: signals, signals_code: signals }).fired_rules.includes("R6"));
  });

  for (const text of [
    `자료실에서 전북은행 사례를 소개했습니다. ${link}`,
    `[동네 독서회] 전시 목록 ${link}`,
    `[현대카드] 사칭 문자 예방 교육입니다. 접속하지 마세요. 예시 ${link}`,
    "[전북은행] 고객 설명회는 목요일입니다.",
    `[현대카드동호회] 이번 달 전시 목록 ${link}`,
    `[Web발신]\n[현대카드] 전시 일정 ${link}`,
    `전북은행입니다. 자료 목록 ${link}`,
    `CJ대한통운 배송 안내. 물건 조회 ${link}`,
    `[정부24] 주소 변경 완료 내역 ${link}`,
    `[전북은행] 주소를 수정하지 마세요. 교육자료 ${link}`,
    `[전북은행] 문자로 주소 변경 신청하지 마세요. 안내 자료 ${link}`,
    `[현대카드] 외부 주소에서 주소 수정 요청은 사칭일 수 있습니다. 안내 자료 ${link}`,
  ]) it(text, () => assert.ok(!extractCodeSignals(text).signals.includes(SIG_AGENCY_IMPERSONATION)));
});
