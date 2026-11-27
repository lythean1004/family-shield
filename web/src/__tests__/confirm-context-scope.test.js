import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze } from '../../../packages/core/src/pipeline.js'
import { ANSWERS, applyCallContext, applyFamilyAnswer } from '../data/confirm.js'

const agency = '검찰청 수사관을 자처한 사람에게 연락을 받았습니다.'

test('문자열로 전달된 전화 응답 중 예만 R2에 반영한다', () => {
  const result = { level: '주의', fired_rules: ['R7'], signals_final: ['SIG_LINK'] }
  assert.equal(applyCallContext(result, { calledBefore: 'false' }), result)
  assert.deepEqual(applyCallContext(result, { calledBefore: 'true' }).fired_rules, ['R7', 'R2'])
})

test('웹의 전화·가족 확인 응답은 별도 발신자의 개인정보 요구를 R6에 다시 넣지 않는다', async () => {
  const result = await analyze({
    text: agency + ' 다른 발신자가 제 신분증 사본을 제출하라고 요구했다는 수신 보고입니다.',
    ai: null,
  })
  assert.deepEqual(result.fired_rules, ['R7'])
  assert.equal(applyCallContext(result, { calledBefore: true }), result)
  assert.equal(applyFamilyAnswer(result, ANSWERS.WILL_CALL), result)
  const denied = applyFamilyAnswer(result, ANSWERS.NOT_SENT)
  assert.equal(denied.level, '위험')
  assert.deepEqual(denied.fired_rules, ['R7', 'R5'])
})

test('웹 확인 규칙은 실제 응답에 따라 표시하고 최초 규칙은 유지한다', async () => {
  const result = await analyze({ text: agency + ' 다른 발신자가 보낸 합성 주소 case.invalid를 기록했습니다.', ai: null })
  assert.deepEqual(result.fired_rules, ['R7'])
  const called = applyCallContext(result, { calledBefore: true })
  assert.equal(called.level, '위험')
  assert.deepEqual(called.fired_rules, ['R7', 'R2'])
  assert.deepEqual(applyFamilyAnswer(called, ANSWERS.NOT_SENT).fired_rules, ['R7', 'R2', 'R5'])
  const legacy = { level: '위험', fired_rules: ['R6'], signals_final: ['SIG_AGENCY_IMPERSONATION', 'SIG_APP_INSTALL'] }
  assert.deepEqual(applyCallContext(legacy, { calledBefore: true }).fired_rules, ['R6', 'R2'])
})
