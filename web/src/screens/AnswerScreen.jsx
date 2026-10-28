/**
 * P8. 가족 답 반영 결과 /check/answer
 *
 * | 보낸 적 없어요   | 위험(R5). "지은이가 보낸 문자가 아니에요." + 지우세요 | [확인했어요] [이미 눌렀거나 보냈어요] |
 * | 제가 보냈어요    | 판정 그대로(F5-5). 목소리 통화 전엔 돈·결제 금지      | [원래 번호로 전화] [확인했어요] |
 * | 전화할게요       | 그대로. 전화 받기 전까지 아무것도 하지 마세요          | [확인했어요] |
 *
 * "제가 보냈어요"에도 초록색·체크 표시를 쓰지 않는다(U6).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VerdictBanner from '../components/VerdictBanner.jsx'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import Warning112 from '../components/Warning112.jsx'
import LimitNotice from '../components/LimitNotice.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { ANSWERS, ANSWERS_LINK, applyFamilyAnswer, confirmStore, DEV_FAMILY, REQUEST_TYPES } from '../data/confirm.js'
import { levelKey } from '../data/result.js'
import { loadCurrentRequestId, loadCurrentResult, saveCurrentResult } from '../data/session.js'

export default function AnswerScreen({ fallbackResult }) {
  const navigate = useNavigate()
  const id = loadCurrentRequestId()
  const [req, setReq] = useState(undefined)
  const base = loadCurrentResult() ?? fallbackResult
  const who = req?.guardianName || '가족'
  const lastCode=who.charCodeAt(who.length-1)
  const whoSubject=who+(lastCode>=0xac00&&lastCode<=0xd7a3&&(lastCode-0xac00)%28!==0?'이':'가')
  const [error,setError] = useState('')

  // 초기 로드
  useEffect(() => {
    if (!id) {setReq(null);return}
    confirmStore.get(id).then(setReq).catch(e=>{setError(e.message);setReq(null)})
  }, [id])

  if(req===undefined) return <main id="main" className="mode-parent"><p role="status" className="screen-body">가족의 답을 확인하고 있어요.</p></main>
  if (!req || req.state !== 'responded') {
    return (
      <main id="main" className="mode-parent">
        <h1 className="screen-title">아직 가족 답이 없어요.</h1>
        {error && <p role="alert" className="screen-body">{error}</p>}
        <div className="screen-actions">
          <ActionButton variant="primary" onClick={() => navigate('/check/wait')}>기다리는 화면으로</ActionButton>
        </div>
        <NoLinkFooter />
      </main>
    )
  }

  const result = applyFamilyAnswer(base, req.answer)
  const key = levelKey(result.level)
  const isLinkCheck = req.requestType === REQUEST_TYPES.LINK_CHECK
  const done = () => {
    saveCurrentResult(result)
    navigate('/')
  }

  return (
    <main id="main" className="mode-parent">
      <VerdictBanner level={key} />

      {/* F5-3: 링크·일반 문자 확인 답변 */}
      {isLinkCheck && req.answer === ANSWERS_LINK.DONT_PRESS && (
        <>
          <h1 className="screen-title">{whoSubject} <strong>누르지 말라고 했어요.</strong></h1>
          <p className="screen-body">링크를 누르지 마세요. {whoSubject} 곧 직접 전화할 거예요.</p>
          <Warning112 />
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={done}>확인했어요</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/help')}>이미 눌렀거나 보냈어요</ActionButton>
          </div>
        </>
      )}
      {isLinkCheck && req.answer === ANSWERS_LINK.WILL_CALL && (
        <>
          <h1 className="screen-title">{whoSubject} 곧 전화할 거예요.</h1>
          <p className="screen-body">전화를 받기 전까지 아무것도 하지 마세요.</p>
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={done}>확인했어요</ActionButton>
          </div>
        </>
      )}
      {isLinkCheck && req.answer === ANSWERS_LINK.WAIT && (
        <>
          <h1 className="screen-title">{whoSubject} <strong>잠깐 기다려 달라고 했어요.</strong></h1>
          <p className="screen-body">아무것도 누르지 말고 기다리세요. 곧 {whoSubject} 직접 전화할 거예요.</p>
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={done}>확인했어요</ActionButton>
          </div>
        </>
      )}

      {!isLinkCheck && req.answer === ANSWERS.NOT_SENT && (
        <>
          <h1 className="screen-title">{whoSubject} 보낸 문자가 <strong>아니에요</strong>.</h1>
          <p className="screen-body">{whoSubject} 직접 확인해 줬어요.</p>
          <p className="screen-body"><strong>문자에 답하지 말고 지우세요.</strong></p>
          <Warning112 />
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={done}>확인했어요</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/help')}>이미 눌렀거나 보냈어요</ActionButton>
          </div>
        </>
      )}

      {!isLinkCheck && req.answer === ANSWERS.SENT && (
        <>
          <h1 className="screen-title">{whoSubject} <strong>보냈다고 답했어요.</strong></h1>
          <p className="screen-body">
            그래도 위험한 부탁이 있어요. <strong>목소리로 통화하기 전에는</strong> 돈이나 결제를 하지 마세요.
          </p>
          <div className="screen-actions">
            <p className="screen-body">휴대폰 연락처에서 원래 알던 가족 번호로 전화해 주세요.</p>
            <ActionButton variant="secondary" onClick={done}>확인했어요</ActionButton>
          </div>
        </>
      )}

      {!isLinkCheck && req.answer === ANSWERS.WILL_CALL && (
        <>
          <h1 className="screen-title">{whoSubject} 곧 전화할 거예요.</h1>
          <p className="screen-body">전화를 받기 전까지 아무것도 하지 마세요.</p>
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={done}>확인했어요</ActionButton>
          </div>
        </>
      )}

      <LimitNotice />
      <NoLinkFooter />
    </main>
  )
}
