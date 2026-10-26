/**
 * F7. 연습 모드: 오늘의 퀴즈 /quiz
 *
 * F7-1: 앱 안에서만. '연습' 표시 상시 노출.
 * F7-2: is_practice=true — 실제 알림·지표 제외.
 * F7-3: 결과에서 놓친 신호를 짚어 주고 이어서 다음 문제.
 * F7-4: 검수한 고정 문항만 사용(AI 즉석 생성 없음).
 * F7-5: 전체 점수를 마지막에 표시.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import VerdictBanner from '../components/VerdictBanner.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { QUIZ_ITEMS } from '../data/quiz.js'
import { levelKey } from '../data/result.js'

const CHOICES = [
  { label: '위험 — 사기 같아요',     value: '위험' },
  { label: '주의 — 확인해 볼게요',   value: '주의' },
  { label: '확인 필요 — 모르겠어요', value: '확인필요' },
]

export default function QuizScreen() {
  const navigate = useNavigate()
  const [idx, setIdx]         = useState(0)
  const [choice, setChoice]   = useState(null)   // 현재 문항 선택
  const [checked, setChecked] = useState(false)  // 결과 확인 여부
  const [score, setScore]     = useState(0)      // 맞은 개수
  const [done, setDone]       = useState(false)  // 전체 완료

  const item = QUIZ_ITEMS[idx]
  const total = QUIZ_ITEMS.length
  const isCorrect = choice === item?.level

  const confirm = () => {
    if (isCorrect) setScore((s) => s + 1)
    setChecked(true)
  }

  const next = () => {
    if (idx + 1 >= total) {
      setDone(true)
    } else {
      setIdx((i) => i + 1)
      setChoice(null)
      setChecked(false)
    }
  }

  if (done) {
    return (
      <main className="mode-parent">
        {/* F7-1: 연습 표시 상시 노출 */}
        <PracticeBadge />
        <h1 className="screen-title">연습 완료</h1>
        {/* F7-5: 전후 점수 비교용 점수 표시 */}
        <p className="screen-body quiz-score">
          {total}문제 중 <strong>{score}문제</strong> 맞혔어요.
        </p>
        {score < total && (
          <p className="screen-body">
            틀린 문제의 신호를 다시 살펴보고, 실제 문자가 오면 바로 판별해 보세요.
          </p>
        )}
        {score === total && (
          <p className="screen-body">전부 맞혔어요. 의심 문자가 오면 망설이지 말고 판별해 보세요.</p>
        )}
        <div className="screen-actions">
          <ActionButton variant="primary" onClick={() => { setIdx(0); setChoice(null); setChecked(false); setScore(0); setDone(false) }}>
            다시 풀기
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => navigate('/')}>처음으로</ActionButton>
        </div>
        <NoLinkFooter />
      </main>
    )
  }

  return (
    <main className="mode-parent">
      <PracticeBadge />
      <p className="quiz-progress" aria-label={`${total}문제 중 ${idx + 1}번째`}>
        {idx + 1} / {total}
      </p>
      <h1 className="screen-title">{item.title}</h1>
      <blockquote className="quiz-message">{item.message}</blockquote>

      {!checked ? (
        <>
          <p className="screen-body">이 문자, 어떻게 생각하세요?</p>
          <div className="screen-actions">
            {CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`quiz-choice${choice === c.value ? ' quiz-choice--selected' : ''}`}
                onClick={() => setChoice(c.value)}
                aria-pressed={choice === c.value}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={confirm} disabled={!choice}>
              확인
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <VerdictBanner level={levelKey(item.level)} />
          <p className={`quiz-result-label ${isCorrect ? 'quiz-result-label--correct' : 'quiz-result-label--wrong'}`}>
            {isCorrect ? '맞혔어요!' : `정답은 "${item.level}"이에요.`}
          </p>
          {/* F7-3: 놓친 신호 짚어주기 */}
          <p className="screen-body">{item.explanation}</p>
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={next}>
              {idx + 1 < total ? '다음 문제' : '결과 보기'}
            </ActionButton>
          </div>
        </>
      )}
      <NoLinkFooter />
    </main>
  )
}

/** F7-1: '연습' 배지 — 실제 서비스와 구분 */
function PracticeBadge() {
  return (
    <p className="practice-badge" aria-label="연습 모드">연습</p>
  )
}
