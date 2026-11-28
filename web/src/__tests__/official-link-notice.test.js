import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { analyze } from '../../../packages/core/src/pipeline.js'
import { OFFICIAL_LINK_TEXT } from '../../../packages/core/src/fixed-text.js'
import { filterExplanation } from '../../../packages/core/src/validator.js'
import { AI_FALLBACK_TEXT } from '../data/result.js'
import { officialLinkReviewCases } from '../../../packages/core/test/fixtures/official-link-review.js'

// 실제 ResultView를 메모리에서 번들·렌더링한다. 브라우저·서버·외부 링크 호출과 임시 파일 쓰기 없음.
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

describe('공식 주소 안내 교차 사례 — 실제 웹 결과 화면', () => {
  for (const c of officialLinkReviewCases) it(c.name, async () => {
    const result = await analyze({ text: c.text, parentInputs: c.parentInputs })
    assert.equal(result.level, c.level)
    const html = module.exports.render(result)
    assert.equal(html.includes(OFFICIAL_LINK_TEXT), c.notice)
    const label = c.level === '확인필요' ? '확인 필요' : c.level
    assert.ok(html.includes(`<span class="verdict-banner__label">${label}</span>`))
  })
})

it('검증 뒤 설명이 모두 사라져도 받은 신호와 고정 안내를 화면에 표시한다', () => {
  const html = module.exports.render({ level: '주의', signals_final: ['SIG_PERSONAL_INFO'],
    fallback_used: false, explanation_for_parent: filterExplanation(['이상이 없어요.']) })
  assert.ok(html.includes('signal-list__item'))
  assert.ok(html.includes(AI_FALLBACK_TEXT))
  assert.ok(!html.includes('만들지 못했어요')) // 저장된 결과도 설명만 비어 있을 수 있다.
  assert.ok(!html.includes('이상이 없어요.'))
})

// 인공지능기본법 제31조②(결정 7A): AI가 만든 설명을 보여 줄 때만 그 사실을 표시한다
import { AI_EXPLANATION_NOTE } from '../../../packages/core/src/fixed-text.js'
describe('AI 생성 설명 표시 — 실제 웹 결과 화면', () => {
  const base = { level: '주의', signals_final: ['SIG_LINK'], fired_rules: ['R7'], impersonation_type: 'none' }
  it('AI 설명이 있으면 표시한다', () => {
    const html = module.exports.render({ ...base, explanation_for_parent: ['링크를 누르게 해요.'], fallback_used: false })
    assert.ok(html.includes('링크를 누르게 해요.'))
    assert.ok(html.includes(AI_EXPLANATION_NOTE))
  })
  it('고정 문장으로 바뀌면 표시하지 않는다', () => {
    const html = module.exports.render({ ...base, explanation_for_parent: [], fallback_used: true })
    assert.ok(!html.includes(AI_EXPLANATION_NOTE))
  })
})
