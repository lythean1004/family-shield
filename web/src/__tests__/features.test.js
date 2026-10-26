// F5-3 링크 확인 답변, F5-10 최근 24시간 목록, F7 퀴즈 고정 문항 검사
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../../../packages/core/src/rule-engine.js'
import {
  ANSWERS_LINK, REQUEST_TYPES, createConfirmStore, applyFamilyAnswer,
} from '../data/confirm.js'
import { QUIZ_ITEMS } from '../data/quiz.js'
import { OFFICIAL_CONTACTS } from '../data/contacts.js'
import { DEMO_SCENARIOS } from '../data/demo.js'

// localStorage와 같은 모양(length·key 포함)의 메모리 저장소
function memoryStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}

const SC1 = DEMO_SCENARIOS[0].result

describe('링크 확인 요청 (F5-3)', () => {
  it('requestType 기본값은 가족 사칭', () => {
    const store = createConfirmStore({ storage: memoryStorage() })
    assert.equal(store.create(SC1).requestType, REQUEST_TYPES.IMPERSONATION)
  })

  it('링크 확인 답 3종을 받는다', () => {
    for (const a of Object.values(ANSWERS_LINK)) {
      const store = createConfirmStore({ storage: memoryStorage() })
      const req = store.create(SC1, { requestType: REQUEST_TYPES.LINK_CHECK })
      assert.equal(store.respond(req.id, a).answer, a)
    }
  })

  it('링크 확인 답은 판정을 바꾸지 않는다', () => {
    const caution = { ...SC1, level: '주의' }
    for (const a of Object.values(ANSWERS_LINK)) {
      assert.equal(applyFamilyAnswer(caution, a).level, '주의')
    }
  })
})

describe('최근 24시간 목록 (F5-10)', () => {
  it('24시간 지난 요청과 다른 키는 빼고, 최신순', () => {
    const storage = memoryStorage()
    let now = 0
    const store = createConfirmStore({ storage, clock: () => now })
    const old = store.create(SC1)
    now = 25 * 60 * 60 * 1000
    const a = store.create(SC1)
    now += 1000
    const b = store.create(SC1)
    storage.setItem('fs.consent.family', 'true')
    const ids = store.listRecent().map((r) => r.id)
    assert.deepEqual(ids, [b.id, a.id])
    assert.ok(!ids.includes(old.id))
  })

  it('저장소가 없으면 빈 배열', () => {
    assert.deepEqual(createConfirmStore({ storage: null }).listRecent(), [])
  })
})

describe('오늘의 퀴즈 고정 문항 (F7-4)', () => {
  it('id가 겹치지 않는다', () => {
    const ids = QUIZ_ITEMS.map((q) => q.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  for (const q of QUIZ_ITEMS) {
    it(`${q.id}: 정답 판정이 규칙 엔진 결과와 같다`, () => {
      assert.equal(decide({ signals_final: q.signals }).level, q.level)
    })
  }

  it('문항에 실제 번호·주소가 없다(마스킹 형태만)', () => {
    for (const q of QUIZ_ITEMS) {
      assert.doesNotMatch(q.message, /\d{2,4}-\d{3,4}-\d{4}|https?:\/\/|www\./)
    }
  })
})

describe('진짜라면 이렇게 와요 (F2-5)', () => {
  it('공식 번호마다 안내 문구가 있다', () => {
    for (const c of OFFICIAL_CONTACTS) assert.ok(c.normalNote?.length > 0, c.id)
  })
})
