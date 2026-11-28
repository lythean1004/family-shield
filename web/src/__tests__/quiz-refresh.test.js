// 멘토링(2026-11-26): 퀴즈가 최신 내용으로 바뀌도록. 같은 날에는 같은 문항(결정적), 날이 바뀌면 순서가 바뀐다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { QUIZ_ITEMS, quizForDate, QUIZ_DAILY_COUNT } from '../data/quiz.js'
import { decide } from '../../../packages/core/src/rule-engine.js'

const d = (s) => new Date(`${s}T09:00:00+09:00`)

describe('오늘의 퀴즈 고르기', () => {
  it('하루 문항 수는 정해진 개수', () => {
    assert.equal(quizForDate(QUIZ_ITEMS, d('2026-11-26')).length, QUIZ_DAILY_COUNT)
  })
  it('같은 날에는 언제 열어도 같은 문항', () => {
    const a = quizForDate(QUIZ_ITEMS, new Date('2026-11-26T00:10:00+09:00')).map((q) => q.id)
    const b = quizForDate(QUIZ_ITEMS, new Date('2026-11-26T23:50:00+09:00')).map((q) => q.id)
    assert.deepEqual(a, b)
  })
  it('날이 바뀌면 문항 구성이 바뀐다', () => {
    const a = quizForDate(QUIZ_ITEMS, d('2026-11-26')).map((q) => q.id).join()
    const b = quizForDate(QUIZ_ITEMS, d('2026-11-27')).map((q) => q.id).join()
    assert.notEqual(a, b)
  })
  it('이번 달 시즌 문항이 맨 앞에 온다', () => {
    const seasonal = QUIZ_ITEMS.filter((q) => q.months?.includes(11)).map((q) => q.id)
    assert.ok(seasonal.length > 0)
    const first = quizForDate(QUIZ_ITEMS, d('2026-11-26')).slice(0, seasonal.length).map((q) => q.id)
    assert.deepEqual(first.sort(), [...seasonal].sort())
  })
  it('시즌이 아닌 달에는 시즌 문항을 보여 주지 않는다(지난 경고)', () => {
    const offSeason = new Set(QUIZ_ITEMS.filter((q) => q.months?.length && !q.months.includes(6)).map((q) => q.id))
    for (let day = 1; day <= 30; day++) {
      const ids = quizForDate(QUIZ_ITEMS, d(`2026-06-${String(day).padStart(2, '0')}`)).map((q) => q.id)
      assert.equal(ids.some((id) => offSeason.has(id)), false)
    }
  })
  it('같은 문항이 두 번 나오지 않는다', () => {
    for (const day of ['2026-11-26', '2026-12-01', '2027-01-05']) {
      const ids = quizForDate(QUIZ_ITEMS, d(day)).map((q) => q.id)
      assert.equal(new Set(ids).size, ids.length)
    }
  })
  it('시즌 문항은 공식 출처 주소와 확인일이 있다', () => {
    for (const q of QUIZ_ITEMS.filter((q) => q.months?.length)) {
      assert.match(q.source?.url ?? '', /^https:\/\//, q.id)
      assert.match(q.source?.checked_at ?? '', /^\d{4}-\d{2}-\d{2}$/, q.id)
    }
  })
  it('새 문항도 정답 판정이 규칙 엔진과 같다', () => {
    for (const q of QUIZ_ITEMS) assert.equal(decide({ signals_final: q.signals }).level, q.level, q.id)
  })
})

// 12월 시즌 갱신(2026-11-28): 12월에는 공식 경고문 기반 시즌 문항이 2개 이상 맨 앞에 온다
describe('12월 시즌 문항', () => {
  it('12월 첫날 퀴즈의 앞 2문항이 시즌 문항이고, 출처가 2026-11 이후 확인됐다', () => {
    const first = quizForDate(QUIZ_ITEMS, d('2026-12-01')).slice(0, 2)
    for (const q of first) {
      assert.ok(q.months?.includes(12), q.id)
      assert.ok(q.source.checked_at >= '2026-11-01', q.id)
    }
  })
})
