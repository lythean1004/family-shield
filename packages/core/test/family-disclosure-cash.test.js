import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../src/rule-engine.js";
import { analyze } from "../src/pipeline.js";
import { AI_ALLOWED_SIGNALS, codeOnlyFrom } from "../src/signals.js";

const family = "SIG_FAMILY_IMPERSONATION";
const changed = "SIG_NEW_NUMBER";
const privateInfo = "SIG_PERSONAL_INFO";
const install = "SIG_APP_INSTALL";
const handover = "SIG_CASH_HANDOVER";
const level = signals => decide({ signals_final: signals, signals_code: signals });

describe("D51 가족 주장과 새 연락 수단에서 민감정보·설치 요구", () => {
  for (const request of [[privateInfo], [install], [privateInfo, install]]) {
    it(request.join(" + "), () => {
      const r = level([family, changed, ...request]);
      assert.equal(r.level, "위험");
      assert.ok(r.fired_rules.includes("R14"));
    });
  }
  for (const sig of [[family, changed], [changed, privateInfo], [family, install], [privateInfo]]) {
    it(sig.join(" + "), () => assert.notEqual(level(sig).level, "위험"));
  }
  it("기기 교체 안내와 공식 앱 소개를 구분한다", async () => {
    const r = await analyze({ text: "어머니, 제 새 번호로 연락드려요. 달력 앱 소개 책자를 읽었어요." });
    assert.notEqual(r.level, "위험");
  });
  for (const notice of [
    "신분증 사진을 찍어 보내지 마세요.",
    "사칭 예방 교육에서 ‘카드번호를 알려 주세요’라는 사례를 읽었어요.",
    "사칭 예방 안내예요. 앱을 깔아 주지 마세요.",
  ]) it(notice, async () => {
    const r = await analyze({ text: `어머니, 제 새 번호로 연락드려요. ${notice}` });
    assert.ok(!r.fired_rules.includes("R14"));
  });
});

describe("D52 수사기관 발신 주장과 현금 대면 전달", () => {
  const role = "[경찰청] 모의 서식의 문법 항목 / ";
  for (const phrase of [
    "현금을 대리인에게 건네 주세요.",
    "현찰을 지정된 장소에 두세요.",
    "현금은 담당 직원이 직접 받으러 갑니다.",
  ]) it(phrase, async () => {
    const r = await analyze({ text: role + phrase });
    assert.equal(r.level, "위험");
    assert.ok(r.signals_code.includes(handover));
    assert.ok(r.fired_rules.includes("R15"));
    assert.match(r.summary, /현금/);
  });
  for (const text of [
    role + "현금 인출 내역입니다.",
    role + "분실물로 접수된 현금을 주인에게 돌려주었습니다.",
    role + "현금을 직원에게 건네지 마세요.",
    role + "‘현금을 대리인에게 건네 주세요’라는 문구는 사칭 사례입니다.",
    "[동네극단] 현금을 담당 직원에게 건네 주세요.",
    "[세무서] 창구에서 납부한 현금 영수증을 보관하세요.",
  ]) it(text, async () => assert.ok(!(await analyze({ text })).signals_final.includes(handover)));
  it("기존 영수증 처리에서 코드 전용 출처를 보존한다", () => {
    assert.deepEqual(codeOnlyFrom([handover]), [handover]);
    assert.ok(!AI_ALLOWED_SIGNALS.has(handover));
  });
});
