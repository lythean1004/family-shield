// web 데이터 검사: 데모 고정 결과가 실제 규칙 엔진과 같은지, 번호 목록이 U7을 지키는지.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../../../packages/core/src/rule-engine.js'
import { DEMO_SCENARIOS } from '../data/demo.js'
import { DEV_RESULT, levelKey, verdictDescription } from '../data/result.js'
import { OFFICIAL_CONTACTS } from '../data/contacts.js'

describe('데모 예시 SC1~SC4 (PRD 12-5)', () => {
  it('4개이고 id가 sc1~sc4', () => {
    assert.deepEqual(DEMO_SCENARIOS.map((s) => s.id), ['sc1', 'sc2', 'sc3', 'sc4'])
  })

  for (const sc of DEMO_SCENARIOS.filter((s) => s.result)) {
    it(`${sc.id}: 고정 판정이 규칙 엔진 결과와 같다`, () => {
      const got = decide({
        signals_final: sc.result.signals_final,
        called_before: Boolean(sc.callContext),
      })
      assert.equal(sc.result.level, got.level)
      assert.deepEqual(sc.result.fired_rules, got.fired_rules)
    })
  }

  it('예시 문자에 실제 번호·주소가 없다(마스킹 형태만)', () => {
    for (const sc of DEMO_SCENARIOS) {
      assert.doesNotMatch(sc.message, /\d{2,4}-\d{3,4}-\d{4}|https?:\/\/|www\./)
    }
  })
})

describe('개발용 결과', () => {
  it('DEV_RESULT 판정이 규칙 엔진과 같다', () => {
    assert.equal(decide({ signals_final: DEV_RESULT.signals_final }).level, DEV_RESULT.level)
  })
})

describe('판정 표시', () => {
  it('core 단계 이름 → 화면 키', () => {
    assert.equal(levelKey('위험'), 'danger')
    assert.equal(levelKey('주의'), 'caution')
    assert.equal(levelKey('확인필요'), 'check')
    assert.equal(levelKey('모름'), 'check')
  })

  it("어떤 설명에도 '안전'·'정상'이 없다(U6)", () => {
    for (const lv of ['위험', '주의', '확인필요']) {
      for (const t of ['family', 'agency', 'none', null]) {
        assert.doesNotMatch(verdictDescription(lv, t), /안전|정상/)
      }
    }
  })
})

describe('공식 번호 (U7, F2-4)', () => {
  it('112가 맨 위', () => {
    assert.equal(OFFICIAL_CONTACTS[0].number, '112')
  })

  it('needs_review 번호(118, 1566-1188)는 없다', () => {
    const numbers = OFFICIAL_CONTACTS.map((c) => c.number)
    assert.ok(!numbers.includes('118'))
    assert.ok(!numbers.includes('1566-1188'))
  })
})
