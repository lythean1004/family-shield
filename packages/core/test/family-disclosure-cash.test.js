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

describe("수사·감독 관계자를 자처한 사람이 수신자의 현금을 방문 인수하는 경우", () => {
  for (const text of [
    "수사 담당자라고 적힌 쪽지에 제 현금을 방문 직원에게 건네는 게 필수라고 써 있어요.",
    "감독기관 소속이라고 소개한 발신자가 집에 온대요. 저한테서 현금을 받아 간다는 절차예요.",
    "수사관이 보냈다는 답장에 현찰을 방문자에게 직접 인계하는 것이 제 역할이라고 적혀 있어요.",
  ]) it(text, async () => {
    const result = await analyze({ text, ai: null });
    assert.ok(result.signals_code.includes(handover));
    assert.ok(result.fired_rules.includes("R15"));
  });
  for (const text of [
    "수사관이 보냈다는 안내였는데, 분실한 현금을 주인에게 돌려주는 절차였어요.",
    "수사 담당자라고 적힌 쪽지를 설명한 예방 교육이에요. 현금을 방문 직원에게 건네는 게 필수라는 사례예요.",
    "감독기관 소속이라며 방문했지만 제게서 현금을 받아 가는 일이 아니었어요.",
    "수사관이 보낸 설문지를 받았어요. 따로 상점 직원이 물건값을 집에 받으러 왔어요.",
    "수사관이 보냈다는 안내는 민원인이 창구에서 보관하던 현금을 돌려받는 절차예요.",
    "여론 조사기관 소속이라고 소개한 방문자예요. 저한테서 현금을 받아 갈 절차라고 적은 연극 대본을 읽었어요.",
  ]) it(text, async () => assert.ok(!(await analyze({ text, ai: null })).fired_rules.includes("R15")));
});

describe("D55 대출 상환금을 회사 직원이 방문해 현금으로 수거한다는 통지", () => {
  const pickup = "SIG_LOAN_CASH_PICKUP";
  for (const text of [
    "훈련 서식 / 대출 상환금 / 현금으로 준비하면 저희 회사 직원이 댁으로 방문 수령합니다.",
    "모의 대출금 상환표. 당행 직원이 집으로 방문해 현금을 수거합니다.",
    "분류표 / 대출 상환금은 현금으로 우리 은행 직원이 직접 받으러 갑니다.",
  ]) it(text, async () => {
    const r = await analyze({ text });
    assert.ok(r.level === "위험" && r.signals_code.includes(pickup) && r.fired_rules.includes("R18"));
    assert.match(r.summary, /대출.*현금/);
  });
  for (const text of [
    "대출 상환 안내. 본인이 영업점에 방문해 창구에서 현금으로 납부할 수 있습니다.",
    "대출 상환 상담으로 당행 직원이 방문합니다. 현금영수증 발급 방법은 별도 안내입니다.",
    "대출 사기 예방 교육 / ‘당행 직원이 집으로 방문해 현금을 수거합니다’라는 문구에 주의하세요.",
    "대출 상환금을 저희 은행 직원이 방문해서 현금으로 받지 않습니다.",
    "물품 배달 영수증 / 저희 회사 직원이 방문해 현금으로 받았습니다.",
  ]) it(text, async () => assert.ok(!(await analyze({ text })).fired_rules.includes("R18")));
  it("영수증에는 AI와 구분되는 현금 방문 수거 근거가 남는다", () => {
    assert.deepEqual(codeOnlyFrom([pickup]), [pickup]);
    assert.ok(!AI_ALLOWED_SIGNALS.has(pickup));
  });
});

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
