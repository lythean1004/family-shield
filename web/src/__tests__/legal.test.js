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

// 보수적 보강(11/28, 사무국·중계 답변 없음 가정, 대기업 처리방침 형식 참고): v2
import { LEGAL_VERSION } from '../data/legal.js'
describe('처리방침 v2 보수적 보강', () => {
  const sec = (k) => PRIVACY.sections.find((s) => s.h.includes(k))
  const text = (s) => [s.h, ...(s.p ?? []), ...(s.rows ?? []).flat()].join('\n')
  it('문서 버전이 v2다', () => {
    assert.equal(LEGAL_VERSION, 'legal-2026-11-28-v2')
  })
  it('국외 이전의 법적 근거(별도 동의)와 받는 곳 연락처 확인 중을 적는다', () => {
    const t = text(sec('국외 이전'))
    assert.match(t, /제28조의8 제1항 제1호/)
    assert.match(t, /별도/)
    assert.match(t, /연락처.*확인 중/)
  })
  it('위탁: 재위탁 확인 중, 확인 못 한 곳은 확인 중으로 적는다', () => {
    const t = text(sec('처리 위탁'))
    assert.match(t, /재위탁/)
    assert.match(t, /확인 중/)
  })
  it('거부·철회 뒤 이미 보낸 문장의 보관을 숨기지 않는다', () => {
    const t = text(sec('거부 방법'))
    assert.match(t, /이미 보낸/)
  })
  it('건강정보 처리를 코드와 같게 적는다(요구·미끼가 있으면 가린 뒤 보냄)', () => {
    const t = text(sec('2. 문자를'))
    assert.doesNotMatch(t, /동의와 관계없이 해외 AI로 보내지 않습니다/)
    assert.match(t, /\[건강정보\]/)
  })
  it('생성형 AI 안내: 학습 이용·학습 거부 방법·이상한 답 알리기·검증 실패 시 고정 문장', () => {
    const t = text(sec('인공지능'))
    assert.match(t, /학습/)
    assert.match(t, /동의를 철회/)
    assert.match(t, /이 판정이 이상해요/)
    assert.match(t, /고정 문장/)
  })
  it('자동화된 결정 안내: 규칙이 자동으로 정하고 참고용, 설명·이의 요청 방법', () => {
    const t = text(sec('인공지능'))
    assert.match(t, /자동으로/)
    assert.match(t, /이의/)
  })
})
