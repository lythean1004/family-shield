// 전체 메뉴 (TopNav): 죽은 링크가 없고, 비상 화면은 항상 메뉴에 있어야 한다
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NAV_ITEMS, showNav } from '../data/nav.js'

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const routes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]))

describe('전체 메뉴', () => {
  it('모든 항목이 App.jsx에 있는 화면으로 간다', () => {
    const dead = NAV_ITEMS.filter((i) => !routes.has(i.to)).map((i) => i.to)
    assert.deepEqual(dead, [])
  })

  it('처음 화면과 사후 대응(이미 눌렀거나 보냈어요)은 항상 있다', () => {
    const tos = NAV_ITEMS.map((i) => i.to)
    assert.ok(tos.includes('/'))
    assert.ok(tos.includes('/help'))
  })

  it('항목 주소와 이름이 겹치지 않는다', () => {
    assert.equal(new Set(NAV_ITEMS.map((i) => i.to)).size, NAV_ITEMS.length)
    assert.equal(new Set(NAV_ITEMS.map((i) => i.label)).size, NAV_ITEMS.length)
  })

  it('부모님·공개 화면에는 보인다', () => {
    for (const p of ['/', '/demo', '/contacts', '/check/result', '/check/wait', '/quiz', '/없는주소']) {
      assert.equal(showNav(p), true, p)
    }
  })

  it('보호자 화면과 공유 중간 화면에는 숨긴다', () => {
    for (const p of ['/family', '/family/dashboard', '/family/req/abc', '/share']) {
      assert.equal(showNav(p), false, p)
    }
  })

  it('/familyx 같은 비슷한 주소까지 숨기지는 않는다', () => {
    assert.equal(showNav('/familyx'), true)
  })
})
