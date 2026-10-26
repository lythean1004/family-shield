/**
 * SignalList — 신호 ID → 9-9 문장 틀 문구 목록 (U8)
 * 문구 표는 core summarizer 하나만 쓴다(자녀 알림·챗봇과 같은 문구).
 * signals: string[]  (SIG_* ID 배열, 파이프라인 signals_final)
 * impersonatedRelation: string | null (파이프라인 impersonated_relation)
 * max: 표시 최대 개수 [임시 4개]
 */
import { summarizePhrases } from '@core/summarizer.js'

export default function SignalList({ signals = [], impersonatedRelation = null, max = 4 }) {
  const phrases = summarizePhrases(signals, { impersonated_relation: impersonatedRelation }).slice(0, max)

  if (phrases.length === 0) return null

  return (
    <ul className="signal-list" aria-label="이렇게 판단했어요">
      {phrases.map((p) => (
        <li key={p} className="signal-list__item">{p}</li>
      ))}
    </ul>
  )
}