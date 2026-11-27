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

function fixture(overrides = {}, { hasRequest = true } = {}) {
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
    ...overrides,
  }
  const reports = []
  const counts = { requests: 0, notifications: 0 }
  const tx = { async query(sql, params) {
    if (sql.includes('m.name_for_parent') && sql.includes('and ch.receipt_hash=$1')) {
      return { rows: hasRequest && params[0] === row.receipt_hash ? [structuredClone(row)] : [] }
    }
    if (sql.includes('m.name_for_parent')) return { rows: [structuredClone(row)] }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('select distinct on(item)')) {
      return { rows: ['family_alert', 'impersonation_check', 'check_log'].map(item => ({ item, granted: true })) }
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
    if (sql.includes('select id from public.circles')) return { rows: [{ id: row.circle_id }] }
    if (sql.includes('insert into public.misjudge_reports')) {
      reports.push({ level: params[1], firedRules: params[2], signals: params[3] })
      return { rows: [{ id: 'fixture-report' }] }
    }
    throw new Error('unexpected query')
  } }
  const service = createConfirmService({ user: (_user, operation) => operation(tx) }, receipts)
  const api = createFamilyApi({ authenticate: req => ({ userId: req.userId }), checkLimit: async () => {} }, service, { webBaseUrl: origin }, {
    notify: async () => { counts.notifications++ },
  })

  async function request(userId, url, body) {
    let reply
    const handled = await api({
      userId, url, method: body === undefined ? 'GET' : 'POST', headers: { origin, 'x-fs-request': '1' },
    }, (status, data) => { reply = { status, data } }, async () => JSON.stringify(body))
    assert.ok(handled)
    assert.equal(reply.status, 200)
    return reply.data
  }

  return { receiptHash: row.receipt_hash, originalReceipt, reports, counts, request, read: receipt => receipts.read(receipt, parent) }
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
