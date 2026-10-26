// 가족 확인 흐름(P2·P6·P8·C2·C3)과 토큰 조회, 오판 신고 데이터 검사
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANSWERS, createConfirmStore, applyFamilyAnswer, applyCallContext, toGuardianSummary, formatTime,
} from '../data/confirm.js'
import { fetchResultByToken } from '../data/session.js'
import { toMisjudgeRecord, recordMisjudge } from '../data/misjudge.js'
import { DEMO_SCENARIOS } from '../data/demo.js'

function memoryStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => [...m.values()].join('\n'),
  }
}

const SC1 = DEMO_SCENARIOS[0].result
const SC4 = DEMO_SCENARIOS[3].result
const CAUTION = {
  level: '주의', fired_rules: ['R7'], signals_final: ['SIG_FAMILY_IMPERSONATION', 'SIG_NEW_NUMBER'],
  impersonation_type: 'family', impersonated_relation: '아들', explanation_for_parent: ['원문 일부가 들어간 설명'],
}

describe('확인 요청 저장소 (F5)', () => {
  it('만들면 pending, 보낸 시각이 있다', () => {
    const store = createConfirmStore({ storage: memoryStorage(), clock: () => 1000 })
    const req = store.create(SC1)
    assert.equal(req.state, 'pending')
    assert.equal(req.sentAt, 1000)
    assert.deepEqual(store.get(req.id), req)
  })

  it('보호자에게는 F5-8 범위만 넘긴다(설명·사칭 유형·규칙 없음)', () => {
    const storage = memoryStorage()
    const store = createConfirmStore({ storage })
    const req = store.create(CAUTION, { senderLast4: '1234' })
    assert.deepEqual(Object.keys(req.summary).sort(), ['impersonated_relation', 'level', 'sender_last4', 'signals_final'])
    assert.ok(!storage.dump().includes('원문 일부'), '저장소에 AI 설명이 없다')
  })

  it('끝 4자리는 숫자 4개일 때만', () => {
    assert.equal(toGuardianSummary(SC1, '12a4').sender_last4, null)
    assert.equal(toGuardianSummary(SC1, null).sender_last4, null)
    assert.equal(toGuardianSummary(SC1, '5678').sender_last4, '5678')
  })

  it('응답은 한 번만(F5-4)', () => {
    const store = createConfirmStore({ storage: memoryStorage(), clock: () => 5 })
    const req = store.create(SC1)
    const first = store.respond(req.id, ANSWERS.NOT_SENT)
    assert.equal(first.state, 'responded')
    assert.equal(first.respondedAt, 5)
    const second = store.respond(req.id, ANSWERS.SENT)
    assert.equal(second.answer, ANSWERS.NOT_SENT)
  })

  it('모르는 답은 거부', () => {
    const store = createConfirmStore({ storage: memoryStorage() })
    const req = store.create(SC1)
    assert.throws(() => store.respond(req.id, 'maybe'))
  })

  it('감염 의심 표시(F6-3)', () => {
    const store = createConfirmStore({ storage: memoryStorage() })
    const req = store.create(SC1)
    store.markDeviceSuspect(req.id)
    assert.equal(store.get(req.id).deviceSuspect, true)
  })

  it('없는 요청은 null', () => {
    assert.equal(createConfirmStore({ storage: memoryStorage() }).get('nope'), null)
  })
})

describe('가족 답 반영 (P8, 원칙 2: 올라가기만)', () => {
  it('보낸 적 없어요 → 주의도 위험(R5)', () => {
    const r = applyFamilyAnswer(CAUTION, ANSWERS.NOT_SENT)
    assert.equal(r.level, '위험')
    assert.ok(r.fired_rules.includes('R5'))
  })

  it('보낸 적 없어요 → 확인 필요도 위험, R8은 빠진다', () => {
    const r = applyFamilyAnswer(SC4, ANSWERS.NOT_SENT)
    assert.equal(r.level, '위험')
    assert.ok(!r.fired_rules.includes('R8'))
  })

  it('제가 보냈어요 → 판정 그대로(F5-5)', () => {
    assert.equal(applyFamilyAnswer(SC1, ANSWERS.SENT).level, '위험')
    assert.equal(applyFamilyAnswer(CAUTION, ANSWERS.SENT).level, '주의')
  })

  it('전화할게요 → 판정 그대로', () => {
    assert.equal(applyFamilyAnswer(CAUTION, ANSWERS.WILL_CALL).level, '주의')
  })
})

describe('전화 여부 반영 (P2, R2)', () => {
  const linkOnly = { level: '주의', fired_rules: ['R7'], signals_final: ['SIG_LINK'] }

  it('전화 받았어요 + 링크 → 위험(R2)', () => {
    const r = applyCallContext(linkOnly, { calledBefore: true })
    assert.equal(r.level, '위험')
    assert.ok(r.fired_rules.includes('R2'))
  })

  it('전화 없었어요 → 그대로', () => {
    assert.equal(applyCallContext(linkOnly, { calledBefore: false }), linkOnly)
  })

  it('이미 위험이면 그대로(내려가지 않음)', () => {
    assert.equal(applyCallContext(SC1, { calledBefore: true }).level, '위험')
  })
})

describe('시각 표시', () => {
  it('오후 3:12 형식', () => {
    assert.equal(formatTime(new Date(2026, 9, 27, 15, 12).getTime()), '오후 3:12')
    assert.equal(formatTime(new Date(2026, 9, 27, 0, 5).getTime()), '오전 12:05')
  })
})

describe('1회용 토큰 조회 (D34)', () => {
  const reply = (status, body) => async () => ({ ok: status === 200, status, json: async () => body })

  it('200이면 결과', async () => {
    const r = await fetchResultByToken('t', { fetchImpl: reply(200, { ok: true, result: SC1 }) })
    assert.deepEqual(r, { ok: true, result: SC1 })
  })

  it('410이면 이유(used/expired/missing)', async () => {
    const r = await fetchResultByToken('t', { fetchImpl: reply(410, { ok: false, reason: 'used' }) })
    assert.deepEqual(r, { ok: false, reason: 'used' })
  })

  it('네트워크 오류면 network', async () => {
    const r = await fetchResultByToken('t', { fetchImpl: async () => { throw new Error('x') } })
    assert.deepEqual(r, { ok: false, reason: 'network' })
  })

  it('토큰을 주소에 인코딩해서 보낸다', async () => {
    let url
    await fetchResultByToken('a b&c', { fetchImpl: async (u) => { url = u; return { ok: false, json: async () => ({}) } } })
    assert.equal(url, '/api/result?t=a%20b%26c')
  })
})

describe('오판 신고 (F4-13)', () => {
  it('신호·판정·이유만 기록(설명·관계 없음)', () => {
    const rec = toMisjudgeRecord(CAUTION, 'false_alarm', 0)
    assert.deepEqual(Object.keys(rec).sort(), ['created_at', 'fired_rules', 'level', 'reason', 'signals_final'])
  })

  it('모르는 이유는 거부', () => {
    assert.throws(() => toMisjudgeRecord(SC1, 'whatever'))
  })

  it('기기에 최대 50건', () => {
    const storage = memoryStorage()
    for (let i = 0; i < 55; i++) recordMisjudge(SC1, 'other', storage)
    assert.equal(JSON.parse(storage.getItem('fs.misjudge')).length, 50)
  })
})
