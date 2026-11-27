/**
 * P1. 문자 붙여넣기 /check/input (PRD F4-1, F4-4)
 *
 * 카카오톡 채널이 아니어도 웹에서 직접 문자를 판별 받을 수 있게 한다.
 * 캡처 사진 올리기는 개인정보 보호 검토(D24) 전이라 붙여넣기만 허용한다.
 *
 * 흐름:
 *   입력 → P2 통화 질문. 원문은 화면 묶음의 React 상태로만 넘긴다.
 *
 * 입력 길이 상한은 서버(MAX_INPUT_CHARS=2000)와 같다. 넘기면 버튼이 비활성화.
 */
import { useEffect } from 'react'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { MAX_ANALYSIS_CHARS, canAnalyzeText } from '../data/analyze.js'
import useAnalyzeSubmission from './useAnalyzeSubmission.js'

export default function InputScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { text, setText } = useOutletContext()
  const { submit, loading, error } = useAnalyzeSubmission(text)
  const reenterAfterCall = location.state?.reenterAfterCall === true
  const sharedText = location.state?.sharedText
  useEffect(() => {
    // 이전 버전에서 이 화면의 방문 기록에 남긴 현재 공유 입력도 메모리로 옮긴다.
    if (typeof sharedText !== 'string') return
    setText(sharedText)
    navigate('/check/input', { replace: true })
  }, [navigate, setText, sharedText])

  const length = [...text].length

  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title">의심 문자 붙여넣기</h1>
      <p className="screen-body">
        시연 기간에는 가상 문자만 붙여 넣어 주세요. 실제 개인정보는 입력하지 마세요.
      </p>
      {reenterAfterCall && (
        <p className="screen-body" role="status">같은 문자를 다시 붙여 넣어 주세요. 앞서 고른 통화 상태를 판별에 반영해요.</p>
      )}
      {location.state?.textRequiredForCall && (
        <p className="screen-body" role="status">통화 여부를 반영하려면 확인할 문자를 먼저 붙여 넣어 주세요.</p>
      )}

      <label className="input-textarea-label" htmlFor="fs-input-text">문자 내용</label>
      {/* F3-5: 입력창에 암호 경고 — 가족 암호를 여기 입력하면 안 됨을 명시 */}
      <p className="input-passphrase-warning" aria-live="polite">
        가족 암호는 여기에 쓰지 마세요.
      </p>
      <textarea
        id="fs-input-text"
        className="input-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="확인할 문자 내용을 붙여 넣어 주세요."
        maxLength={MAX_ANALYSIS_CHARS}
        rows={6}
        aria-describedby="fs-input-count"
        autoComplete="off"
        spellCheck={false}
        disabled={loading}
      />
      <p id="fs-input-count" className="input-count" aria-live="polite">
        {length} / {MAX_ANALYSIS_CHARS}자
      </p>

      {loading && <p className="screen-body" role="status">판별 중이에요.</p>}
      {error && <p className="screen-body" role="alert">{error}</p>}
      <div className="screen-actions">
        <ActionButton
          variant="primary"
          onClick={() => reenterAfterCall ? submit('in_progress') : navigate('/check/call')}
          disabled={loading || !canAnalyzeText(text)}
        >
          {reenterAfterCall ? '판별 받기' : '다음'}
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => navigate('/')}>처음으로</ActionButton>
      </div>

      <NoLinkFooter />
    </main>
  )
}
