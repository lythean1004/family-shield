/**
 * StepList — 한 번에 한 단계씩 보여 주는 절차 (F6-2)
 * steps: string[]
 * onDone: 마지막 단계에서 [다 했어요]를 누르면 호출 (선택)
 */
import { useState } from 'react'
import ActionButton from './ActionButton.jsx'

export default function StepList({ steps, onDone }) {
  const [index, setIndex] = useState(0)
  const isLast = index >= steps.length - 1
  const finished = index >= steps.length

  if (finished) {
    return <p className="screen-body step-list__done">모든 단계를 봤어요.</p>
  }

  return (
    <section className="step-list" aria-live="polite">
      <p className="step-list__count">
        {steps.length}단계 중 {index + 1}단계
      </p>
      <p className="step-list__text">{steps[index]}</p>
      <div className="screen-actions">
        <ActionButton
          variant="primary"
          onClick={() => {
            if (isLast && onDone) onDone()
            setIndex(index + 1)
          }}
        >
          {isLast ? '다 했어요' : '했어요, 다음'}
        </ActionButton>
        {index > 0 && (
          <ActionButton variant="secondary" onClick={() => setIndex(index - 1)}>
            앞 단계 다시 보기
          </ActionButton>
        )}
      </div>
    </section>
  )
}
