// 판정 아이콘 SVG(D33)가 브라우저에서 깨지지 않는지: XML 주석 안 "--" 금지 등 기본 형식 검사
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const dir = new URL('../../public/icons/', import.meta.url)

describe('판정 아이콘 SVG', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.svg'))

  it('세 가지가 있다', () => {
    assert.deepEqual(files.sort(), ['icon-caution.svg', 'icon-check.svg', 'icon-danger.svg'])
  })

  for (const f of files) {
    it(`${f}: 주석 안에 "--"가 없다(있으면 XML 오류로 아이콘이 안 보임)`, () => {
      const svg = readFileSync(new URL(f, dir), 'utf8')
      for (const m of svg.matchAll(/<!--([\s\S]*?)-->/g)) assert.ok(!m[1].includes('--'), m[1])
      assert.match(svg.trim(), /^<svg[\s\S]*<\/svg>$/)
    })
  }
})
