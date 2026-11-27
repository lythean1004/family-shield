import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../../../packages/core/src/rule-engine.js'
import { analyzeText, canAnalyzeText } from '../data/analyze.js'

const TEXT = '오늘 도서관 이용 안내입니다.'

describe('최초 웹 판별에 통화 답변을 전달하는 흐름', () => {
  const answers = [
    ['none', { called_before: false }, [], '확인필요', 'R8'],
    ['none', { called_before: false }, ['SIG_LINK'], '주의', 'R7'],
    ['earlier', { called_before: true }, [], '확인필요', 'R8'],
    ['earlier', { called_before: true }, ['SIG_LINK'], '위험', 'R2'],
    ['in_progress', { call_in_progress: true }, [], '위험', 'R1'],
  ]
  for (const [answer, expectedInputs, signals, expectedLevel, expectedRule] of answers) {
    it(`${answer} 답변의 입력만 보내고 ${expectedRule} 규칙 판정을 반영한다`, async () => {
      const fetchImpl = async (url, request) => {
        assert.equal(url, '/api/analyze')
        assert.equal(request.method, 'POST')
        assert.equal(request.cache, 'no-store')
        const payload = JSON.parse(request.body)
        assert.deepEqual(payload, { text: TEXT, parentInputs: expectedInputs })
        const result = decide({ ...payload.parentInputs, signals_final: signals })
        return { status: 200, json: async () => ({ ok: true, result }) }
      }
      const result = await analyzeText(TEXT, answer, { fetchImpl })
      assert.equal(result.level, expectedLevel)
      assert.ok(result.fired_rules.includes(expectedRule))
    })
  }

  it('미선택 답변을 보내지 않는다', async () => {
    let requests = 0
    const fetchImpl = async () => { requests += 1 }
    await assert.rejects(analyzeText(TEXT, undefined, { fetchImpl }), /통화 상태/)
    assert.equal(requests, 0)
  })

  it('길이 제한과 빈 입력 기준을 적용한다', () => {
    assert.equal(canAnalyzeText('  '), false)
    assert.equal(canAnalyzeText('안 '), false)
    assert.equal(canAnalyzeText('가'.repeat(2000)), true)
    assert.equal(canAnalyzeText('가'.repeat(2001)), false)
  })
})
