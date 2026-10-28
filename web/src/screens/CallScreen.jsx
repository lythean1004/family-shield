/**
 * P2. 전화 받았는지 /check/call
 * "이 문자 받기 전에 전화가 왔나요?"
 *   ① 지금 통화 중이에요 → P2-a (R1, 가장 급한 길이라 맨 위·danger)
 *   ② 전화 받았어요 → called_before=true로 규칙 엔진 재실행(R2) → P4
 *   ③ 전화 없었어요 → P4 그대로
 * 판정은 올라가기만 한다. 되돌리기 버튼 없음(원칙 2).
 */
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { loadCurrentResult, saveCurrentResult, updateResultContext } from '../data/session.js'

export default function CallScreen({ fallbackResult }) {
  const navigate = useNavigate()
  const [error,setError]=useState('')

  const answered = async (calledBefore) => {
    const current = loadCurrentResult() ?? fallbackResult
    try{saveCurrentResult(await updateResultContext(current,{calledBefore}));navigate('/check/result')}
    catch(e){setError(e.message)}
  }

  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title">이 문자 받기 전에 전화가 왔나요?</h1>
      {error&&<p role="alert" className="screen-body">{error}</p>}
      <div className="screen-actions">
        <ActionButton variant="danger" onClick={() => navigate('/check/hangup')}>
          지금 통화 중이에요
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => answered(true)}>전화 받았어요</ActionButton>
        <ActionButton variant="secondary" onClick={() => answered(false)}>전화 없었어요</ActionButton>
      </div>
      <NoLinkFooter />
    </main>
  )
}
