/**
 * P2. 전화 받았는지 /check/call
 * "이 문자 받기 전에 전화가 왔나요?"
 *   ① 지금 통화 중이에요 → P2-a (R1, 가장 급한 길이라 맨 위·danger)
 *   ② 전화 받았어요 → 최초 분석에 called_before=true 전달(R2) → P4
 *   ③ 전화 없었어요 → 최초 분석에 called_before=false 전달 → P4
 */
import { useEffect, useRef } from 'react'
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { canAnalyzeText } from '../data/analyze.js'
import useAnalyzeSubmission from './useAnalyzeSubmission.js'

export default function CallScreen() {
  const navigate = useNavigate()
  const { text } = useOutletContext()
  const title = useRef(null)
  const { submit, loading, error } = useAnalyzeSubmission(text)
  useEffect(() => { title.current?.focus() }, [])

  if (!canAnalyzeText(text)) {
    return <Navigate to="/check/input" replace state={{ textRequiredForCall: true }} />
  }

  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title" ref={title} tabIndex={-1}>이 문자 받기 전에 전화가 왔나요?</h1>
      <p className="screen-body">‘전화 받았어요’는 상대가 먼저 걸어 온 전화를 받았을 때 골라 주세요.</p>
      {loading && <p className="screen-body" role="status">판별 중이에요.</p>}
      {error && <p className="screen-body" role="alert">{error}</p>}
      <div className="screen-actions">
        <ActionButton
          variant="danger"
          onClick={() => navigate('/check/hangup', { replace: true, state: { callInProgress: true } })}
          disabled={loading}
        >
          지금 통화 중이에요
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => submit('earlier')} disabled={loading}>전화 받았어요</ActionButton>
        <ActionButton variant="secondary" onClick={() => submit('none')} disabled={loading}>전화 없었어요</ActionButton>
      </div>
      <NoLinkFooter />
    </main>
  )
}
