import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHost, hostKey, candidateHosts, isSharedHost, registrableDomain, buildKeys, parseKeyFile,
  createPhishingListChecker, combineCheckers, loadPhishingListChecker,
} from "../src/phishing-list.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("호스트 정규화 (D40 ①)", () => {
  it("소문자, 끝 점, 앞의 www. 를 정리한다", () => {
    assert.equal(normalizeHost("WWW.Evil-Delivery.XYZ."), "evil-delivery.xyz");
  });

  it("호스트 모양이 아니면 빈 문자열", () => {
    assert.equal(normalizeHost(""), "");
    assert.equal(normalizeHost("not a host"), "");
    assert.equal(normalizeHost("localhost"), "");
  });

  it("키는 정규화한 호스트의 SHA-256 앞 16자리(소문자 16진수)", () => {
    const k = hostKey("www.Evil-Delivery.xyz");
    assert.match(k, /^[0-9a-f]{16}$/);
    assert.equal(k, hostKey("evil-delivery.xyz"));
    assert.notEqual(k, hostKey("evil-delivery2.xyz"));
  });
});

describe("대조할 후보 호스트", () => {
  it("호스트 자신과 상위 도메인(라벨 2개 이상)", () => {
    assert.deepEqual(candidateHosts("a.b.evil.xyz"), ["a.b.evil.xyz", "b.evil.xyz", "evil.xyz"]);
  });

  it("co.kr 같은 2단계 국가 도메인 자체는 후보가 아니다", () => {
    assert.deepEqual(candidateHosts("login.evil.co.kr"), ["login.evil.co.kr", "evil.co.kr"]);
  });

  it("잘못된 값은 빈 목록", () => {
    assert.deepEqual(candidateHosts("??"), []);
  });
});

describe("등록 도메인", () => {
  it("일반 도메인은 마지막 2단계, 2단계 국가 도메인은 3단계", () => {
    assert.equal(registrableDomain("a.b.evil.xyz"), "evil.xyz");
    assert.equal(registrableDomain("login.evil.co.kr"), "evil.co.kr");
    assert.equal(registrableDomain("evil.kr"), "evil.kr");
  });
});

describe("공용 도메인 제외 (정상 사이트 오탐 방지)", () => {
  it("단축 URL·공용 호스팅·대형 포털 자체는 공용으로 본다", () => {
    for (const h of ["bit.ly", "naver.me", "github.io", "blogspot.com", "naver.com", "google.com", "kro.kr", "p-e.kr"]) {
      assert.equal(isSharedHost(h), true, h);
    }
  });

  it("대형 포털은 하위 주소까지 공용(카카오 채널 등)", () => {
    for (const h of ["pf.kakao.com", "open.kakao.com", "blog.naver.com", "m.cafe.daum.net"]) {
      assert.equal(isSharedHost(h), true, h);
    }
  });

  it("공공·교육기관 도메인(go.kr, ac.kr 등)은 목록에 넣지 않는다(KISA 원본에 기관 주소가 섞여 있음)", () => {
    for (const h of ["www.efine.go.kr", "lms.univ.ac.kr"]) {
      assert.equal(isSharedHost(h), true, h);
    }
    const { keys } = buildKeys(["a.efine.go.kr", "b.efine.go.kr"]);
    assert.equal(keys.size, 0);
  });

  it("or.kr 은 비영리 단체도 등록할 수 있어 공공기관으로 보지 않는다(Codex 확인, 2026-11-11). 진짜 기관은 허용 목록으로 뺀다", () => {
    assert.equal(isSharedHost("nhis-event.or.kr"), false);
    const { keys } = buildKeys(["http://www.nhis.or.kr", "nhis-event.or.kr/x"], { allow: new Set(["nhis.or.kr"]) });
    assert.deepEqual([...keys], [hostKey("nhis-event.or.kr")]);
  });

  it("공용 호스팅의 하위 주소와 일반 도메인은 공용이 아니다", () => {
    assert.equal(isSharedHost("evil.github.io"), false);
    assert.equal(isSharedHost("cj-delivery.xyz"), false);
  });
});

describe("목록 만들기 (URL 문자열 → 키 집합)", () => {
  it("스킴·경로·포트를 버리고 호스트만 키로 만든다", () => {
    const { keys, stats } = buildKeys([
      "http://evil-delivery.xyz/track?id=1",
      "evil-delivery.xyz/abc",
      "https://Login.Bank-Check.top:8080/",
    ]);
    assert.equal(keys.size, 2);
    assert.ok(keys.has(hostKey("evil-delivery.xyz")));
    assert.ok(keys.has(hostKey("login.bank-check.top")));
    assert.equal(stats.input, 3);
    assert.equal(stats.unique, 2);
  });

  it("공용 도메인 자체와 잘못된 값은 빼고 개수를 센다", () => {
    const { keys, stats } = buildKeys(["https://bit.ly/abc", "http://naver.com/x", "", "evil.github.io/p"]);
    assert.equal(keys.size, 1);
    assert.ok(keys.has(hostKey("evil.github.io")));
    assert.equal(stats.shared, 2);
    assert.equal(stats.invalid, 1);
  });

  it("사기범 도메인에 하위 주소가 2개 이상이면 상위 도메인도 키로 넣는다", () => {
    const { keys, stats } = buildKeys(["http://a1.gh7w.yachts/x", "b2.gh7w.yachts", "login.solo.top/p"]);
    assert.ok(keys.has(hostKey("gh7w.yachts")));
    assert.ok(!keys.has(hostKey("solo.top")), "하위 주소가 1개뿐이면 상위 도메인은 넣지 않는다");
    assert.equal(stats.registrableKeys, 1);
  });

  it("무료 하위 도메인 서비스(kro.kr 등)는 상위 도메인을 넣지 않는다", () => {
    const { keys } = buildKeys(["a.kro.kr", "b.kro.kr"]);
    assert.ok(!keys.has(hostKey("kro.kr")));
    assert.ok(keys.has(hostKey("a.kro.kr")));
  });

  it("경로가 많이 다른 도메인은 단축 URL 같은 서비스로 보고 목록에서 빼고 따로 알려 준다", () => {
    const urls = Array.from({ length: 5 }, (_, i) => `https://short.example/c${i}`);
    const { keys, services, stats } = buildKeys([...urls, "evil.top/a"], { minServicePaths: 5 });
    assert.ok(!keys.has(hostKey("short.example")));
    assert.deepEqual(services, [{ host: "short.example", rows: 5, paths: 5 }]);
    assert.equal(stats.service, 5);
    assert.ok(keys.has(hostKey("evil.top")));
  });

  it("서비스 판정은 등록 도메인 자체에만 한다(하위 주소는 사기범 소유로 보고 목록에 넣는다)", () => {
    const urls = Array.from({ length: 5 }, (_, i) => `https://hzi.ujian.life/c${i}`);
    const { keys, services } = buildKeys(urls, { minServicePaths: 5 });
    assert.deepEqual(services, []);
    assert.ok(keys.has(hostKey("hzi.ujian.life")));
  });

  it("인기 사이트 허용 목록(등록 도메인)에 있는 호스트는 넣지 않는다(정상 사이트 위에 올린 피싱 대비)", () => {
    const allow = new Set(["korea.kr", "line.me", "obituary.co.kr"]);
    const { keys, stats } = buildKeys(
      ["https://www.korea.kr/x", "line.me/R/abc", "a.obituary.co.kr/b", "b.obituary.co.kr/c", "evil.top/a"],
      { allow });
    assert.deepEqual([...keys], [hostKey("evil.top")]);
    assert.equal(stats.allowed, 4);
  });

  it("국가 도메인 아래(gen.in 등)는 상위 도메인으로 묶지 않는다(공용 접미사일 수 있음)", () => {
    const { keys } = buildKeys(["wp-host.gen.in", "web-host.gen.in", "a.evil.kr", "b.evil.kr"]);
    assert.ok(!keys.has(hostKey("gen.in")));
    assert.ok(keys.has(hostKey("evil.kr")), ".kr 은 2단계 국가 도메인 목록으로 처리하므로 묶는다");
  });

  it("해외 정부 도메인도 공공기관으로 보고 넣지 않는다", () => {
    for (const h of ["epostoffice.gov.in", "x.go.th", "service.gob.mx", "a.gouv.fr", "irs.gov"]) {
      assert.equal(isSharedHost(h), true, h);
    }
  });

  it("키 파일(한 줄에 하나, # 주석 무시)을 읽는다", () => {
    const k = hostKey("evil-delivery.xyz");
    const keys = parseKeyFile(`# kisa v1\n${k}\n\nNOT-A-KEY\n${k}\n`);
    assert.deepEqual([...keys], [k]);
  });
});

describe("목록 대조기", () => {
  const keys = new Set([hostKey("evil-delivery.xyz"), hostKey("login.bank-check.top")]);
  const check = createPhishingListChecker({ keys });

  it("목록의 도메인과 그 하위 주소를 잡는다", async () => {
    const r = await check(["evil-delivery.xyz", "track.evil-delivery.xyz", "www.evil-delivery.xyz"]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.malicious, ["evil-delivery.xyz", "track.evil-delivery.xyz", "www.evil-delivery.xyz"]);
  });

  it("목록 항목의 상위 도메인은 잡지 않는다", async () => {
    const r = await check(["bank-check.top"]);
    assert.deepEqual(r.malicious, []);
  });

  it("목록에 없으면 malicious 가 비어 있다(안전하다는 뜻이 아님)", async () => {
    const r = await check(["cjlogistics.com", "epost.go.kr"]);
    assert.deepEqual(r, { ok: true, malicious: [] });
  });

  it("단축 서비스 목록에 있으면 shortened 로 알려 준다(위험 아님)", async () => {
    const c = createPhishingListChecker({ keys, shortenerKeys: new Set([hostKey("go9.co")]) });
    const r = await c(["go9.co", "evil-delivery.xyz"]);
    assert.deepEqual(r, { ok: true, malicious: ["evil-delivery.xyz"], shortened: ["go9.co"] });
  });

  it("키가 없으면 대조기를 만들지 않는다", () => {
    assert.equal(createPhishingListChecker({ keys: new Set() }), null);
    assert.equal(createPhishingListChecker({}), null);
  });
});

describe("대조기 합치기", () => {
  const listCheck = async () => ({ ok: true, malicious: ["a.xyz"] });
  const sbOk = async () => ({ ok: true, malicious: ["b.top", "a.xyz"] });
  const sbFail = async () => ({ ok: false, malicious: [], reason: "timeout" });
  const sbThrow = async () => { throw new Error("boom"); };

  it("위험 도메인은 합집합, 모두 성공이면 ok", async () => {
    const r = await combineCheckers([listCheck, sbOk])(["a.xyz", "b.top"]);
    assert.deepEqual(r, { ok: true, malicious: ["a.xyz", "b.top"] });
  });

  it("하나가 실패해도 다른 쪽 결과는 남고, ok=false 와 이유를 남긴다", async () => {
    const r = await combineCheckers([listCheck, sbFail])(["a.xyz"]);
    assert.deepEqual(r, { ok: false, malicious: ["a.xyz"], reason: "timeout" });
  });

  it("예외도 실패로 처리한다", async () => {
    const r = await combineCheckers([listCheck, sbThrow])(["a.xyz"]);
    assert.deepEqual(r, { ok: false, malicious: ["a.xyz"], reason: "error" });
  });

  it("shortened 도 합친다", async () => {
    const a = async () => ({ ok: true, malicious: [], shortened: ["go9.co"] });
    const r = await combineCheckers([a, sbOk])(["go9.co"]);
    assert.deepEqual(r, { ok: true, malicious: ["b.top", "a.xyz"], shortened: ["go9.co"] });
  });

  it("null 은 건너뛰고, 남는 것이 없으면 null", () => {
    assert.equal(combineCheckers([null, null]), null);
    assert.equal(combineCheckers([null, listCheck]), listCheck);
  });
});

describe("목록 파일 읽기", () => {
  it("두 파일을 읽어 대조기를 만든다", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-pl-"));
    writeFileSync(join(dir, "kisa-hosts.txt"), `# h
${hostKey("evil.top")}
`);
    writeFileSync(join(dir, "kisa-shorteners.txt"), `# s
${hostKey("go9.co")}
`);
    const { check, hostKeys, shortenerKeys } = loadPhishingListChecker(dir);
    assert.equal(hostKeys, 1);
    assert.equal(shortenerKeys, 1);
    assert.deepEqual(await check(["evil.top", "go9.co"]), { ok: true, malicious: ["evil.top"], shortened: ["go9.co"] });
  });

  it("파일이 없으면 대조기 없음", () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-pl-"));
    assert.equal(loadPhishingListChecker(dir).check, null);
  });
});
