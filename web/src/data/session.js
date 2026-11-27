// 부모님 판별 흐름의 현재 상태 (P2 → P4 → P6 → P8)
//
// 1회용 토큰(D34)은 한 번 조회하면 사라지므로, 받은 결과를 이 탭의 sessionStorage에만 둔다.
// 탭을 닫으면 사라진다. 원문은 처음부터 없다(스킬 서버가 화면용 필드만 보냄).
const KEY_RESULT = 'fs.current.result'
const KEY_REQUEST = 'fs.current.request'
import { api } from './api.js'
import { ANSWERS, REQUEST_TYPES, confirmStore } from './confirm.js'
export async function updateResultContext(result,context) {
  return (await api('/result/context',{receipt:result?.receipt,...context})).result
}

function ss() {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage
}

function readEntry() {
  try {
    const value = JSON.parse(ss()?.getItem(KEY_RESULT) ?? 'null')
    if (value?.version === 2 && value.result?.level) return value
    if (value?.level) return { result: value, legacyRequestId: ss()?.getItem(KEY_REQUEST) }
  } catch { /* A previous tab may contain an unreadable result. */ }
  return null
}

function writeEntry(result, request) {
  ss()?.setItem(KEY_RESULT, JSON.stringify({ version: 2, result, request }))
  ss()?.removeItem(KEY_REQUEST)
}

export function beginCurrentResult(result) {
  writeEntry(result, null)
}

export function loadCurrentResult() {
  return readEntry()?.result ?? null
}

export function commitResultUpdate(previousReceipt, result) {
  const current = readEntry()
  if (!previousReceipt || current?.result.receipt !== previousReceipt || !result?.receipt) return false
  writeEntry(result, current.request ?? null)
  return true
}

export function bindCurrentRequest(receipt, request) {
  const current = readEntry()
  if (!receipt || current?.result.receipt !== receipt || !request?.id || !request.checkId) return false
  writeEntry(current.result, { id: request.id, checkId: request.checkId })
  return true
}

export function loadCurrentRequestId() {
  return readEntry()?.request?.id ?? null
}

// Older tabs stored two unrelated keys. Only the original receipt of this check can adopt that request.
async function matchesOriginalReceipt(receipt, expectedHash) {
  if (!receipt || !expectedHash || !globalThis.crypto?.subtle) return false
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(receipt))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('') === expectedHash
}

export async function getCurrentRequest(expectedId, getRequest = confirmStore.get) {
  const entry = readEntry()
  const id = entry?.request?.id ?? entry?.legacyRequestId
  if (!id || (expectedId && expectedId !== id)) return null
  const request = await getRequest(id)
  if (request?.id !== id || !request.checkId) return null
  if (entry.legacyRequestId && await matchesOriginalReceipt(entry.result.receipt, request.sourceReceiptHash)) {
    bindCurrentRequest(entry.result.receipt, request)
  }
  const active = readEntry()?.request
  return active?.id === id && active.checkId === request.checkId ? request : null
}

export function canReportOriginalCall(request) {
  return request?.requestType === REQUEST_TYPES.IMPERSONATION && !request.deviceSuspect &&
    ['pending', 'expired', 'responded'].includes(request.state)
}

export async function readFamilyAnswer(expectedId, getRequest = confirmStore.get, resign = updateResultContext) {
  const request = await getCurrentRequest(expectedId, getRequest)
  const current = readEntry()
  if (!request || current?.request?.id !== request.id) return null
  const base = current.result
  if (request.state !== 'responded' || request.requestType !== REQUEST_TYPES.IMPERSONATION || request.answer !== ANSWERS.NOT_SENT) {
    return { request, result: base }
  }

  let signed = request.confirmedResult
  if (!signed?.receipt) {
    // Older API versions support the same signed context update as the original-number call screen.
    signed = await resign(base, { familyDenied: true })
  } else {
    // Parents may have added a prior call or identified a relation since sending this request.
    const context = {}
    if (base.fired_rules?.includes('R2') && !signed.fired_rules.includes('R2')) context.calledBefore = true
    if (base.impersonated_relation && base.impersonated_relation !== signed.impersonated_relation) {
      context.relation = base.impersonated_relation
    }
    if (Object.keys(context).length) signed = await resign(signed, context)
  }
  const active = readEntry()
  if (active?.request?.id !== request.id || active.request.checkId !== request.checkId) return null
  if (active.result.receipt !== base.receipt) {
    // Another read may already have saved the signed family answer while this one was awaiting a re-sign.
    return active.result.fired_rules?.includes('R5') ? { request, result: active.result } : null
  }
  const result = { ...base, ...signed }
  commitResultUpdate(base.receipt, result)
  return { request, result }
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
