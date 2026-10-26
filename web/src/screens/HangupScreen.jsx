/**
 * P2-a. 통화 중 끊기 안내 /check/hangup
 * 로그인 없이 바로 보인다(가장 급한 화면). 끊기 전에 다른 입력을 요구하지 않는다.
 */
import { useNavigate } from 'react-router-dom'
import VerdictBanner from '../components/VerdictBanner.jsx'
import Warning112 from '../components/Warning112.jsx'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { POLICE, sourceText } from '../data/contacts.js'

export default function HangupScreen() {
  const navigate = useNavigate()
  return (
    <main className="mode-parent screen--danger">
      <VerdictBanner level="danger" />
      <h1 className="screen-title">지금 바로 전화를 끊으세요.</h1>
      <p className="screen-body">상대가 뭐라고 해도 괜찮아요. 끊는 게 먼저예요.</p>
      <Warning112 />
      <div className="screen-actions">
        <ActionButton variant="primary" onClick={() => navigate('/check/result')}>
          끊었어요
        </ActionButton>
        <CallButton
          name="경찰 112에 전화 · 끊은 다음에 거세요"
          number={POLICE.number}
          source={sourceText()}
        />
      </div>
      <NoLinkFooter />
    </main>
  )
}
