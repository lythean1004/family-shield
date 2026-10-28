/**
 * P7. 원래 번호로 전화한 뒤 /check/callresult (PRD 9-8)
 *
 * P6에서 "원래 번호로 전화해 보세요" 안내를 받고, 실제로 전화한 뒤 결과를 고른다.
 *   ① 안 보냈대요 → family_denied=true로 규칙 엔진 재실행(R5 → 위험)
 *   ② 보냈대요 → 판정 그대로(F5-5와 같은 원칙). 목소리 통화 전까지 돈·결제 금지
 *   ③ 통화가 안 돼요 → 판정 그대로. 다른 방법으로 확인하라고 안내
 *
 * 서버가 R5를 적용하고 결과에 다시 서명한다.
 */
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { ANSWERS } from '../data/confirm.js'
import { levelKey } from '../data/result.js'
import { POLICE, sourceText } from '../data/contacts.js'
import { loadCurrentResult, saveCurrentResult, updateResultContext } from '../data/session.js'

export default function CallResultScreen({ fallbackResult }) {
  const navigate = useNavigate()
  const [error,setError]=useState('')

  const apply = async (answer) => {
    const base = loadCurrentResult() ?? fallbackResult
    try{saveCurrentResult(await updateResultContext(base,{familyDenied:answer===ANSWERS.NOT_SENT}));navigate('/check/result')}
    catch(e){setError(e.message)}
  }

  const current = loadCurrentResult() ?? fallbackResult
  const key = levelKey(current.level)

  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title">원래 번호로 전화했어요.</h1>
      {error&&<p role="alert" className="screen-body">{error}</p>}
      <p className="screen-body">가족이 뭐라고 했나요?</p>

      <div className="screen-actions">
        <ActionButton variant="danger" onClick={() => apply(ANSWERS.NOT_SENT)}>
          안 보냈대요
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => apply(ANSWERS.SENT)}>
          보냈대요
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => apply(ANSWERS.WILL_CALL)}>
          통화가 안 돼요
        </ActionButton>
      </div>

      {key === 'danger' && (
        <>
          <p className="screen-body">확인이 어려우면 112에 신고하세요.</p>
          <CallButton name={POLICE.name} number={POLICE.number} source={sourceText()} />
        </>
      )}
      <NoLinkFooter />
    </main>
  )
}
