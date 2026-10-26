// WCAG AA 대비 검사 (screen-spec 2장: 본문 4.5:1, 큰 글씨 3:1)
// index.css의 색 토큰을 직접 읽어서 실제로 쓰는 글자색/배경색 쌍을 잰다.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// [설명, 글자, 배경, 기준]. 부모님 화면 작은 글씨도 24px라 큰 글씨지만, 보호자 화면(14px)에서도
// 같은 색을 쓰므로 본문 기준 4.5를 적용한다. 버튼 테두리(비텍스트)는 3:1.
const PAIRS = [
  ['본문', 'c-text', 'c-bg', 4.5],
  ['보조 문구(배경)', 'c-text-sub', 'c-bg', 4.5],
  ['보조 문구(카드)', 'c-text-sub', 'c-surface', 4.5],
  ['보조 문구(위험 배경, P6 상태줄)', 'c-text-sub', 'c-danger-bg', 4.5],
  ['기본 버튼 글자', 'c-action-text', 'c-action', 4.5],
  ['보조 버튼 글자·글자 링크', 'c-action', 'c-bg', 4.5],
  ['번호 카드 번호', 'c-action', 'c-surface', 4.5],
  ['위험', 'c-danger', 'c-danger-bg', 4.5],
  ['위험 버튼 글자', 'c-bg', 'c-danger', 4.5],
  ['주의', 'c-caution', 'c-caution-bg', 4.5],
  ['확인 필요', 'c-check', 'c-check-bg', 4.5],
  ['초점 테두리', 'c-focus', 'c-bg', 3],
]

describe('WCAG AA 대비', () => {
  for (const [label, fg, bg, min] of PAIRS) {
    it(`${label}: --${fg} / --${bg} >= ${min}:1`, () => {
      const r = contrast(token(fg), token(bg))
      assert.ok(r >= min, `${r.toFixed(2)}:1`)
    })
  }

  it('계산 확인: 검정/흰색 = 21:1', () => {
    assert.equal(Math.round(contrast('#000000', '#ffffff')), 21)
  })
})
