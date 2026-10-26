import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  hostExpressions, expressionHashes, createSafeBrowsingChecker, SAFE_BROWSING_URL,
} from "../src/url-reputation.js";

const sha = (s) => createHash("sha256").update(s).digest();

describe("호스트 표현식 (Safe Browsing 접미사 규칙, 경로 없이 호스트만 D11)", () => {
  it("정확한 호스트 + 마지막 5개 구성요소에서 앞을 하나씩 뗀 것, TLD 하나만은 제외", () => {
    assert.deepEqual(hostExpressions("a.b.example.com"), ["a.b.example.com/", "b.example.com/", "example.com/"]);
  });

  it("긴 호스트는 정확한 호스트 + 최대 4개 접미사", () => {
    assert.deepEqual(hostExpressions("a.b.c.d.e.f.example.co.kr"), [
      "a.b.c.d.e.f.example.co.kr/", "e.f.example.co.kr/", "f.example.co.kr/", "example.co.kr/", "co.kr/",
    ]);
  });

  it("IP 주소는 그대로 하나만", () => {
    assert.deepEqual(hostExpressions("192.168.0.1"), ["192.168.0.1/"]);
  });

  it("대문자·끝 점·www는 정규화(www는 접미사로 자연히 포함)", () => {
    assert.deepEqual(hostExpressions("WWW.Evil.Invalid."), ["www.evil.invalid/", "evil.invalid/"]);
  });

  it("빈 값·잘못된 값은 빈 목록", () => {
    assert.deepEqual(hostExpressions(""), []);
    assert.deepEqual(hostExpressions("com"), []);
    assert.deepEqual(hostExpressions("a b.com"), []);
  });
});

describe("해시", () => {
  it("SHA-256 앞 4바이트를 base64로", () => {
    const [h] = expressionHashes(["evil.invalid/"]);
    assert.equal(h.fullHash, sha("evil.invalid/").toString("base64"));
    assert.equal(h.prefix, sha("evil.invalid/").subarray(0, 4).toString("base64"));
  });
});

function gateway(matches, seen = {}) {
  return async (url) => {
    seen.url = url;
    seen.calls = (seen.calls ?? 0) + 1;
    return {
      ok: true, status: 200,
      json: async () => ({
        fullHashes: matches.map((expr) => ({
          fullHash: sha(expr).toString("base64"),
          fullHashDetails: [{ threatType: "SOCIAL_ENGINEERING" }],
        })),
        cacheDuration: "300s",
      }),
    };
  };
}

describe("Safe Browsing 조회기", () => {
  it("악성 도메인을 찾는다(전체 해시를 로컬에서 비교)", async () => {
    const check = createSafeBrowsingChecker({ apiKey: "k", fetchImpl: gateway(["evil.invalid/"]) });
    const r = await check(["login.evil.invalid", "good.invalid"]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.malicious, ["login.evil.invalid"]);
  });

  it("요청에는 4바이트 접두어만 간다(도메인 글자 없음)", async () => {
    const seen = {};
    const check = createSafeBrowsingChecker({ apiKey: "KEY", fetchImpl: gateway([], seen) });
    await check(["secret-name.invalid"]);
    assert.ok(seen.url.startsWith(SAFE_BROWSING_URL));
    assert.ok(!seen.url.includes("secret-name"));
    assert.match(seen.url, /hashPrefixes=/);
    assert.match(seen.url, /alt=json/);
  });

  it("접두어만 같고 전체 해시가 다르면 악성이 아니다", async () => {
    const fetchImpl = async () => ({
      ok: true, status: 200,
      json: async () => ({ fullHashes: [{ fullHash: sha("other.invalid/").toString("base64"), fullHashDetails: [{ threatType: "MALWARE" }] }] }),
    });
    const r = await createSafeBrowsingChecker({ apiKey: "k", fetchImpl })(["evil.invalid"]);
    assert.deepEqual(r.malicious, []);
  });

  it("알 수 없는 위협 종류·CANARY 표시는 무시한다(API 문서 규칙)", async () => {
    const fetchImpl = async () => ({
      ok: true, status: 200,
      json: async () => ({ fullHashes: [
        { fullHash: sha("a.invalid/").toString("base64"), fullHashDetails: [{ threatType: "NEW_THING" }] },
        { fullHash: sha("b.invalid/").toString("base64"), fullHashDetails: [{ threatType: "MALWARE", attributes: ["CANARY"] }] },
      ] }),
    });
    const r = await createSafeBrowsingChecker({ apiKey: "k", fetchImpl })(["a.invalid", "b.invalid"]);
    assert.deepEqual(r.malicious, []);
  });

  it("같은 도메인은 캐시(cacheDuration 동안 다시 묻지 않음)", async () => {
    const seen = {};
    let t = 0;
    const check = createSafeBrowsingChecker({ apiKey: "k", fetchImpl: gateway([], seen), clock: () => t });
    await check(["x.invalid"]);
    await check(["x.invalid"]);
    assert.equal(seen.calls, 1);
    t = 301_000;
    await check(["x.invalid"]);
    assert.equal(seen.calls, 2);
  });

  it("실패·시간 초과는 ok:false, 판정을 낮추지 않도록 malicious는 빈 목록", async () => {
    const slow = () => new Promise(() => {});
    const r1 = await createSafeBrowsingChecker({ apiKey: "k", fetchImpl: slow, timeoutMs: 20 })(["x.invalid"]);
    assert.deepEqual(r1, { ok: false, malicious: [], reason: "timeout" });
    const r2 = await createSafeBrowsingChecker({ apiKey: "k", fetchImpl: async () => ({ ok: false, status: 403 }) })(["x.invalid"]);
    assert.deepEqual(r2, { ok: false, malicious: [], reason: "http 403" });
  });

  it("도메인이 없으면 호출하지 않는다", async () => {
    const seen = {};
    const r = await createSafeBrowsingChecker({ apiKey: "k", fetchImpl: gateway([], seen) })([]);
    assert.deepEqual(r, { ok: true, malicious: [] });
    assert.equal(seen.calls, undefined);
  });

  it("키가 없으면 만들지 않는다(null)", () => {
    assert.equal(createSafeBrowsingChecker({ apiKey: "" }), null);
  });
});
