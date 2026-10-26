// 오판 신고 (F4-13, D17) — 1차는 기기에만 기록
//
// 남기는 것: 판정·발동 규칙·신호·이유·시각 (PRD 11-1 misjudge_reports와 같은 필드, 원문 없음)
// 서버 저장(misjudge_reports, 90일 [임시])과 마스킹 문장 공유 동의는 동의 화면(S 시리즈) 뒤에 붙인다.
export const MISJUDGE_REASONS = [
  { id: 'false_alarm', label: '아는 사람이 보낸 문자예요' },
  { id: 'missed',      label: '사기 같은데 위험이 아니래요' },
  { id: 'other',       label: '그 밖에 이상해요' },
]

const KEY = 'fs.misjudge'
const MAX = 50

export function toMisjudgeRecord(result, reason, now = Date.now()) {
  if (!MISJUDGE_REASONS.some((r) => r.id === reason)) throw new Error('unknown reason')
  return {
    level: result.level,
    fired_rules: [...(result.fired_rules ?? [])],
    signals_final: [...(result.signals_final ?? [])],
    reason,
    created_at: new Date(now).toISOString(),
  }
}

export function recordMisjudge(result, reason, storage = globalThis.localStorage) {
  const rec = toMisjudgeRecord(result, reason)
  if (!storage) return rec
  let list = []
  try { list = JSON.parse(storage.getItem(KEY) ?? '[]') } catch { list = [] }
  list.push(rec)
  storage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  return rec
}
