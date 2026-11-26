// 멘토링(2026-11-26): naver.com 같은 정상 링크만 있어도 '주의'가 나온다.
// 링크가 모두 확인된 공식 주소이고 다른 신호가 없으면 링크만으로는 주의를 내지 않는다('확인 필요' 유지).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOfficialLink, allLinksOfficial } from "../src/official-links.js";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_LINK, SIG_OFFICIAL_LINK, AI_ALLOWED_SIGNALS } from "../src/signals.js";
import { officialLinkReviewCases } from "./fixtures/official-link-review.js";

const level = (text) => {
  const s = extractCodeSignals(text).signals;
  return decide({ signals_final: s, signals_code: s }).level;
};

describe("공식 주소 링크 판단", () => {
  for (const link of [
    "https://www.kakaocorp.com",              // 확인된 포털 대표 주소(정확한 호스트)
    "kakao.com",
    "https://www.cjlogistics.com/ko/tool/parcel/tracking", // 근거 카드 회사 도메인의 하위 주소
    "https://www.hometax.go.kr",
    "https://www.gov.kr/portal/main",
  ]) it(`공식: ${link}`, () => assert.equal(isOfficialLink(link), true));

  for (const link of [
    "https://open.kakao.com/o/abc",           // 오픈채팅: 누구나 만든다
    "https://pf.kakao.com/_abc",
    "https://blog.naver.com/someone",         // 포털 하위 주소(누구나 글을 올림)
    "https://docs.google.com/forms/d/x",
    "https://t.me/somechannel",               // 텔레그램은 근거 카드가 있어도 누구나 채널을 만든다
    "https://www.daangn.com/articles/1",
    "https://cjlogistics.com.evil.invalid",   // 공식 이름을 앞에 붙인 가짜
    "https://www.kakaocorp.com@evil.invalid/", // 사용자 정보 칸 속임수(실제 호스트는 evil.invalid)
    "https://www.gov.kr/redirect?url=https://evil.invalid", // 주소 안에 다른 주소(넘겨주기)
    "https://www.cjlogistics.com/go?to=evil.invalid%2Flogin",
    "https://bit.ly/abc",
  ]) it(`공식 아님: ${link}`, () => assert.equal(isOfficialLink(link), false));

  it("포털 첫 화면은 공식, 하위 주소는 아님(멘토 예시 naver.com)", () => {
    for (const l of ["naver.com", "https://www.naver.com", "https://m.naver.com", "daum.net", "https://www.google.com"]) assert.equal(isOfficialLink(l), true, l);
    for (const l of ["https://cafe.naver.com/x", "https://form.naver.com/x", "https://blog.daum.net/x", "https://sites.google.com/x"]) assert.equal(isOfficialLink(l), false, l);
  });
  it("멘토 예시: naver.com만 있는 문자는 확인 필요", () => {
    assert.equal(level("네이버 naver.com 에서 확인하세요"), "확인필요");
  });

  it("링크가 하나라도 공식이 아니면 전체를 공식으로 보지 않는다", () => {
    assert.equal(allLinksOfficial(["https://www.kakaocorp.com", "https://evil.invalid"]), false);
    assert.equal(allLinksOfficial([]), false);
  });

  it("AI는 공식 링크 신호를 낼 수 없다(코드 전용)", () => {
    assert.equal(AI_ALLOWED_SIGNALS.has(SIG_OFFICIAL_LINK), false);
  });
});

describe("은행 카드의 대표 주소 범위", () => {
  const hosts = [
    "www.kbanknow.com", "www.standardchartered.co.kr", "www.citibank.co.kr", "www.busanbank.co.kr",
    "www.knbank.co.kr", "www.kjbank.com", "www.jbbank.co.kr", "www.suhyup-bank.com",
  ];

  for (const host of hosts) {
    it(`${host} 단독 안내는 확인 필요이고, 카드에 없는 호스트는 공식으로 인정하지 않는다`, () => {
      const announcement = `홈페이지 안내 https://${host}/`;
      assert.ok(extractCodeSignals(announcement).signals.includes(SIG_OFFICIAL_LINK));
      assert.equal(level(announcement), "확인필요");

      const domain = host.slice("www.".length);
      assert.equal(isOfficialLink(`https://${domain}/`), false);
      assert.equal(isOfficialLink(`https://m.${domain}/`), false);
    });
  }

  it("은행 주소와 미등록 주소를 함께 안내하면 주의이며, 은행 주소만 있어도 통화 직후에는 위험이다", () => {
    const link = `https://${hosts[0]}/`;
    const mixed = `자료 목록 ${link} https://sample.invalid/guide`;
    assert.ok(!extractCodeSignals(mixed).signals.includes(SIG_OFFICIAL_LINK));
    assert.equal(level(mixed), "주의");

    const signals = extractCodeSignals(link).signals;
    const result = decide({ signals_final: signals, signals_code: signals, called_before: true });
    assert.equal(result.level, "위험");
    assert.ok(result.fired_rules.includes("R2"));
  });
});

describe("판정: 공식 주소 링크만 있으면 '확인 필요'", () => {
  it("공식 택배 조회 링크만 있는 안내 문자", () => {
    const s = extractCodeSignals("[CJ대한통운] 배송 조회 https://www.cjlogistics.com/ko/tool/parcel/tracking").signals;
    assert.ok(s.includes(SIG_LINK) && s.includes(SIG_OFFICIAL_LINK));
    assert.equal(decide({ signals_final: s, signals_code: s }).level, "확인필요");
  });
  it("공식 주소라도 송금 요구가 있으면 그대로 주의 이상", () => {
    assert.notEqual(level("www.kakaocorp.com 확인하고 오늘 50만원 입금해 주세요"), "확인필요");
  });
  it("공식 주소와 모르는 주소가 섞이면 주의", () => {
    assert.equal(level("https://www.kakaocorp.com 또는 https://evil.invalid 접속"), "주의");
  });
  it("모르는 주소만 있으면 지금처럼 주의", () => {
    assert.equal(level("확인 https://evil.invalid/a"), "주의");
  });
  it("기관 사칭 + 공식 주소 링크만으로는 R6를 켜지 않는다(D48, 전에는 위험)", () => {
    const s = [SIG_LINK, SIG_OFFICIAL_LINK, "SIG_AGENCY_IMPERSONATION"];
    assert.equal(decide({ signals_final: s, signals_code: s }).level, "확인필요");
  });
  it("전화 받은 뒤 공식 주소 링크도 R2(위험) 그대로", () => {
    const s = [SIG_LINK, SIG_OFFICIAL_LINK];
    assert.equal(decide({ signals_final: s, signals_code: s, called_before: true }).level, "위험");
  });
  it("AI가 공식 링크 신호를 끼워 넣어도(코드 신호에 없으면) 주의 유지", () => {
    const code = [SIG_LINK];
    assert.equal(decide({ signals_final: [...code, SIG_OFFICIAL_LINK], signals_code: code }).level, "주의");
  });
});

describe("저장된 기록(영수증)으로 다시 판정할 때", () => {
  it("코드 전용 신호만 되살리고 공용 신호는 넣지 않는다", async () => {
    const { codeOnlyFrom } = await import("../src/signals.js");
    assert.deepEqual(codeOnlyFrom([SIG_LINK, SIG_OFFICIAL_LINK, "SIG_URGENCY"]), [SIG_LINK, SIG_OFFICIAL_LINK]);
    assert.deepEqual(codeOnlyFrom(undefined), []);
  });
  it("공식 링크만 있던 기록은 가족 확인 단계에서 주의로 올라가지 않는다", async () => {
    const { codeOnlyFrom } = await import("../src/signals.js");
    const final = [SIG_LINK, SIG_OFFICIAL_LINK];
    assert.equal(decide({ signals_final: final, signals_code: codeOnlyFrom(final) }).level, "확인필요");
  });
});

describe("공식 주소 안내의 입력 완결성 (독립 검토)", () => {
  const normal = "https://www.gov.kr/portal/main";

  it("파서가 전체 후보 확인을 끝내지 못한 상태면 공식 주소 안내를 보류한다", () => {
    // 공격 주소를 구성하지 않고 파서의 불완전 상태만 전달한다.
    assert.equal(allLinksOfficial([normal], { complete: false }), false);
    assert.equal(allLinksOfficial([normal, normal], { complete: false }), false);
    assert.equal(allLinksOfficial([normal], { complete: true }), true);
  });

  it("입력이 잘린 상태면 인식된 정상 링크만으로 공식 예외를 켜지 않는다", () => {
    const s = extractCodeSignals(`공지 ${normal}`, { inputComplete: false }).signals;
    assert.ok(s.includes(SIG_LINK));
    assert.ok(!s.includes(SIG_OFFICIAL_LINK));
    assert.equal(decide({ signals_final: s, signals_code: s }).level, "주의");
  });

  it("정상 공식 주소 한 개·반복·일반 이메일의 조합은 기존 안내를 유지한다", () => {
    for (const text of [normal, `${normal} ${normal}`, `문의 help@example.com, john.doe@example.org ${normal}`]) {
      const s = extractCodeSignals(text).signals;
      assert.ok(s.includes(SIG_OFFICIAL_LINK), text);
      assert.equal(decide({ signals_final: s, signals_code: s }).level, "확인필요", text);
    }
  });

  it("공식 주소와 미등록 합성 주소의 혼합은 공식 예외 없이 주의다", () => {
    const s = extractCodeSignals(`${normal} https://sample.invalid/guide`).signals;
    assert.ok(!s.includes(SIG_OFFICIAL_LINK));
    assert.equal(decide({ signals_final: s, signals_code: s }).level, "주의");
  });

  it("파이프라인의 길이 제한도 완결성 상태로 전달한다", async () => {
    const { analyze, MAX_INPUT_CHARS } = await import("../src/pipeline.js");
    const r = await analyze({ text: `${normal} ${"안내 ".repeat(MAX_INPUT_CHARS)}` });
    assert.equal(r.truncated, true);
    assert.ok(!r.signals_code.includes(SIG_OFFICIAL_LINK));
    assert.equal(r.level, "주의");
  });
});

describe("공식 주소 안내 교차 사례 — 코드 파이프라인", () => {
  for (const c of officialLinkReviewCases) it(c.name, async () => {
    const { analyze } = await import("../src/pipeline.js");
    const r = await analyze({ text: c.text, parentInputs: c.parentInputs });
    assert.equal(r.level, c.level);
    assert.equal(r.level === "확인필요" && r.signals_final.includes(SIG_OFFICIAL_LINK), c.notice);
  });
});
