// 부모님 판별 흐름의 현재 상태 (P2 → P4 → P6 → P8)
//
// 1회용 토큰(D34)은 한 번 조회하면 사라지므로, 받은 결과를 이 탭의 sessionStorage에만 둔다.
// 탭을 닫으면 사라진다. 원문은 처음부터 없다(스킬 서버가 화면용 필드만 보냄).
const KEY_RESULT = 'fs.current.result'
const KEY_REQUEST = 'fs.current.request'

function ss() {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage
}

export function saveCurrentResult(result) {
  ss()?.setItem(KEY_RESULT, JSON.stringify(result))
}

export function loadCurrentResult() {
  try { return JSON.parse(ss()?.getItem(KEY_RESULT) ?? 'null') } catch { return null }
}

export function saveCurrentRequestId(id) {
  ss()?.setItem(KEY_REQUEST, id)
}

export function loadCurrentRequestId() {
  return ss()?.getItem(KEY_REQUEST) ?? null
}

/**
 * 1회용 토큰으로 결과를 받아 온다(PRD 13-4). 스킬 서버 GET /api/result?t=…
 * @returns {Promise<{ ok: true, result: object } | { ok: false, reason: 'used'|'expired'|'missing'|'network' }>}
 */
export async function fetchResultByToken(token, { fetchImpl = fetch, base = '' } = {}) {
  try {
    const res = await fetchImpl(`${base}/api/result?t=${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await res.json().catch(() => null)
    if (res.ok && body?.ok && body.result) return { ok: true, result: body.result }
    return { ok: false, reason: body?.reason ?? 'missing' }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
