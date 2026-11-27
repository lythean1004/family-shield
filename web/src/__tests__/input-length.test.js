import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { MAX_ANALYSIS_CHARS } from '../data/analyze.js'

const screen = buildSync({
  stdin: {
    contents: `import { renderToStaticMarkup } from 'react-dom/server'
      import { Outlet, Route, Routes } from 'react-router-dom'
      import { StaticRouter } from 'react-router-dom/server'
      import InputScreen from '../screens/InputScreen.jsx'
      export const render = text => renderToStaticMarkup(
        <StaticRouter location="/check/input"><Routes>
          <Route element={<Outlet context={{ text }} />}>
            <Route path="/check/input" element={<InputScreen />} />
          </Route>
        </Routes></StaticRouter>)`,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'jsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
})
const module = { exports: {} }
new Function('module', 'exports', 'require', screen.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url))

it('이모지가 포함된 2000자를 입력창이 먼저 자르지 않고 다음 단계로 보낸다', () => {
  const text = '가'.repeat(MAX_ANALYSIS_CHARS - 1) + '📚'
  const html = module.exports.render(text)
  assert.equal(/<textarea\b[^>]*\bmaxlength\s*=/i.test(html), false)
  assert.ok(html.includes(text + '</textarea>'))
  assert.ok(html.includes('2000 / 2000자'))
  assert.ok(html.includes('aria-disabled="false">다음'))
})

it('초과 입력 전체를 편집할 수 있게 보존하고 다음 버튼과 길이 안내를 연결한다', () => {
  const text = '가'.repeat(MAX_ANALYSIS_CHARS) + '끝'
  const html = module.exports.render(text)
  assert.ok(html.includes(text + '</textarea>'))
  assert.ok(html.includes('2001 / 2000자'))
  assert.ok(html.includes('aria-disabled="true">다음'))
  assert.ok(html.includes('aria-describedby="fs-input-count fs-input-limit"'))
  assert.ok(html.includes('글이 너무 길어요. 2000자 이내로 줄여 주세요.'))
})
