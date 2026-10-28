/**
 * "이 판정이 이상해요" (F4-13, P1) — 한계 문구 아래 작은 글자 링크
 *
 * 1차: 이유 하나만 고르면 신호·판정·이유만 기기에 남기고 고맙다는 말을 보여 준다.
 * 마스킹 문장 공유(별도 동의)와 서버 저장(misjudge_reports)은 동의 화면이 생긴 뒤(4주차 이후).
 * 원문은 처음부터 이 화면에 없다.
 */
import { useState } from 'react'
import { recordMisjudge, MISJUDGE_REASONS } from '../data/misjudge.js'

export default function MisjudgeLink({ result }) {
  const [step, setStep] = useState('closed') // closed → choose → done
  const [consent,setConsent] = useState(false)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)

  if (step === 'done') {
    return <p className="misjudge__done" role="status">알려 주셔서 고마워요. 판정을 고치는 데 쓸게요.</p>
  }

  if (step === 'choose') {
    return (
      <section className="misjudge" aria-label="이 판정이 이상해요">
        <p className="misjudge__q">어떤 점이 이상한가요?</p>
        <label className="setup-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>판정·신호·신고 이유를 개선용으로 90일 보관하는 데 동의해요. 문자 원문은 보내지 않아요.</label>
        {error && <p role="alert">{error}</p>}
        <ul className="misjudge__list">
          {MISJUDGE_REASONS.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="misjudge__choice"
                disabled={!consent||busy}
                onClick={async () => { 
                  setBusy(true);setError('')
                  try{await recordMisjudge(result, r.id);setStep('done')}
                  catch(e){setError(e.message)}finally{setBusy(false)}
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="text-link" onClick={() => setStep('closed')}>닫기</button>
      </section>
    )
  }

  return (
    <button type="button" className="text-link misjudge__open" onClick={() => setStep('choose')}>
      이 판정이 이상해요
    </button>
  )
}
