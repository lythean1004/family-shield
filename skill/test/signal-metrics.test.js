import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createSignalMetrics, analyzeCounted } from '../src/signal-metrics.js';
import { handleAnalyze, handleRequest, makeHandler } from '../src/handler.js';
import { storedResult, createReceipts } from '../src/results.js';

test('daily counts accept only known IDs and numbers, never request data', () => {
  const metrics = createSignalMetrics({ clock: () => Date.parse('2026-11-11T10:00:00Z') });
  metrics.record({ signals: ['SIG_LINK', 'SIG_LINK', 'SIG_NEW_DOMAIN', 'RAW PRIVATE'],
    rules: ['R11', 'R12', 'R12', 'R99', 'https://private.invalid'], elapsedMs: 501,
    text: 'RAW PRIVATE', domains: ['private.invalid'], userId: 'PRIVATE USER',
    lookups: { domain_age: { status: 'success', elapsedMs: 100,
      stats: { network_success: 1, date_known: 1, domain: 'private.invalid' }, reason: 'RAW PRIVATE' } } });
  const [day] = metrics.snapshot();
  assert.equal(day.day, '2026-11-11');
  assert.equal(day.completed, 1);
  assert.deepEqual(day.signals, { SIG_LINK: 1, SIG_NEW_DOMAIN: 1 });
  assert.deepEqual(day.rules, { R11: 1, R12: 1 });
  assert.equal(day.elapsed_ms.sum, 501);
  assert.equal(day.elapsed_ms.buckets.le1500, 1);
  assert.equal(day.lookups.domain_age.success, 1);
  assert.equal(day.lookups.url_reputation.skipped, 1);
  assert.equal(day.rdap.network_success, 1);
  const serialized = JSON.stringify(day);
  for (const secret of ['RAW PRIVATE', 'private.invalid', 'PRIVATE USER', 'R99', 'reason', 'text', 'domains']) {
    assert.ok(!serialized.includes(secret), secret);
  }
  day.rules.R12 = 900;
  assert.equal(metrics.snapshot()[0].rules.R12, 1);
});

test('KST midnight, emit once, retain failed output and expire after seven days', () => {
  let now = Date.parse('2026-11-11T14:59:59Z'), fail = true;
  const out = [], metrics = createSignalMetrics({ clock: () => now, emit: value => {
    if (fail) throw new Error('private output error');
    out.push(value);
  } });
  metrics.record({ rules: ['R12'] });
  metrics.flush();
  assert.equal(out.length, 0);
  now += 2000;
  metrics.flush();
  assert.equal(metrics.snapshot().length, 1, 'failed output retained');
  fail = false;
  metrics.flush(); metrics.flush();
  assert.equal(out.length, 1);
  assert.equal(out[0].day, '2026-11-11');
  assert.equal(out[0].type, 'signal_daily');
  metrics.record({ rules: ['R1'], status: 'fast_path' });
  metrics.flush({ includeToday: true });
  metrics.flush({ includeToday: true });
  assert.equal(out.length, 2);
  assert.equal(out[1].day, '2026-11-12');
  assert.equal(out[1].fast_path, 1);
  for (let i = 0; i < 9; i++) { metrics.record({}); now += 86400000; }
  assert.equal(metrics.snapshot().length, 6, 'today has no entry; oldest outside seven-day window pruned');
});

test('web and Kakao count once; empty input and displayed results are not analyses', async () => {
  const metrics = createSignalMetrics();
  const cfg = { ai: null, signalMetrics: metrics,
    domainAge: async () => ({ ok: true, young: ['sample.invalid'], stats: { network_success: 1, date_known: 1 } }),
    urlReputation: async () => { throw new Error('private.invalid secret'); } };
  const web = await handleAnalyze({ text: '본인 확인을 위해 주민등록번호를 입력하세요 https://sample.invalid' }, cfg);
  assert.equal(web.status, 200);
  assert.ok(web.body.result.fired_rules.includes('R12'));
  await handleRequest({ utterance: '통화 중', parentInputs: { call_in_progress: true } }, cfg);
  await handleRequest({ utterance: '평범한 소식입니다' }, cfg);
  await handleAnalyze({ text: '' }, cfg);
  await handleRequest({ utterance: ' ' }, cfg);
  const [day] = metrics.snapshot();
  assert.equal(day.completed, 3);
  assert.equal(day.fast_path, 1);
  assert.equal(day.rules.R1, 1);
  assert.equal(day.rules.R12, 1);
  assert.equal(day.lookups.domain_age.success, 1);
  assert.equal(day.lookups.url_reputation.failure, 1);
  assert.equal(day.lookups.domain_age.skipped, 2);
  assert.equal(day.lookups.domain_age.elapsed_ms.count, 1);
  assert.ok(!JSON.stringify(day).includes('sample.invalid'));
});

test('pipeline failures are counted without storing exception text', async () => {
  const metrics = createSignalMetrics();
  // Family-name validation fails before any lookup; no live provider is called.
  await assert.rejects(analyzeCounted({ text: '확인 부탁', familyNames: 123 }, metrics));
  const [day] = metrics.snapshot();
  assert.equal(day.failed, 1);
  assert.equal(day.completed, 0);
  assert.equal(day.elapsed_ms.count, 1);
});

test('handler exposes only an internal metrics object and retains R11/R12 in receipts', async () => {
  const metrics = createSignalMetrics();
  const handler = makeHandler({ ai: {}, signalMetrics: metrics, phishingList: null });
  assert.equal(handler.signalMetrics, metrics);
  await handler.close();
  // R13(가족 사칭+돈, D45)까지 알려진 규칙. 모르는 이름(R14·secret)은 버린다
  const r = { level: '위험', signals_final: ['SIG_NEW_DOMAIN'], fired_rules: ['R10', 'R11', 'R12', 'R13', 'R14', 'secret'] };
  assert.deepEqual(storedResult(r).fired_rules, ['R10', 'R11', 'R12', 'R13']);
  const receipts = createReceipts('local-test-only');
  assert.deepEqual(receipts.read(receipts.issue(r), null).fired_rules, ['R10', 'R11', 'R12', 'R13']);
});

test('HTTP web and Kakao routes share counts, closing emits a sanitized daily fragment', async () => {
  const out = [], metrics = createSignalMetrics({ emit: row => out.push(row) });
  const handler = makeHandler({ ai: {}, headerToken: 'local-test', signalMetrics: metrics, phishingList: null });
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const web = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '합성 문자 https://kt-sms.invalid' }) });
    assert.equal(web.status, 200);
    await web.json();
    const kakao = await fetch(`${base}/api/kakao-skill`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-skill-token': 'local-test' },
      body: JSON.stringify({ userRequest: { utterance: '합성 문자 https://kt-sms.invalid' } }) });
    assert.equal(kakao.status, 200);
    await kakao.json();
    const missing = await fetch(`${base}/api/signal-metrics`);
    assert.equal(missing.status, 404);
    await missing.text();
    assert.equal(metrics.snapshot()[0].rules.R11, 2);
    assert.equal(metrics.snapshot()[0].completed, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await handler.close();
  }
  assert.equal(out.length, 1);
  assert.equal(out[0].completed, 2);
  assert.ok(!JSON.stringify(out).includes('kt-sms.invalid'));
});
