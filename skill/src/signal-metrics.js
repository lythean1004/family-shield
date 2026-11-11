// Fixed-schema, per-process daily counts. Never retain request/result objects.
import * as signalIds from '../../packages/core/src/signals.js';
import { analyze } from '../../packages/core/src/pipeline.js';

const SIGNALS = new Set(Object.entries(signalIds).filter(([k]) => k.startsWith('SIG_')).map(([,v]) => v));
const RULES = new Set(Array.from({ length: 13 }, (_, i) => `R${i + 1}`));
const LOOKUPS = ['url_reputation', 'domain_age'];
const RDAP = ['network_success', 'network_failure', 'cache_hit', 'unsupported', 'no_targets', 'date_known', 'date_unknown'];
const dayKey = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const latency = () => ({ count: 0, sum: 0, max: 0, buckets: { le100: 0, le500: 0, le1500: 0, le3000: 0, over3000: 0 } });
function addLatency(to, ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
  const value = Math.round(ms);
  to.count++; to.sum += value; to.max = Math.max(to.max, value);
  const bucket = value <= 100 ? 'le100' : value <= 500 ? 'le500' : value <= 1500 ? 'le1500' : value <= 3000 ? 'le3000' : 'over3000';
  to.buckets[bucket]++;
}
const newDay = day => ({ type: 'signal_daily', version: 1, day, completed: 0, failed: 0, fast_path: 0,
  signals: {}, rules: {}, elapsed_ms: latency(),
  lookups: Object.fromEntries(LOOKUPS.map(k => [k, { success: 0, failure: 0, skipped: 0, elapsed_ms: latency() }])),
  rdap: Object.fromEntries(RDAP.map(k => [k, 0])),
});

export function createSignalMetrics({ clock = Date.now, emit = null } = {}) {
  const days = new Map();
  function prune() {
    const oldest = dayKey(clock() - 6 * 86400000), today = dayKey(clock());
    for (const day of days.keys()) if (day < oldest || day > today) days.delete(day);
  }
  return {
    record({ signals = [], rules = [], status = 'complete', elapsedMs, lookups = {} } = {}) {
      prune();
      const key = dayKey(clock());
      if (!days.has(key)) days.set(key, newDay(key));
      const day = days.get(key);
      if (status === 'failure') day.failed++;
      else { day.completed++; if (status === 'fast_path') day.fast_path++; }
      for (const id of new Set(signals)) if (SIGNALS.has(id)) day.signals[id] = (day.signals[id] ?? 0) + 1;
      for (const id of new Set(rules)) if (RULES.has(id)) day.rules[id] = (day.rules[id] ?? 0) + 1;
      addLatency(day.elapsed_ms, elapsedMs);
      for (const key of LOOKUPS) {
        const value = lookups[key], to = day.lookups[key];
        const status = value?.status === 'success' || value?.status === 'failure' ? value.status : 'skipped';
        to[status]++;
        if (status !== 'skipped') addLatency(to.elapsed_ms, value.elapsedMs);
      }
      for (const key of RDAP) {
        const value = lookups.domain_age?.stats?.[key];
        // RDAP examines at most two targets per analysis; reject arbitrary values.
        if (Number.isInteger(value) && value >= 0 && value <= 2) day.rdap[key] += value;
      }
    },
    snapshot() {
      prune();
      return structuredClone([...days.values()].sort((a,b) => a.day.localeCompare(b.day)));
    },
    flush({ includeToday = false } = {}) {
      prune();
      if (!emit) return;
      const today = dayKey(clock());
      for (const [day, row] of days) {
        if (!includeToday && day >= today) continue;
        try { emit(structuredClone(row)); days.delete(day); } catch { /* retain bounded counts for retry */ }
      }
    },
  };
}

// Each request owns its measurements; shared lookup caches cannot mix counters.
export async function analyzeCounted(input, metrics) {
  if (!metrics) return analyze(input);
  const start = performance.now(), lookups = {};
  const wrap = (check, key) => !check ? null : async domains => {
    const started = performance.now();
    try {
      const result = await check(domains);
      lookups[key] = { status: result?.ok ? 'success' : 'failure', elapsedMs: performance.now() - started,
        stats: key === 'domain_age' ? result?.stats : undefined };
      return result;
    } catch {
      lookups[key] = { status: 'failure', elapsedMs: performance.now() - started };
      // The pipeline preserves other signals when a lookup fails; no exception text.
      return { ok: false, malicious: [], young: [], reason: 'error' };
    }
  };
  let result;
  try {
    result = await analyze({ ...input, urlReputation: wrap(input.urlReputation, 'url_reputation'),
      domainAge: wrap(input.domainAge, 'domain_age') });
  } catch (error) {
    metrics.record({ status: 'failure', elapsedMs: performance.now() - start, lookups });
    throw error;
  }
  metrics.record({ signals: result.signals_final, rules: result.fired_rules, elapsedMs: performance.now() - start, lookups });
  return result;
}
