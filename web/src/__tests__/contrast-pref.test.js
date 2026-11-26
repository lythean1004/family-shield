import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyContrast, nextPref, readPref, resolveContrast } from '../data/contrast-pref.js'

describe('기기에 저장한 대비 설정', () => {
  for (const [value, expected] of [[null, 'auto'], ['invalid', 'auto'], ['auto', 'auto'], ['high', 'high'], ['normal', 'normal']]) {
    it(`저장값 ${value} → ${expected}`, () => {
      const storage = { getItem(key) { assert.equal(key, 'fs-contrast'); return value } }
      assert.equal(readPref(storage), expected)
    })
  }

  it('저장소를 읽을 수 없으면 자동 설정을 쓴다', () => {
    assert.equal(readPref({ getItem() { throw new Error('접근 제한') } }), 'auto')
    assert.equal(readPref(null), 'auto')
  })
})

describe('실제 화면에 적용할 대비', () => {
  for (const prefersMore of [false, true]) {
    for (const forcedColors of [false, true]) {
      it(`자동 및 직접 선택 · 대비 높이기 ${prefersMore}, 강제 색 ${forcedColors}`, () => {
        const system = { prefersMore, forcedColors }
        assert.equal(resolveContrast('auto', system), prefersMore || forcedColors ? 'high' : 'normal')
        assert.equal(resolveContrast('high', system), 'high')
        assert.equal(resolveContrast('normal', system), 'normal')
      })
    }
  }

  it('현재 보이는 모드의 반대로 전환한다', () => {
    assert.equal(nextPref('normal'), 'high')
    assert.equal(nextPref('high'), 'normal')
  })

  it('문서 루트에 실제 모드를 적용한다', () => {
    const attrs = new Map()
    const doc = { documentElement: { setAttribute: (key, value) => attrs.set(key, value) } }
    for (const mode of ['high', 'normal']) {
      applyContrast(doc, mode)
      assert.equal(attrs.get('data-contrast'), mode)
    }
  })
})
