import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashToken } from '../src/auth.js'
import { createConfirmService } from '../src/confirm.js'
import { createFamilyApi } from '../src/family-api.js'
import { createReceipts } from '../src/results.js'

const parent = 'fixture-parent'
const guardian = 'fixture-guardian'
const requestId = '10000000-0000-4000-8000-000000000001'
const checkId = '10000000-0000-4000-8000-000000000002'
const origin = 'https://family-fixture.invalid'

function fixture(overrides = {}, { hasRequest = true, consent = true } = {}) {
  const receipts = createReceipts('local-confirmed-result-fixture')
  const result = {
    level: '주의', fired_rules: ['R7'], signals_final: ['SIG_FAMILY_IMPERSONATION'],
    impersonation_type: 'family', impersonated_relation: '딸', fallback_used: true,
  }
  const originalReceipt = receipts.issue(result, parent)
  const row = {
    ...result, id: requestId, check_id: checkId, circle_id: 'fixture-circle',
    created_by: parent, target_member_id: guardian, state: 'pending', kind: 'family_check',
    level: 'caution', receipt_hash: hashToken(originalReceipt),
    created_at: new Date(), deadline_at: new Date(Date.now() + 60_000),
    purge_at: new Date(Date.now() + 24 * 60 * 60_000),
    ...overrides,
  }
  const reports = []
  const counts = { requests: 0, notifications: 0 }
  const recorded = []
  const tx = { async query(sql, params) {
    if (sql.includes('ch.receipt_hash=$4')) {
      assert.match(sql, /ch\.purge_at>now\(\)/)
      const matches = hasRequest && row.purge_at.getTime() > Date.now() &&
        [row.id, row.created_by, row.circle_id, row.receipt_hash].every((value, index) => value === params[index])
      return { rows: matches ? [structuredClone(row)] : [] }
    }
    if (sql.includes('m.name_for_parent') && sql.includes('and ch.receipt_hash=$1')) {
      return { rows: hasRequest && params[0] === row.receipt_hash ? [structuredClone(row)] : [] }
    }
    if (sql.includes('m.name_for_parent')) return { rows: [structuredClone(row)] }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('select distinct on(item)')) {
      return { rows: ['family_alert', 'impersonation_check', 'check_log'].map(item => ({ item, granted: consent || item !== 'impersonation_check' })) }
    }
    if (sql.includes('select user_id,relation')) return { rows: [{ user_id: guardian, relation: '딸' }] }
    if (sql.includes('select id from public.checks where receipt_hash')) {
      return { rows: params[0] === row.receipt_hash ? [{ id: checkId }] : [] }
    }
    if (sql.includes('insert into public.confirm_requests')) {
      hasRequest = true
      counts.requests++
      return { rows: [{ id: requestId }] }
    }
    if (sql.includes("set state='responded'")) {
      row.state = 'responded'
      row.response = { answer: params[1] }
      row.responded_at = new Date()
      return { rows: [{ id: requestId }] }
    }
    if (sql.includes('select id from public.circles')) {
      return { rows: params[0] === parent ? [{ id: row.circle_id }] : [] }
    }
    if (sql.includes('insert into public.misjudge_reports')) {
      reports.push({ level: params[1], firedRules: params[2], signals: params[3] })
      return { rows: [{ id: 'fixture-report' }] }
    }
    throw new Error('unexpected query')
  } }
  const service = createConfirmService({ user: (_user, operation) => operation(tx) }, receipts)
  const api = createFamilyApi({ authenticate: req => req.userId ? { userId: req.userId } : null, checkLimit: async () => {} }, service, { webBaseUrl: origin }, {
    notify: async () => { counts.notifications++ },
    recordCheck: async (userId, receipt) => { recorded.push(receipts.read(receipt, userId)) },
  })

  async function request(userId, url, body, expectedStatus = 200) {
    let reply
    const handled = await api({
      userId, url, method: body === undefined ? 'GET' : 'POST', headers: { origin, 'x-fs-request': '1' },
    }, (status, data) => { reply = { status, data } }, async () => JSON.stringify(body))
    assert.ok(handled)
    assert.equal(reply.status, expectedStatus)
    return reply.data
  }

  return { receiptHash: row.receipt_hash, originalReceipt, reports, counts, recorded, request, read: receipt => receipts.read(receipt, parent) }
}

const requestPath = `/api/confirm/${requestId}`

test('승인된 같은 건의 발신 부인을 부모 결과에 서명하고 오판 신고의 판정에도 보존한다', async () => {
  const f = fixture()
  const pending = (await f.request(parent, requestPath)).request
  assert.equal(pending.confirmedResult, undefined)

  await f.request(guardian, `${requestPath}/respond`, { answer: 'not_sent' })
  const read = (await f.request(parent, requestPath)).request
  assert.equal(read.checkId, checkId)
  assert.equal(read.answer, 'not_sent')
  assert.equal(read.summary.level, '위험')
  assert.equal(read.confirmedResult?.level, '위험')
  assert.equal(pending.sourceReceiptHash === f.receiptHash, true)
  assert.equal(read.sourceReceiptHash === f.receiptHash, true)
  assert.deepEqual(read.confirmedResult.fired_rules, ['R7', 'R5'])
  const signed = f.read(read.confirmedResult.receipt)
  assert.equal(signed.level, read.confirmedResult.level)
  assert.deepEqual(signed.fired_rules, read.confirmedResult.fired_rules)
  assert.deepEqual(signed.signals_final, ['SIG_FAMILY_IMPERSONATION'])
  assert.equal(signed.impersonation_type, 'family')
  assert.equal(signed.impersonated_relation, '딸')
  assert.equal(signed.fallback_used, true)
  const followUp = await f.request(parent, '/api/result/context', { receipt: read.confirmedResult.receipt, calledBefore: false })
  assert.deepEqual(f.read(followUp.result.receipt).fired_rules, ['R7', 'R5'])
  await f.request(parent, '/api/misjudge', { receipt: read.confirmedResult.receipt, reason: 'other', shareConsent: true })
  assert.deepEqual(f.reports, [{ level: 'danger', firedRules: ['R7', 'R5'], signals: ['SIG_FAMILY_IMPERSONATION'] }])
})

test('승인 결과 서명과 원본 영수증 연결값을 보호자 조회나 요청 목록에 싣지 않는다', async () => {
  const f = fixture({ state: 'responded', response: { answer: 'not_sent' }, responded_at: new Date() })
  const guardianRequest = (await f.request(guardian, requestPath)).request
  const [parentListEntry] = (await f.request(parent, '/api/confirm')).requests
  for (const view of [guardianRequest, parentListEntry]) {
    assert.equal(view.checkId, checkId)
    assert.equal(view.summary.level, '위험')
    assert.equal(view.confirmedResult, undefined)
    assert.equal(view.sourceReceiptHash, undefined)
  }
})

test('응답이 끝난 요청을 다시 읽어도 최초 위험 규칙과 기존 통화 확인을 보존한다', async () => {
  const f = fixture({
    state: 'responded', response: { answer: 'not_sent' }, responded_at: new Date(),
    deadline_at: new Date(Date.now() - 60_000), level: 'danger',
    fired_rules: ['R2', 'R7', 'R16'], signals_final: ['SIG_LINK', 'SIG_CREDENTIAL_DISCLOSURE'],
  })
  const read = (await f.request(parent, requestPath)).request
  assert.equal(read.state, 'responded')
  const signed = f.read(read.confirmedResult.receipt)
  assert.deepEqual(signed.fired_rules, ['R2', 'R7', 'R16', 'R5'])
  assert.deepEqual(signed.signals_final, ['SIG_LINK', 'SIG_CREDENTIAL_DISCLOSURE'])
})

test('일반 확인과 발신 부인이 아닌 가족 응답은 기존 판정을 유지한다', async () => {
  for (const [kind, answer] of [['official_check', 'dont_press'], ['family_check', 'sent']]) {
    const f = fixture({ kind })
    await f.request(guardian, `${requestPath}/respond`, { answer })
    const view = (await f.request(parent, requestPath)).request
    assert.equal(view.summary.level, '주의')
    assert.equal(view.confirmedResult, undefined)
  }
})

test('동일 결과로 확인 요청이 재시도되면 기존 요청을 돌려주고 한 번만 알린다', async () => {
  const f = fixture({}, { hasRequest: false })
  const body = { receipt: f.originalReceipt, requestType: 'impersonation' }
  const first = (await f.request(parent, '/api/confirm', body)).request
  const retry = (await f.request(parent, '/api/confirm', body)).request
  assert.equal(first.id, retry.id)
  assert.equal(first.checkId, retry.checkId)
  assert.deepEqual(f.counts, { requests: 1, notifications: 1 })
})

test('원래 검사에 연결된 통화 결과는 검사 서명 만료 후에도 기록을 다시 만들지 않고 R5를 반영한다', async ({ mock }) => {
  let clock = Date.now()
  mock.method(Date, 'now', () => clock)
  const f = fixture({ state: 'expired' })
  const contextPath = '/api/result/context'
  const body = { receipt: f.originalReceipt, requestId, familyDenied: true }
  clock += 10 * 60_000 - 1
  const beforeExpiry = await f.request(parent, contextPath, body)
  assert.deepEqual(beforeExpiry.result.fired_rules, ['R7', 'R5'])
  assert.equal(f.recorded.length, 1)

  clock++
  assert.throws(() => f.read(f.originalReceipt), { reason: 'result_expired' })
  const replies = await Promise.all([f.request(parent, contextPath, body), f.request(parent, contextPath, body)])
  for (const reply of replies) {
    assert.equal(reply.result.level, '위험')
    assert.deepEqual(reply.result.fired_rules, ['R7', 'R5'])
    assert.deepEqual(f.read(reply.result.receipt).fired_rules, reply.result.fired_rules)
    assert.equal(reply.originalCallRecovered, undefined)
  }
  assert.equal(f.recorded.length, 1)
  assert.deepEqual(f.counts, { requests: 0, notifications: 0 })
  await f.request(parent, '/api/misjudge', { receipt: replies[0].result.receipt, reason: 'other', shareConsent: true })
  assert.deepEqual(f.reports, [{ level: 'danger', firedRules: ['R7', 'R5'], signals: ['SIG_FAMILY_IMPERSONATION'] }])
})

test('통화 결과 복구에는 같은 보관 검사와 직접 선택한 가족 발신 부인이 필요하다', async ({ mock }) => {
  let clock = Date.now()
  mock.method(Date, 'now', () => clock)
  const contextPath = '/api/result/context'
  const other = fixture()
  const f = fixture()
  const removed = fixture({ purge_at: new Date(clock) })
  const cancelled = fixture({ state: 'cancelled' })
  const deviceSuspect = fixture({ device_suspect: true })
  const officialCheck = fixture({ kind: 'official_check' })
  const revoked = fixture({}, { consent: false })
  clock += 10 * 60_000

  const body = { receipt: f.originalReceipt, requestId, familyDenied: true }
  assert.equal((await f.request(null, contextPath, body, 401)).reason, 'login_required')
  for (const [user, value] of [
    [guardian, body],
    [parent, { ...body, receipt: other.originalReceipt }],
    [parent, { ...body, requestId: checkId }],
    [parent, { ...body, requestId: undefined }],
    [parent, { ...body, familyDenied: false }],
  ]) {
    assert.equal((await f.request(user, contextPath, value, 400)).reason, 'result_expired')
  }
  for (const rejected of [removed, cancelled, deviceSuspect, officialCheck]) {
    const reply = await rejected.request(parent, contextPath, { ...body, receipt: rejected.originalReceipt }, 400)
    assert.equal(reply.reason, 'result_expired')
    assert.equal(rejected.recorded.length, 0)
  }
  const reply = await revoked.request(parent, contextPath, { ...body, receipt: revoked.originalReceipt }, 403)
  assert.equal(reply.reason, 'consent_required')
  assert.equal(f.recorded.length + revoked.recorded.length, 0)
})
