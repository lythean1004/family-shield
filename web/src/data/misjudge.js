import { api } from './api.js'
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
export async function recordMisjudge(result, reason, storage = null) {
  const rec=toMisjudgeRecord(result,reason)
  if(storage){
    let list=[];try{list=JSON.parse(storage.getItem(KEY)??'[]')}catch{}
    storage.setItem(KEY,JSON.stringify([...list,rec].slice(-MAX)))
    return rec
  }
  await api('/misjudge',{receipt:result.receipt,reason,shareConsent:true})
  return rec
}
