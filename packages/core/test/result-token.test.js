import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RESULT_TOKEN_TTL_MS,
  createResultToken,
  hashToken,
  isTokenFormat,
  tokenState,
  redactToken,
  createMemoryResultStore,
} from "../src/result-token.js";

describe("1회용 결과 토큰 (PRD 13-4, D34)", () => {
  it("128비트 이상 무작위, URL 안전 base64", () => {
    const { token } = createResultToken();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.ok(token.length >= 22, "16바이트 = base64url 22자 이상");
  });

  it("매번 다른 토큰", () => {
    const set = new Set(Array.from({ length: 50 }, () => createResultToken().token));
    assert.equal(set.size, 50);
  });

  it("해시는 SHA-256 hex 64자이고 원문과 다르다", () => {
    const { token, tokenHash } = createResultToken();
    assert.match(tokenHash, /^[0-9a-f]{64}$/);
    assert.equal(tokenHash, hashToken(token));
    assert.ok(!tokenHash.includes(token));
  });

  it("만료 시각 = 만든 시각 + 10분", () => {
    const now = Date.UTC(2026, 9, 27, 3, 0, 0);
    const { expiresAt } = createResultToken({ now });
    assert.equal(RESULT_TOKEN_TTL_MS, 10 * 60 * 1000);
    assert.equal(expiresAt, now + RESULT_TOKEN_TTL_MS);
  });

  it("형식 검사: 짧거나 다른 문자가 섞이면 거부", () => {
    assert.equal(isTokenFormat(createResultToken().token), true);
    assert.equal(isTokenFormat("abc"), false);
    assert.equal(isTokenFormat("a".repeat(22) + "/"), false);
    assert.equal(isTokenFormat("a".repeat(200)), false);
    assert.equal(isTokenFormat(null), false);
  });

  it("상태: 유효 / 만료 / 사용됨 / 없음", () => {
    const now = 1_000_000;
    assert.equal(tokenState({ expiresAt: now + 1, usedAt: null }, now), "valid");
    assert.equal(tokenState({ expiresAt: now, usedAt: null }, now), "expired");
    assert.equal(tokenState({ expiresAt: now + 1000, usedAt: now - 1 }, now), "used");
    assert.equal(tokenState(null, now), "missing");
  });

  it("로그용 주소에서 t= 값을 가린다", () => {
    assert.equal(redactToken("/api/result?t=abcDEF_-123"), "/api/result?t=***");
    assert.equal(redactToken("/check/result?x=1&t=abc&y=2"), "/check/result?x=1&t=***&y=2");
    assert.equal(redactToken("/health"), "/health");
  });
});

describe("메모리 결과 저장소 (Supabase 연결 전)", () => {
  const RESULT = { level: "위험", signals_final: ["SIG_LINK"] };

  it("저장 뒤 한 번만 꺼낼 수 있다", () => {
    const store = createMemoryResultStore();
    const token = store.put(RESULT);
    assert.deepEqual(store.redeem(token), { ok: true, result: RESULT });
    assert.deepEqual(store.redeem(token), { ok: false, reason: "used" });
  });

  it("10분이 지나면 만료", () => {
    let t = 0;
    const store = createMemoryResultStore({ clock: () => t });
    const token = store.put(RESULT);
    t = RESULT_TOKEN_TTL_MS;
    assert.deepEqual(store.redeem(token), { ok: false, reason: "expired" });
  });

  it("모르는 토큰·형식이 틀린 토큰은 missing", () => {
    const store = createMemoryResultStore();
    assert.deepEqual(store.redeem(createResultToken().token), { ok: false, reason: "missing" });
    assert.deepEqual(store.redeem("../../etc"), { ok: false, reason: "missing" });
  });

  it("토큰 원문을 키로 저장하지 않는다(해시만)", () => {
    const store = createMemoryResultStore();
    const token = store.put(RESULT);
    assert.ok(!store._keys().includes(token));
    assert.ok(store._keys().includes(hashToken(token)));
  });

  it("오래된 항목은 정리되고, 상한을 넘으면 가장 오래된 것부터 버린다", () => {
    let t = 0;
    const store = createMemoryResultStore({ clock: () => t, maxEntries: 2 });
    store.put(RESULT);
    store.put(RESULT);
    store.put(RESULT);
    assert.equal(store.size(), 2);
    t = RESULT_TOKEN_TTL_MS + 60 * 60 * 1000 + 1;
    store.sweep();
    assert.equal(store.size(), 0);
  });

  it("저장하는 결과는 화면용 필드만(원문·번호 HMAC·도메인 없음)", () => {
    const store = createMemoryResultStore();
    const token = store.put({
      ...RESULT,
      phone_hmacs: ["x"], domains: ["a.invalid"], signals_code: ["SIG_LINK"], ai_meta: { latency_ms: 1 },
      impersonation_type: "family", impersonated_relation: "딸",
      explanation_for_parent: ["설명"], fallback_used: false, fired_rules: ["R7"], summary: "링크가 있음",
    });
    const { result } = store.redeem(token);
    assert.deepEqual(Object.keys(result).sort(), [
      "explanation_for_parent", "fallback_used", "fired_rules", "impersonated_relation",
      "impersonation_type", "level", "signals_final", "summary",
    ]);
  });
});
