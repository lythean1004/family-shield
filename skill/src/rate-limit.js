/**
 * 호출 한도 (PRD F4-9, 13-3)
 *
 * 사용자별 판별 호출 한도 [임시] 분당 5회, 하루 50회.
 * 로그인 사용자만 판별할 수 있고(13-3), 키는 botUserKey(카카오) 또는 IP(웹 직접 입력).
 * 키가 없으면 공통 키 "anon"으로 잡는다(운영에서는 로그인이 먼저지만, 개발 편의).
 *
 * 메모리 슬라이딩 윈도우. 프로세스 재시작마다 초기화(운영에서는 Redis로 교체, [임시]).
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{ maxPerMinute?: number, maxPerDay?: number, clock?: () => number }} [opts]
 */
export function createRateLimiter({ maxPerMinute = 5, maxPerDay = 50, clock = Date.now } = {}) {
  // key → number[] (timestamps)
  const buckets = new Map();
  const minuteBucket = new Map();
  const dayBucket = new Map();

  function prune(bucket, windowMs, now) {
    const cutoff = now - windowMs;
    let arr = bucket;
    while (arr.length && arr[0] < cutoff) arr.shift();
    return arr;
  }

  function touch(map, key) {
    let arr = map.get(key);
    if (!arr) { arr = []; map.set(key, arr); }
    return arr;
  }

  /**
   * @param {string} key
   * @returns {{ ok: true } | { ok: false, reason: "minute"|"day", retryAfterMs: number }}
   */
  function check(key) {
    const k = key || "anon";
    const now = clock();
    const m = prune(touch(minuteBucket, k), MINUTE_MS, now);
    const d = prune(touch(dayBucket, k), DAY_MS, now);
    if (d.length >= maxPerDay) {
      return { ok: false, reason: "day", retryAfterMs: DAY_MS - (now - d[0]) };
    }
    if (m.length >= maxPerMinute) {
      return { ok: false, reason: "minute", retryAfterMs: MINUTE_MS - (now - m[0]) };
    }
    m.push(now);
    d.push(now);
    buckets.set(k, [m, d]);
    return { ok: true };
  }

  return { check };
}

/**
 * 동시성 제한 (config.maxConcurrent, PRD 13-3)
 * 초과하면 ok:false. 들어간 작업이 끝나면 release()로 자리를 놓는다.
 * @param {{ max: number }} opts
 */
export function createConcurrencyLimit({ max = 8 } = {}) {
  let running = 0;
  /** @type {Array<() => void>} */
  const queue = [];
  return {
    async acquire() {
      if (running < max) { running++; return; }
      await new Promise((res) => queue.push(res));
      running++;
    },
    release() {
      running--;
      if (queue.length) queue.shift()();
    },
    get running() { return running; },
  };
}

/** 클라이언트 식별자. 카카오 botUserKey 우선, 없으면 IP. */
export function clientKey(req, botUserKey = null) {
  if (botUserKey) return `kakao:${botUserKey}`;
  const fwd = req?.headers?.["x-forwarded-for"];
  const ip = (fwd && String(fwd).split(",")[0].trim()) || req?.socket?.remoteAddress || "local";
  return `ip:${ip}`;
}
