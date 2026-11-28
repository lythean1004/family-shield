// 카카오 답 ↔ 웹 [자세히 보기] 일치 (docs/plan-kakao-web-consistency.md, 운영자 A안, 2026-11-28)
// 실제 카카오 핸들러로 답을 만들고, 운영과 같은 DB 저장 형태(checkColumns → rowResult)로 저장·복원한 뒤
// 실제 ResultView를 그려 같은 고정 안내가 양쪽에 있는지 비교한다. 외부 호출 없음(가짜 AI 게이트웨이).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { handleRequest } from '../../../skill/src/handler.js'
import { checkColumns, rowResult } from '../../../skill/src/results.js'
import * as T from '../../../packages/core/src/fixed-text.js'

const bundled = buildSync({
  stdin: {
    contents: `import { renderToStaticMarkup } from 'react-dom/server';
      import { StaticRouter } from 'react-router-dom/server';
      import ResultView from '../components/ResultView.jsx';
      export const render = result => renderToStaticMarkup(
        <StaticRouter location="/check/result"><ResultView result={result} /></StaticRouter>);`,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'jsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  alias: { '@core': fileURLToPath(new URL('../../../packages/core/src', import.meta.url)) },
  define: { 'process.env.NODE_ENV': '"production"' },
})
const module = { exports: {} }
new Function('module', 'exports', 'require', bundled.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url))
const unescape = (h) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

// 운영 DB 저장소와 같은 모양: 정해진 칸만 저장했다가 다시 읽는다(AI 문장은 저장하지 않음)
function dbLikeStore() {
  const rows = new Map(); let n = 0
  return {
    put(result) { const t = `t${++n}`; rows.set(t, rowResult(checkColumns(result))); return t },
    redeem(t) { return rows.has(t) ? { ok: true, result: rows.get(t) } : { ok: false, reason: 'missing' } },
  }
}
function gateway(explanation) {
  return async () => ({
    ok: true, status: 200, headers: { get: () => null },
    json: async () => ({ model: 'fake', usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{ finish_reason: 'tool_calls', message: {
      tool_calls: [{ function: { name: 'report_signals', arguments: JSON.stringify({
        signals: ['SIG_MONEY'], impersonation_type: 'none', impersonated_relation: null, evidence_card_ids: [], explanation_for_parent: explanation }) } }] } }] }),
  })
}
const failing = async () => { throw new Error('timeout') }

const MESSAGES = {
  danger: '엄마 나야. 폰 액정 깨져서 임시 번호야. 지금 문화상품권 30만원어치 사서 핀번호 보내줘. 급해',
  link: '[택배] 주소지 불일치로 배송이 보류되었습니다. 주소 수정 http://example.com/a',
  check: '안녕하세요. 지난번에 말씀드린 모임 장소가 바뀌었어요. 확인 부탁드려요.',
  health: '[○○의원] 내일 오전 10시 건강검진 예약 안내드립니다.',
  short: '[택배] 배송지 확인이 필요합니다 bit.ly/3abcXyz',
  official: '[CJ대한통운] 고객님의 상품이 배송 완료되었습니다. 조회 cjlogistics.com',
}
const AI = {
  explained: { consent: 'granted', fetchImpl: gateway(['돈을 먼저 보내라고 해요. 보내기 전에 직접 확인하세요.']) },
  failed: { consent: 'granted', fetchImpl: failing },
  unknown: { consent: 'unknown' },
  refused: { consent: 'refused' },
}
const SHARED = ['CHECK_LEVEL_TEXT', 'SHORT_URL_TEXT', 'OFFICIAL_LINK_TEXT', 'HEALTH_SKIPPED_TEXT', 'AI_DECLINED_TEXT', 'RULES_ONLY_TEXT']
const seen = new Set()

describe('카카오 답과 웹 [자세히 보기]가 같은 안내를 보여 준다', () => {
  for (const [mk, text] of Object.entries(MESSAGES)) for (const [ak, a] of Object.entries(AI)) {
    it(`${mk} × ${ak}`, async () => {
      const store = dbLikeStore()
      const ai = a.fetchImpl ? { model: 'fake', apiKey: 'k', timeoutMs: 1000, promptVersion: 'v1', fetchImpl: a.fetchImpl } : null
      const r = await handleRequest({ utterance: text }, { ai, aiConsent: a.consent, hmacKey: null, cards: [], webBaseUrl: 'https://x.test', resultStore: store })
      const kakao = r.body.template.outputs.find((o) => o.simpleText).simpleText.text
      const url = r.body.template.outputs.flatMap((o) => o.textCard?.buttons ?? []).find((b) => b.label === '자세히 보기')?.webLinkUrl
      assert.ok(url, '자세히 보기 링크')
      const stored = store.redeem(new URL(url).searchParams.get('t')).result
      seen.add(stored.ai_state)
      const web = unescape(module.exports.render(stored))
      for (const k of SHARED) assert.equal(web.includes(T[k]), kakao.includes(T[k]), `${k}\n카카오: ${kakao}\n웹: ${web.replace(/<[^>]+>/g, ' ')}`)
      // AI 설명은 저장하지 않는다: 카카오에 AI 설명이 있었으면 웹은 “카카오톡 답에 있어요”로 알려 준다
      assert.equal(web.includes(T.AI_EXPLANATION_ELSEWHERE_TEXT), kakao.includes(T.AI_EXPLANATION_NOTE), '설명 위치 안내')
      assert.ok(!web.includes('표시할 추가 설명이 없어요') || !kakao.includes(T.AI_EXPLANATION_NOTE), 'AI 설명이 있었는데 “없어요”라고 하지 않는다')
      const label = stored.level === '확인필요' ? '확인 필요' : stored.level
      assert.ok(web.includes(label))
    })
  }
  it('모든 AI 상태를 한 번 이상 지나갔다', () => {
    for (const s of ['explained', 'rules_only', 'declined', 'health', 'fallback']) assert.ok(seen.has(s), s)
  })
})
