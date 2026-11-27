import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  beginCurrentResult, bindCurrentRequest, commitResultUpdate, getCurrentRequest,
  loadCurrentRequestId, loadCurrentResult, readFamilyAnswer, canReportOriginalCall,
} from '../data/session.js'

const a = { level: '주의', fired_rules: ['R7'], receipt: 'local-a' }
const b = { level: '확인필요', fired_rules: ['R8'], receipt: 'local-b' }
const pending = { id: 'request-a', checkId: 'check-a', requestType: 'impersonation', state: 'pending' }
const signed = { level: '위험', fired_rules: ['R7', 'R5'], receipt: 'local-a-confirmed' }
const denied = { ...pending, state: 'responded', answer: 'not_sent', confirmedResult: signed }

beforeEach(() => {
  const items = new Map()
  globalThis.sessionStorage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key),
  }
})

test('새 문자에는 이전 가족 요청·뒤늦은 응답·이전 판정 갱신이 붙지 않는다', async () => {
  beginCurrentResult(a)
  assert.equal(bindCurrentRequest(a.receipt, pending), true)
  let reply
  const waiting = readFamilyAnswer(pending.id, () => new Promise(resolve => { reply = resolve }))
  beginCurrentResult(b)
  reply(denied)
  assert.equal(await waiting, null)
  assert.equal(loadCurrentRequestId(), null)
  assert.equal(bindCurrentRequest(a.receipt, pending), false)
  assert.equal(commitResultUpdate(a.receipt, signed), false)
  assert.deepEqual(loadCurrentResult(), b)
})

test('다시 들어온 가족 답은 같은 요청·검사에서만 받아 서명된 R5를 저장한다', async () => {
  beginCurrentResult(a)
  bindCurrentRequest(a.receipt, pending)
  for (const wrong of [{ ...denied, id: 'other' }, { ...denied, checkId: 'other' }]) {
    assert.equal(await readFamilyAnswer(pending.id, async () => wrong), null)
  }
  assert.equal(await readFamilyAnswer('older-request', () => assert.fail()), null)
  const result = await readFamilyAnswer(pending.id, async () => denied)
  assert.equal(result.request.id, pending.id)
  assert.deepEqual(loadCurrentResult(), signed)
  assert.equal(loadCurrentRequestId(), pending.id)
})

test('서명 뒤에 추가 확인한 R2와 관계를 같은 가족 답의 서명에도 보존한다', async () => {
  beginCurrentResult(a)
  bindCurrentRequest(a.receipt, pending)
  const later = { ...a, level: '위험', fired_rules: ['R7', 'R2'], impersonated_relation: '딸', receipt: 'local-a-called' }
  commitResultUpdate(a.receipt, later)
  let replay
  const answer = await readFamilyAnswer(pending.id, async () => denied, async (result, context) => {
    replay = { result, context }
    return { ...result, fired_rules: [...result.fired_rules, 'R2'], impersonated_relation: '딸', receipt: 'local-both' }
  })
  assert.deepEqual(replay, { result: signed, context: { calledBefore: true, relation: '딸' } })
  assert.equal(answer.result.receipt, 'local-both')
  assert.deepEqual(loadCurrentResult().fired_rules, ['R7', 'R5', 'R2'])
})

test('일반 확인과 송신 인정은 원래 판정과 서명을 보존한다', async () => {
  for (const request of [
    { ...pending, requestType: 'link_check', state: 'responded', answer: 'dont_press' },
    { ...pending, state: 'responded', answer: 'sent' },
    { ...pending, state: 'pending' },
  ]) {
    beginCurrentResult(a)
    bindCurrentRequest(a.receipt, request)
    const view = await readFamilyAnswer(request.id, async () => request, () => assert.fail())
    assert.deepEqual(view.result, a)
    assert.deepEqual(loadCurrentResult(), a)
  }
})

test('같은 가족 답을 동시에 확인해도 이미 반영한 서명 결과를 두 읽기 모두 받는다', async () => {
  beginCurrentResult(a)
  bindCurrentRequest(a.receipt, pending)
  const waits = []
  const read = () => readFamilyAnswer(pending.id,
    async () => ({ ...denied, confirmedResult: undefined }),
    () => new Promise(resolve => waits.push(resolve)))
  const left = read(), right = read()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(waits.length, 2)
  waits[0](signed)
  assert.deepEqual((await left).result, signed)
  waits[1]({ ...signed, receipt: 'local-a-second-read' })
  assert.deepEqual((await right).result, signed)
})

test('구형 탭의 서명이 같은 요청만 복구하고, 연결이 불명확하면 현재 결과를 유지한다', async () => {
  sessionStorage.setItem('fs.current.result', JSON.stringify(a))
  sessionStorage.setItem('fs.current.request', pending.id)
  assert.deepEqual(loadCurrentResult(), a)
  assert.equal(loadCurrentRequestId(), null)
  const digest = value => createHash('sha256').update(value).digest('hex')
  assert.equal(await getCurrentRequest(null, async () => ({ ...pending, sourceReceiptHash: digest(b.receipt) })), null)
  assert.deepEqual(loadCurrentResult(), a)
  const same = { ...pending, sourceReceiptHash: digest(a.receipt) }
  assert.deepEqual(await getCurrentRequest(null, async () => same), same)
  assert.equal(loadCurrentRequestId(), pending.id)
})

test('원래 번호 통화는 사칭 확인 요청에서만 열고 기기 의심·취소에는 보류한다', () => {
  assert.equal(canReportOriginalCall(pending), true)
  assert.equal(canReportOriginalCall({ ...pending, state: 'expired' }), true)
  for (const req of [null, { ...pending, requestType: 'link_check' }, { ...pending, state: 'cancelled' }, { ...pending, deviceSuspect: true }]) {
    assert.equal(canReportOriginalCall(req), false)
  }
})
