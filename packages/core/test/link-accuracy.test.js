// 멘토링(2026-11-26) “의심 링크 판단의 정확성” 후속 3가지 (D48)
// ① 단축 URL: KISA 목록에 있던 단축 주소(서비스+경로)와 그대로 같으면 위험. 링크는 열지 않는다(D11)
// ② 단축 링크 전용 안내 문장(카카오·웹 같은 출처)
// ③ 기관 이름 + 공식 주소만: R6(위험)을 링크만으로 켜지 않는다. 다른 요구가 있으면 그대로 위험
// ④ ‘공식@가짜’ 주소 속임수: 전용 신호로 위험(R11)
// 테스트의 단축 주소는 모두 지어낸 것이다(실제 피싱 주소를 저장소에 남기지 않는다).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { shortUrlKey, createShortUrlMatcher } from "../src/short-urls.js";
import { summarizePhrases } from "../src/summarizer.js";
import { SHORT_URL_TEXT } from "../src/fixed-text.js";
import {
  SIG_MALICIOUS_URL, SIG_SHORT_URL, SIG_DECEPTIVE_URL, SIG_LOOKALIKE_DOMAIN,
  SIG_AGENCY_IMPERSONATION, SIG_LINK, SIG_OFFICIAL_LINK, SIG_PERSONAL_INFO, SIG_CALL_THIS_NUMBER, SIG_APP_INSTALL,
  AI_ALLOWED_SIGNALS, CODE_ONLY_SIGNALS,
} from "../src/signals.js";

const run = (text, opts) => {
  const s = extractCodeSignals(text, opts).signals;
  return { signals: s, ...decide({ signals_final: s, signals_code: s }) };
};

describe("① 단축 주소 키(접속 없이 글자만 정규화)", () => {
  it("스킴·www·끝의 / 와 문장부호, 물음표 뒤는 같은 키", () => {
    const k = shortUrlKey("han.gl/AbCd12");
    assert.match(k, /^[0-9a-f]{16}$/);
    for (const v of ["https://han.gl/AbCd12", "http://www.han.gl/AbCd12/", "HAN.GL/AbCd12.", "han.gl/AbCd12?x=1", "han.gl/AbCd12#a"]) {
      assert.equal(shortUrlKey(v), k, v);
    }
  });
  it("경로는 대소문자를 구분한다(단축 코드는 대소문자가 다르면 다른 주소)", () => {
    assert.notEqual(shortUrlKey("han.gl/abcd12"), shortUrlKey("han.gl/AbCd12"));
  });
  it("경로가 없거나 주소에 @가 있으면 키를 만들지 않는다", () => {
    assert.equal(shortUrlKey("han.gl"), null);
    assert.equal(shortUrlKey("https://han.gl/"), null);
    assert.equal(shortUrlKey("https://naver.com@han.gl/AbCd12"), null);
    assert.equal(shortUrlKey(""), null);
  });
  it("목록에 있는 단축 주소만 맞는다", () => {
    const match = createShortUrlMatcher(new Set([shortUrlKey("han.gl/AbCd12")]));
    assert.equal(match(["https://han.gl/AbCd12"]), true);
    assert.equal(match(["han.gl/AbCd13"]), false);
    assert.equal(match([]), false);
  });
});

describe("① 단축 주소 목록 일치 → 위험(R10)", () => {
  const keys = new Set([shortUrlKey("han.gl/AbCd12")]);
  it("목록의 단축 주소면 KISA 목록 신호 + 위험", () => {
    const r = run("택배 주소 확인 han.gl/AbCd12", { shortUrlKeys: keys });
    assert.ok(r.signals.includes(SIG_MALICIOUS_URL));
    assert.ok(r.signals.includes(SIG_SHORT_URL));
    assert.equal(r.level, "위험");
    assert.ok(r.fired_rules.includes("R10"));
  });
  it("목록에 없는 단축 주소는 지금처럼 주의", () => {
    const r = run("택배 주소 확인 han.gl/ZzZz99", { shortUrlKeys: keys });
    assert.ok(!r.signals.includes(SIG_MALICIOUS_URL));
    assert.equal(r.level, "주의");
  });
  it("저장소 목록 파일이 없어도 동작한다(빈 목록)", () => {
    const r = run("택배 주소 확인 han.gl/AbCd12", { shortUrlKeys: new Set() });
    assert.equal(r.level, "주의");
  });
});

describe("② 단축 링크 전용 안내", () => {
  it("누르지 말고 직접 확인하라는 정해 둔 문장", () => {
    assert.match(SHORT_URL_TEXT, /단축 링크/);
    assert.match(SHORT_URL_TEXT, /누르지 마세요/);
    assert.match(SHORT_URL_TEXT, /직접 찾은/);
  });
});

describe("③ 기관 이름 + 공식 주소만 있는 안내", () => {
  it("[국세청] + hometax.go.kr 만 → 위험이 아니다", () => {
    const r = run("[국세청] 종합소득세 신고 기간입니다. 홈택스(www.hometax.go.kr)에서 신고하세요.");
    assert.ok(r.signals.includes(SIG_OFFICIAL_LINK));
    assert.ok(r.signals.includes(SIG_AGENCY_IMPERSONATION)); // 고치기 전에는 이 조합으로 R6 위험이었다
    assert.ok(!r.fired_rules.includes("R6"));
    assert.notEqual(r.level, "위험");
  });
  it("공식 주소여도 기관 + 개인정보·전화 유도·앱 설치 요구가 있으면 그대로 위험", () => {
    const base = [SIG_AGENCY_IMPERSONATION, SIG_LINK, SIG_OFFICIAL_LINK];
    for (const extra of [SIG_PERSONAL_INFO, SIG_CALL_THIS_NUMBER, SIG_APP_INSTALL]) {
      const s = [...base, extra];
      const r = decide({ signals_final: s, signals_code: s });
      assert.equal(r.level, "위험", extra);
      assert.ok(r.fired_rules.includes("R6"), extra);
    }
  });
  it("공식 주소가 아닌 링크가 섞이면 기관 + 링크로 위험", () => {
    const r = run("[국세청] 환급 안내 www.hometax.go.kr 또는 tax-refund.invalid/a");
    assert.ok(!r.signals.includes(SIG_OFFICIAL_LINK));
    assert.equal(r.level, "위험");
  });
  it("공식 링크 표시는 코드 신호만 인정(AI가 붙여도 R6 예외가 되지 않음)", () => {
    const r = decide({
      signals_final: [SIG_AGENCY_IMPERSONATION, SIG_LINK, SIG_OFFICIAL_LINK],
      signals_code: [SIG_LINK],
    });
    assert.equal(r.level, "위험");
  });
});

describe("④ ‘공식@가짜’ 주소 속임수", () => {
  for (const text of [
    "결제 확인 https://naver.com@pay-check.invalid/login",
    "본인 확인 http://www.kbstar.com@kb-safe.invalid",
    "주소 www.naver.com@evil.invalid/a 확인",
  ]) {
    it(`${text} → 위험(R11)`, () => {
      const r = run(text);
      assert.ok(r.signals.includes(SIG_DECEPTIVE_URL), String(r.signals));
      assert.equal(r.level, "위험");
      assert.ok(r.fired_rules.includes("R11"));
    });
  }
  it("이메일 주소는 속임수로 보지 않는다", () => {
    const r = run("문의는 help@example.com 으로 보내 주세요");
    assert.ok(!r.signals.includes(SIG_DECEPTIVE_URL));
  });
  it("평범한 링크는 속임수가 아니다", () => {
    assert.ok(!run("https://www.hometax.go.kr/login?id=1").signals.includes(SIG_DECEPTIVE_URL));
    assert.ok(!run("https://evil.invalid/a@b").signals.includes(SIG_DECEPTIVE_URL));
  });
  it("코드 전용 신호이고 요약 문구가 있다", () => {
    assert.ok(CODE_ONLY_SIGNALS.has(SIG_DECEPTIVE_URL));
    assert.ok(!AI_ALLOWED_SIGNALS.has(SIG_DECEPTIVE_URL));
    assert.deepEqual(summarizePhrases([SIG_DECEPTIVE_URL]), ["공식 주소처럼 꾸민 가짜 링크"]);
    assert.notEqual(SIG_DECEPTIVE_URL, SIG_LOOKALIKE_DOMAIN);
  });
});

describe("⑤ 공식 주소만 있는 문자: R7은 코드가 찾은 재촉·돈·비밀만 본다(D49)", () => {
  const base = [SIG_AGENCY_IMPERSONATION, SIG_LINK, SIG_OFFICIAL_LINK];
  it("AI만 재촉·돈·비밀을 붙이면 확인 필요 그대로(카카오 2026-11-26 국세청 안내)", () => {
    for (const ai of ["SIG_URGENCY", "SIG_MONEY", "SIG_SECRECY"]) {
      const r = decide({ signals_final: [...base, ai], signals_code: base });
      assert.equal(r.level, "확인필요", ai);
    }
  });
  it("코드가 직접 찾은 재촉·돈 요구면 주의", () => {
    for (const code of ["SIG_URGENCY", "SIG_MONEY"]) {
      const s = [...base, code];
      assert.equal(decide({ signals_final: s, signals_code: s }).level, "주의", code);
    }
  });
  // D57(2026-11-28): 공식 주소만 있으면 R6의 행동 신호는 코드가 찾은 것만 본다. AI만 붙인 개인정보 요구는 주의
  it("AI만 붙인 개인정보 요구는 주의(D57), 코드가 찾으면 위험", () => {
    assert.equal(decide({ signals_final: [...base, SIG_PERSONAL_INFO], signals_code: base }).level, "주의");
    const code = [...base, SIG_PERSONAL_INFO];
    assert.equal(decide({ signals_final: code, signals_code: code }).level, "위험");
  });
  it("AI의 선입금·개인 계좌 요구는 그대로 위험(R9)", () => {
    for (const ai of ["SIG_PREPAYMENT", "SIG_THIRD_PARTY_ACCOUNT"]) {
      assert.equal(decide({ signals_final: [...base, ai], signals_code: base }).level, "위험", ai);
    }
  });
  it("공식 주소가 아닌 링크면 AI 재촉으로도 지금처럼 주의", () => {
    const code = [SIG_LINK];
    assert.equal(decide({ signals_final: [...code, "SIG_URGENCY"], signals_code: code }).level, "주의");
    assert.equal(decide({ signals_final: ["SIG_URGENCY"], signals_code: [] }).level, "주의");
  });
});

describe("⑥ 공식 주소 링크 안내 문장", () => {
  it("‘공식 주소로 보이는 링크’라고 쓰고 안전하다고 하지 않는다", async () => {
    const { OFFICIAL_LINK_TEXT } = await import("../src/fixed-text.js");
    assert.match(OFFICIAL_LINK_TEXT, /공식 주소로 보이는 링크/);
    assert.doesNotMatch(OFFICIAL_LINK_TEXT, /안전|이상 없/);
  });
});

describe("⑦ 스킴 없는 ‘공식@가짜’(Codex 요청서 1번)", () => {
  for (const text of [
    "결제 확인 naver.com@pay-check.xyz/login",
    "결제 확인 hometax.go.kr@tax-refund.invalid",
    "확인 kbstar.com@kb-safe.invalid/a?b=1 바로",
  ]) {
    it(`${text} → 공식 링크 아님, 속임수 위험`, () => {
      const r = run(text);
      assert.ok(!r.signals.includes(SIG_OFFICIAL_LINK), String(r.signals));
      assert.ok(r.signals.includes(SIG_DECEPTIVE_URL), String(r.signals));
      assert.equal(r.level, "위험");
    });
  }
  it("평범한 이메일은 링크·속임수가 아니다", () => {
    for (const text of ["문의 help@example.com", "메일 john.doe@gmail.com 으로", "kim@naver.com 으로 보내 주세요"]) {
      const r = run(text);
      assert.ok(!r.signals.includes(SIG_DECEPTIVE_URL), text);
      assert.ok(!r.signals.includes(SIG_LINK), text);
    }
  });
  it("가짜 쪽 도메인은 평판 조회 대상에 들어간다", () => {
    assert.deepEqual(extractCodeSignals("결제 확인 naver.com@pay-check.xyz/login").domains, ["pay-check.xyz"]);
  });
});
