import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze } from '../../packages/core/src/pipeline.js'
import { createConfirmService } from '../src/confirm.js'
import { createFamilyApi } from '../src/family-api.js'
import { createReceipts } from '../src/results.js'

const claim = '검찰청 수사관을 자처한 사람에게 연락을 받았습니다.'
const action = '같은 발신자가 제 신분증 사본을 제출하라고 요구했다는 수신 보고입니다.'
const separate = claim + ' 다른 발신자가 제 신분증 사본을 제출하라고 요구했다는 수신 보고입니다.'
const separateLink = claim + ' 다른 발신자가 보낸 합성 주소 case.invalid를 관찰 기록에 옮겼습니다.'

function fixture() {
  const userId = 'fixture-parent'
  const receipts = createReceipts('local-context-fixture')
  const service = createConfirmService(null, receipts)
  const origin = 'https://fixture.invalid'
  let recorded
  const handle = createFamilyApi({ authenticate: async () => ({ userId }) }, service, { webBaseUrl: origin }, {
    recordCheck: async (memberId, token) => { recorded = receipts.read(token, memberId) },
  })
  return {
    issue: result => receipts.issue(result, userId),
    async context(receipt, answer) {
      let reply
      const consumed = await handle({
        url: '/api/result/context', method: 'POST', headers: { origin, 'x-fs-request': '1' },
      }, (status, body) => { reply = { status, body } }, async () => JSON.stringify({ receipt, ...answer }))
      assert.ok(consumed)
      assert.equal(reply.status, 200)
      const result = reply.body.result
      assert.deepEqual(recorded.fired_rules, result.fired_rules)
      assert.equal(recorded.level, result.level)
      assert.equal(recorded.text, undefined)
      assert.equal(recorded.unlinkedAgencyActions, undefined)
      return result
    },
  }
}

test('재판정 요청에서 서로 다른 발신자의 주장과 자료 요구를 계속 분리한다', async () => {
  const result = await analyze({ text: separate, ai: null })
  assert.equal(result.level, '주의')
  assert.deepEqual(result.fired_rules, ['R7'])
  const route = fixture()
  const found = await route.context(route.issue(result), { calledBefore: false, familyDenied: false })
  assert.equal(found.level, result.level)
  assert.deepEqual(found.fired_rules, result.fired_rules)
})

test('재서명된 영수증에서 R2와 R5를 실제 응답에 따라 한 번씩만 추가한다', async () => {
  const result = await analyze({ text: separateLink, ai: null })
  assert.equal(result.level, '주의')
  assert.deepEqual(result.fired_rules, ['R7'])
  const route = fixture()
  const called = await route.context(route.issue(result), { calledBefore: true })
  assert.equal(called.level, '위험')
  assert.deepEqual(called.fired_rules, ['R7', 'R2'])
  const denied = await route.context(called.receipt, { calledBefore: true, familyDenied: true })
  assert.equal(denied.level, '위험')
  assert.deepEqual(denied.fired_rules, ['R7', 'R2', 'R5'])
  const repeated = await route.context(denied.receipt, { calledBefore: true, familyDenied: true })
  assert.deepEqual(repeated.fired_rules, denied.fired_rules)
})

test('기존 형식에 저장된 R6과 철회가 명확하지 않은 현재 R6를 유지한다', async () => {
  const route = fixture()
  const legacy = {
    level: '위험', fired_rules: ['R6', 'R7'], signals_final: ['SIG_AGENCY_IMPERSONATION', 'SIG_PERSONAL_INFO'],
  }
  const keptLegacy = await route.context(route.issue(legacy), { familyDenied: true })
  assert.deepEqual(keptLegacy.fired_rules, ['R6', 'R7', 'R5'])
  const current = await analyze({ text: claim + ' ' + action + ' 발신자가 그 요구를 철회하지 않았습니다.', ai: null })
  assert.deepEqual(current.fired_rules, legacy.fired_rules)
  const keptCurrent = await route.context(route.issue(current), { calledBefore: false })
  assert.equal(keptCurrent.level, current.level)
  assert.deepEqual(keptCurrent.fired_rules, current.fired_rules)
})

test('가짜 AI가 새 행동을 찾아 발동한 최초 R6에 전화 확인 R2만 더한다', async () => {
  const result = await analyze({ text: separate, ai: {
    model: 'fixture', apiKey: 'fixture', fetchImpl: async () => ({
      ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'tool_calls', message: {
        tool_calls: [{ function: { name: 'report_signals', arguments: JSON.stringify({
          signals: ['SIG_APP_INSTALL'], impersonation_type: 'agency', impersonated_relation: null,
          evidence_card_ids: [], explanation_for_parent: [],
        }) } }],
      } }] }),
    }),
  } })
  assert.deepEqual(result.fired_rules, ['R6', 'R7'])
  assert.deepEqual(result.signals_ai, ['SIG_APP_INSTALL'])
  const route = fixture()
  const updated = await route.context(route.issue(result), { calledBefore: true })
  assert.equal(updated.level, '위험')
  assert.deepEqual(updated.fired_rules, ['R6', 'R7', 'R2'])
})

test('건강정보 차단 후 확인 응답도 새 AI 호출이나 내용 보관을 유발하지 않는다', async () => {
  let calls = 0
  const result = await analyze({ text: '병원에서 정기 검진 결과를 받았습니다.', ai: {
    model: 'fixture', apiKey: 'fixture', fetchImpl: async () => { calls++; throw Error('offline fixture') },
  } })
  assert.equal(result.ai_skipped, 'health')
  assert.deepEqual(result.fired_rules, ['R8'])
  const route = fixture()
  const original = await route.context(route.issue(result), { calledBefore: false })
  assert.equal(original.level, '확인필요')
  const denied = await route.context(original.receipt, { familyDenied: true })
  assert.equal(denied.level, '위험')
  assert.deepEqual(denied.fired_rules, ['R5'])
  assert.equal(calls, 0)
})
