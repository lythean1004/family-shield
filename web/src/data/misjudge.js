// 오판 신고 (F4-13, D17) — Supabase misjudge_reports 테이블 연동
//
// 남기는 것: 판정·발동 규칙·신호·이유·시각 (PRD 11-1 misjudge_reports와 같은 필드, 원문 없음)
// 서버 저장(misjudge_reports, 90일 [임시])과 마스킹 문장 공유 동의는 동의 화면(S 시리즈) 뒤에 붙인다.
//
// 로그인 전: localStorage에 최대 50건
// 로그인 후: misjudge_reports 테이블 insert (별도 동의 시에만)
import { supabase } from '../lib/supabase.js'

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

/**
 * 오판 신고를 기록한다.
 * 로그인 후 + 별도 동의: misjudge_reports 테이블 insert
 * 로그인 전 또는 동의 없음: localStorage에만 기록
 * @param {object} result - 판정 결과
 * @param {string} reason - 오판 이유 (MISJUDGE_REASONS의 id)
 * @param {Storage} storage - localStorage (테스트용 주입 가능)
 * @returns {Promise<object>} 기록된 오판 신고 객체
 */
export async function recordMisjudge(result, reason, storage = globalThis.localStorage) {
  const rec = toMisjudgeRecord(result, reason)

  // localStorage에 즉시 기록 (화면 표시·기기 이력용)
  if (storage) {
    let list = []
    try { list = JSON.parse(storage.getItem(KEY) ?? '[]') } catch { list = [] }
    list.push(rec)
    storage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  }

  // 로그인 상태 확인
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return rec // localStorage만 사용
  }

  // Supabase에 기록 (Auth 구현 후 활성화)
  // TODO: check_id, 별도 동의 확인 필요
  console.warn('Supabase misjudge_reports insert는 Auth 구현 후 활성화 예정')
  
  return rec
}
