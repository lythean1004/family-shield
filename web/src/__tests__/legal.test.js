// 처리방침·약관 게시본 검사 (compliance-plan 4단계, 멘토 Q2·Q3·Q9·Q13)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRIVACY, TERMS, LEGAL_NOTICE } from '../data/legal.js'

const all = (doc) => doc.sections.flatMap((s) => [s.h, ...(s.p ?? []), ...(s.head ?? []), ...(s.rows ?? []).flat()]).join('\n')
const privacy = all(PRIVACY)
const terms = all(TERMS)

describe('개인정보 처리방침', () => {
  it('국외 이전 5요소(항목·국가·시기와 방법·받는 자·목적과 보유 기간)와 거부 방법이 있다', () => {
    const transfer = PRIVACY.sections.find((s) => s.h.includes('국외 이전'))
    assert.deepEqual(transfer.head, ['이전받는 자', '국가', '항목', '시기·방법', '목적', '보유 기간'])
    assert.ok(transfer.rows.some((r) => r[0].includes('Google')) && transfer.rows.some((r) => r[0].includes('Anthropic')))
    assert.match(privacy, /거부해도 문자 확인은 됩니다/)
  })
  it('확인되지 않은 것은 확인 중·가장 넓게로 적는다', () => {
    assert.match(privacy, /확인 중/)
    assert.match(privacy, /최대 2년/)
    assert.match(privacy, /학습 이용 여부 확인 중/)
  })
  it('카카오 해외 AI 동의와 끄는 방법(D59)을 적는다', () => {
    assert.match(privacy, /카카오 동의 기록/)
    assert.match(privacy, /AI 끄기/)
  })
  it('원문 미저장, 위험 단계는 규칙이 정함, 한계 문구를 적는다', () => {
    assert.match(privacy, /문자 원문은 어디에도 저장하지 않습니다/)
    assert.match(privacy, /위험 단계는 AI가 아니라/)
    assert.match(privacy, /직접 찾은 공식 번호로 확인하세요/)
  })
})

describe('이용약관', () => {
  it('안전 판정 없음, 놓침·오경보 가능, 종료 사전 안내를 적는다', () => {
    assert.match(terms, /‘안전’ 판정을 하지 않습니다/)
    assert.match(terms, /놓칠 수 있습니다/)
    assert.match(terms, /따로 알립니다/)
  })
  it('포괄 면책 조항을 두지 않는다(멘토 Q9)', () => {
    assert.doesNotMatch(terms, /책임(?:을|이)?\s*(?:지지\s*않|없습니다|제한될)/)
  })
})

describe('공통', () => {
  it('검수 완료라고 쓰지 않고 시험 운영·검토 전임을 밝힌다', () => {
    assert.doesNotMatch(privacy + terms + LEGAL_NOTICE, /검수 완료/)
    assert.match(LEGAL_NOTICE, /전문가 검토 전/)
  })
  it('운영자 연락처(이메일·전화)를 소스에 넣지 않는다', () => {
    const src = readFileSync(new URL('../data/legal.js', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /[\w.+-]+@[\w-]+\.[\w.]+/)
    assert.doesNotMatch(src, /01[016789]-?\d{3,4}-?\d{4}/)
  })
  it('모든 화면 하단에 처리방침·약관 링크가 있다', () => {
    const footer = readFileSync(new URL('../components/NoLinkFooter.jsx', import.meta.url), 'utf8')
    assert.match(footer, /to="\/privacy"/)
    assert.match(footer, /to="\/terms"/)
  })
})

// 준비 계획 5단계(D60): 운영 기간 안내. 문구는 legal.js 한 곳, 첫 화면과 가입 화면에 보인다
import { SERVICE_PERIOD_NOTICE } from '../data/legal.js'
describe('운영 기간 안내 (D60)', () => {
  it('12월 말까지 운영, 멈추는 날은 따로 알림, 멈춘 뒤 개인정보 파기를 적는다', () => {
    assert.match(SERVICE_PERIOD_NOTICE, /12월 말까지/)
    assert.match(SERVICE_PERIOD_NOTICE, /따로 알려/)
    assert.match(SERVICE_PERIOD_NOTICE, /지워요/)
    assert.doesNotMatch(SERVICE_PERIOD_NOTICE, /12월 11일|12\/11/)
  })
  it('첫 화면과 가입 화면에 보인다', () => {
    for (const f of ['HomeScreen.jsx', 'SetupScreen.jsx']) {
      const src = readFileSync(new URL(`../screens/${f}`, import.meta.url), 'utf8')
      assert.match(src, /SERVICE_PERIOD_NOTICE/, f)
    }
  })
})
