// 대비 수치 출력: node web/scripts/contrast-report.mjs
import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const t = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))[1]
const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const pairs = [
  ['c-text', 'c-bg'], ['c-text-sub', 'c-bg'], ['c-text-sub', 'c-surface'], ['c-text-sub', 'c-danger-bg'],
  ['c-action-text', 'c-action'], ['c-action', 'c-bg'], ['c-action', 'c-surface'],
  ['c-danger', 'c-danger-bg'], ['c-bg', 'c-danger'], ['c-caution', 'c-caution-bg'], ['c-check', 'c-check-bg'],
  ['c-focus', 'c-bg'],
]
for (const [f, b] of pairs) console.log(`${(`--${f} / --${b}`).padEnd(34)} ${ratio(t(f), t(b)).toFixed(2)}:1`)
