import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSENT_STEPS, CONSENT_VERSION, emptySelection, selectAll, setChoice, isComplete, consentPlan, comprehensionQuestion,
} from '../data/consent.js'

describe('동의 항목 (작업 ⑤, D43)', () => {
  it('해외 AI 분석이 가족 제공과 분리된 첫 항목이다', () => {
    assert.deepEqual(CONSENT_STEPS.map(s => s.item), ['overseas_ai', 'family_alert', 'impersonation_check', 'check_log'])
    const alert = CONSENT_STEPS.find(s => s.item === 'family_alert')
    assert.ok(!/국외|해외|AI 제공사/.test(alert.summary + alert.details.join(' ')), '가족 제공 설명에 국외 이전이 섞이지 않는다')
  })
  it('항목마다 한 줄 요약과 펼쳐 볼 자세한 내용이 있다', () => {
    for (const s of CONSENT_STEPS) {
      assert.ok(s.title && s.summary && s.details.length >= 2, s.item)
      assert.ok(s.ifDeclined, `${s.item}: 거절하면 어떻게 되는지`)
    }
  })
  it('버전은 새 구조용', () => assert.equal(CONSENT_VERSION, 'demo-2026-11-11-v3'))
})

describe('전체 동의와 개별 동의', () => {
  it('처음에는 아무것도 선택되지 않는다(미리 체크하지 않음)', () => {
    const s = emptySelection()
    assert.ok(Object.values(s).every(v => v === null))
    assert.equal(isComplete(s), false)
  })
  it('모두 허락을 누르면 네 항목이 모두 허락', () => {
    assert.ok(Object.values(selectAll()).every(v => v === true))
  })
  it('모두 허락 뒤에도 개별로 끌 수 있다', () => {
    const s = setChoice(selectAll(), 'overseas_ai', false)
    assert.equal(s.overseas_ai, false)
    assert.equal(s.family_alert, true)
  })
  it('가족에게 결과 보내기를 거절하면 가족에게 묻기도 꺼진다', () => {
    const s = setChoice(selectAll(), 'family_alert', false)
    assert.equal(s.impersonation_check, false)
  })
  it('가족에게 결과 보내기를 허락하지 않은 채 묻기만 켤 수 없다', () => {
    const s = setChoice(setChoice(emptySelection(), 'family_alert', false), 'impersonation_check', true)
    assert.equal(s.impersonation_check, false)
  })
})

describe('저장 순서', () => {
  it('모든 항목을 고른 뒤에만 저장하고, 가족 보내기를 묻기보다 먼저 저장한다', () => {
    assert.throws(() => consentPlan(emptySelection()))
    const plan = consentPlan(setChoice(selectAll(), 'check_log', false))
    assert.deepEqual(plan, [
      { item: 'overseas_ai', granted: true },
      { item: 'family_alert', granted: true },
      { item: 'impersonation_check', granted: true },
      { item: 'check_log', granted: false },
    ])
  })
})

describe('이해 확인 질문', () => {
  const members = [
    { circleId: 'c1', relation: '딸', callName: '지은' },
    { circleId: 'c1', relation: '아들', callName: '아들' },
    { circleId: 'c2', relation: '딸', callName: '다른 그룹' },
  ]
  it('정답은 실제 받는 사람(이 그룹 가족)', () => {
    const q = comprehensionQuestion(members, 'c1')
    const correct = q.options.find(o => o.correct)
    assert.equal(correct.label, '지은(딸), 아들')
    assert.ok(q.options.some(o => o.label === '아무도 안 봐요' && !o.correct))
    assert.ok(q.options.some(o => o.label === '잘 모르겠어요' && !o.correct))
  })
  it('받는 사람이 없으면 질문하지 않는다', () => {
    assert.equal(comprehensionQuestion([], 'c1'), null)
  })
})

// 2026-11-12: 설정의 가족 확인 스위치. 켜짐 판단(두 항목 모두 허락)과 저장이 어긋나 눌러도 꺼진 것처럼 보이던 문제
import { familyToggleRequest } from '../data/consent.js'
describe('설정 화면 가족 확인 스위치', () => {
  const parent = { circles: [{ id: 'c1', isParent: true }], consents: [] }
  const withAlert = { ...parent, consents: [{ circleId: 'c1', item: 'family_alert', granted: true }] }
  it('부모님 계정이 아니면 가족 연결부터 안내', () => {
    const r = familyToggleRequest({ circles: [], consents: [] }, true)
    assert.match(r.error, /가족 연결과 동의 설정/)
  })
  it('가족에게 결과 보내기(②)를 허락하지 않았으면 켜지 않고 동의 화면으로 안내(설명 없이 동의를 만들지 않음)', () => {
    const r = familyToggleRequest(parent, true)
    assert.ok(r.error && !r.body)
    assert.match(r.error, /가족 연결과 동의 설정/)
  })
  it('②를 허락했으면 ③ 사칭 확인 요청을 켠다', () => {
    assert.deepEqual(familyToggleRequest(withAlert, true).body, { circleId: 'c1', item: 'impersonation_check', granted: true, textVersion: CONSENT_VERSION })
  })
  it('끄기는 ②가 없어도 언제나 된다', () => {
    assert.equal(familyToggleRequest(parent, false).body.granted, false)
  })
})
