import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rdapUrlFor, createDomainAgeChecker, lookupTargets } from "../src/domain-age.js";
import { analyze } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";

const BOOT = { services: [[["shop", "top"], ["https://rdap.example-registry.test/rdap/"]], [["kr"], ["https://rdap.nic.or.kr/"]]] };
const NOW = Date.parse("2026-11-11T00:00:00Z");
const DAY = 86400000;

/** 가짜 RDAP: 도메인 → 등록일(또는 404) */
function fakeRdap(table, calls = []) {
  return async (url) => {
    calls.push(url);
    const d = decodeURIComponent(url.split("/domain/")[1]);
    if (!(d in table)) return { ok: false, status: 404, json: async () => ({}) };
    const v = table[d];
    if (v === "slow") return new Promise(() => {});
    return { ok: true, status: 200, json: async () => ({ events: [{ eventAction: "registration", eventDate: v }] }) };
  };
}

describe("조회 주소 (IANA 안내 파일)", () => {
  it("끝부분에 맞는 RDAP 주소를 만든다", () => {
    assert.equal(rdapUrlFor("evil.shop", BOOT), "https://rdap.example-registry.test/rdap/domain/evil.shop");
    assert.equal(rdapUrlFor("naver.kr", BOOT), "https://rdap.nic.or.kr/domain/naver.kr");
  });
  it("안내 파일에 없는 끝부분은 묻지 않는다", () => {
    assert.equal(rdapUrlFor("evil.cn", BOOT), null);
  });
});

describe("묻는 대상 고르기 (D41)", () => {
  it("등록 도메인만, 중복 없이, 최대 2개", () => {
    assert.deepEqual(lookupTargets(["a.evil.shop", "b.evil.shop", "x.top", "y.top", "z.shop"]), ["evil.shop", "x.top"]);
  });
  it("공용·공공기관·근거 카드 공식·우리 도메인은 묻지 않는다", () => {
    assert.deepEqual(lookupTargets(["naver.com", "x.go.kr", "service.epost.go.kr", "cjlogistics.com",
      "familyshield.kr", "www.familyshield.kr", "github.io"]), []);
  });
});

describe("도메인 생성일 확인기", () => {
  it("30일 이내 등록이면 young 에 넣는다. 바깥으로는 등록 도메인 이름만 간다", async () => {
    const calls = [];
    const check = createDomainAgeChecker({
      bootstrap: BOOT, clock: () => NOW,
      fetchImpl: fakeRdap({ "evil.shop": "2026-11-01T00:00:00Z", "old.top": "2015-01-01T00:00:00Z" }, calls),
    });
    const r = await check(["login.evil.shop", "old.top"]);
    assert.deepEqual(r, { ok: true, young: ["login.evil.shop"] });
    assert.deepEqual(calls, ["https://rdap.example-registry.test/rdap/domain/evil.shop", "https://rdap.example-registry.test/rdap/domain/old.top"]);
  });

  it("기준 일수는 설정으로 바꿀 수 있다", async () => {
    const check = createDomainAgeChecker({ bootstrap: BOOT, clock: () => NOW, thresholdDays: 7,
      fetchImpl: fakeRdap({ "evil.shop": "2026-11-01T00:00:00Z" }) });
    assert.deepEqual((await check(["evil.shop"])).young, []);
  });

  it("등록 정보가 없거나(404) 등록일이 없으면 새 도메인으로 보지 않는다", async () => {
    const check = createDomainAgeChecker({ bootstrap: BOOT, clock: () => NOW, fetchImpl: fakeRdap({}) });
    assert.deepEqual(await check(["gone.shop"]), { ok: true, young: [] });
  });

  it("시간 초과면 ok=false, 신호 없음(판정을 낮추지 않음)", async () => {
    const check = createDomainAgeChecker({ bootstrap: BOOT, clock: () => NOW, timeoutMs: 20,
      fetchImpl: fakeRdap({ "evil.shop": "slow" }) });
    const r = await check(["evil.shop"]);
    assert.equal(r.ok, false);
    assert.deepEqual(r.young, []);
    assert.equal(r.reason, "timeout");
  });

  it("같은 등록 도메인은 24시간 동안 다시 묻지 않는다", async () => {
    const calls = [];
    let now = NOW;
    const check = createDomainAgeChecker({ bootstrap: BOOT, clock: () => now,
      fetchImpl: fakeRdap({ "evil.shop": "2026-11-01T00:00:00Z" }, calls) });
    await check(["a.evil.shop"]);
    await check(["b.evil.shop"]);
    assert.equal(calls.length, 1);
    now += DAY + 1;
    await check(["evil.shop"]);
    assert.equal(calls.length, 2);
  });

  it("묻을 대상이 없으면 조회하지 않는다", async () => {
    const calls = [];
    const check = createDomainAgeChecker({ bootstrap: BOOT, clock: () => NOW, fetchImpl: fakeRdap({}, calls) });
    assert.deepEqual(await check(["naver.com"]), { ok: true, young: [] });
    assert.equal(calls.length, 0);
  });
});

describe("R12와 파이프라인", () => {
  it("R12: 새 도메인 + 개인정보 요구 → 위험", () => {
    const r = decide({ signals_final: ["SIG_LINK", "SIG_NEW_DOMAIN", "SIG_PERSONAL_INFO"] });
    assert.equal(r.level, "위험");
    assert.ok(r.fired_rules.includes("R12"));
  });

  it("새 도메인만으로는 위험이 아니다(링크로 주의)", () => {
    assert.equal(decide({ signals_final: ["SIG_LINK", "SIG_NEW_DOMAIN"] }).level, "주의");
  });

  it("새 도메인 + 재촉은 위험으로 올리지 않는다(정상 광고와 겹침)", () => {
    assert.equal(decide({ signals_final: ["SIG_LINK", "SIG_NEW_DOMAIN", "SIG_URGENCY"] }).level, "주의");
  });

  it("파이프라인: 조회기가 young 을 주면 SIG_NEW_DOMAIN, 결과에는 도메인 이름 없이 건수만", async () => {
    const r = await analyze({
      text: "본인 확인을 위해 주민등록번호를 입력하세요 http://evil.shop/a",
      domainAge: async () => ({ ok: true, young: ["evil.shop"] }),
    });
    assert.ok(r.signals_code.includes("SIG_NEW_DOMAIN"));
    assert.deepEqual(r.domain_age, { ok: true, young: 1, reason: null });
    assert.ok(!JSON.stringify(r.domain_age).includes("evil"));
  });

  it("파이프라인: 조회기 오류는 신호를 켜지 않고 판정을 낮추지 않는다", async () => {
    const r = await analyze({ text: "택배 확인 http://evil.shop/a", domainAge: async () => { throw new Error("down"); } });
    assert.ok(!r.signals_code.includes("SIG_NEW_DOMAIN"));
    assert.equal(r.level, "주의");
    assert.equal(r.domain_age.ok, false);
  });
});
