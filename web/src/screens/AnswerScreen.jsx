/**
 * P8. 가족 답 반영 결과 /check/answer
 *
 * | 보낸 적 없어요   | 위험(R5). "지은이가 보낸 문자가 아니에요." + 지우세요 | [확인했어요] [이미 눌렀거나 보냈어요] |
 * | 제가 보냈어요    | 판정 그대로(F5-5). 목소리 통화 전엔 돈·결제 금지      | [원래 번호로 전화] [확인했어요] |
 * | 전화할게요       | 그대로. 전화 받기 전까지 아무것도 하지 마세요          | [확인했어요] |
 *
 * "제가 보냈어요"에도 초록색·체크 표시를 쓰지 않는다(U6).
 */
import { useNavigate } from 'react-router-dom'
import VerdictBanner from '../components/VerdictBanner.jsx'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import Warning112 from '../components/Warning112.jsx'
import LimitNotice from '../components/LimitNotice.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { ANSWERS, applyFamilyAnswer, confirmStore, DEV_FAMILY } from '../data/confirm.js'
import { levelKey } from '../data/result.js'
import { loadCurrentRequestId, loadCurrentResult, saveCurrentResult } from '../data/session.js'

export default function AnswerScreen({ fallbackResult }) {
  const navigate = useNavigate()
  const id = loadCurrentRequestId()
  const req = id ? confirmStore.get(id) : null
  const base = loadCurrentResult() ?? fallbackResult
  const who = DEV_FAMILY.guardian.callName

  if (!req || req.state !== 'responded') {
    return (
      <main className="mode-parent">
        <h1 className="screen-title">아직 가족 답이 없어요.</h1>
        <div className="screen-actions">
          <ActionButton variant="primary" onClick={() => navigate('/check/wait')}>기다리는 화면으로</ActionButton>
        </div>
        <NoLinkFooter />
      </main>
    )
  }

  const result = applyFamilyAnswer(base, req.answer)
  const key = levelKey(result.level)
  const done = () => {
    saveCurrentResult(result)
    navigate('/')
  }

  return (
    <main className="mode-parent">
      <VerdictBanner level={key} />

      {req.answer === ANSWERS.NOT_SENT && (
        <>
          <h1 className="screen-title">{who}가 보낸 문자가 <strong>아니에요</strong>.</h1>
          <p className="screen-body">{who}가 직접 확인해 줬어요.</p>
          <p className="screen-body"><strong>문자에 답하지 말고 지우세요.</strong></p>
          <Warning112 />
          <div className="screen-actions">
            <ActionButton variant="primary" onClick={done}>확인했어요</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/help')}>이미 눌렀거나 보냈어요</ActionButton>
          </div>
        </>
      )}

      {req.answer === ANSWERS.SENT && (
        <>
          <h1 className="screen-title">{who}가 <strong>보냈다고 답했어요.</strong></h1>
          <p className="screen-body">
            그래도 위험한 부탁이 있어요. <strong>목소리로 통화하기 전에는</strong> 돈이나 결제를 하지 마세요.
          </p>
          <div className="screen-actions">
            <CallButton
              name={`${who} 원래 번호로 전화`}
              number={DEV_FAMILY.guardian.phone}
              source="가족이 등록한 번호"
            />
            <ActionButton variant="secondary" onClick={done}>확인했어요</ActionButton>
          </div>
        </>
      )}

      {req.answer === ANSWERS.WILL_CALL && (
        <>
          <h1 className="screen-title">{who}가 곧 전화할 거예요.</h1>
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
