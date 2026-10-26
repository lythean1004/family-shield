/**
 * E1. 사후 대응 /help — 로그인 없이 열린다(감염 의심 기기에서 로그인 요구는 위험).
 * 무엇을 했는지 고르면(F6-1) 한 번에 한 단계씩(F6-2).
 * 링크·앱(F6-3): 이 휴대폰으로 전화하지 않도록 전화 버튼을 숨긴다.
 * 근거 카드: AFTER_APP_INSTALLED(active)만 절차로 쓴다. AFTER_MONEY_SENT(needs_review),
 * AFTER_INFO_LEAKED(S2 단독, 이용조건 미확인)는 화면에 쓰지 않는다(F6-5, PRD 14-2) —
 * 돈·정보는 active 번호(112) 안내만 한다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepList from '../components/StepList.jsx'
import CallButton from '../components/CallButton.jsx'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { POLICE, sourceText } from '../data/contacts.js'

const CHOICES = [
  { id: 'link',  label: '링크를 눌렀어요',     infected: true },
  { id: 'app',   label: '앱을 깔았어요',       infected: true },
  { id: 'money', label: '돈을 보냈어요',       infected: false },
  { id: 'info',  label: '정보를 알려 줬어요',  infected: false },
]

const INFECTED_STEPS = [
  '휴대폰을 비행기 모드로 바꾸세요.',
  '신고 전화는 다른 휴대폰이나 집 전화로 거세요.',
  '휴대폰 초기화나 앱 삭제는 가족이나 서비스센터와 같이 하세요.',
  '가까운 경찰서에 직접 가서 알리세요.',
]

export default function HelpScreen() {
  const navigate = useNavigate()
  const [choice, setChoice] = useState(null)
  const picked = CHOICES.find((c) => c.id === choice)

  return (
    <main className="mode-parent">
      {!picked && (
        <>
          <h1 className="screen-title">무엇을 했나요?</h1>
          <p className="screen-body">괜찮아요. 지금부터 하나씩 같이 해요.</p>
          <ul className="action-choice-list">
            {CHOICES.map((c) => (
              <li key={c.id}>
                <button type="button" className="demo-list__btn" onClick={() => setChoice(c.id)}>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {picked?.infected && (
        <>
          <h1 className="screen-title">{picked.label}</h1>
          <p className="warning-112" role="alert">
            이 휴대폰으로는 신고 전화를 걸지 마세요. 화면에 112라고 떠도 믿지 마세요.
          </p>
          <StepList steps={INFECTED_STEPS} />
        </>
      )}

      {picked && !picked.infected && (
        <>
          <h1 className="screen-title">{picked.label}</h1>
          <p className="screen-body">
            {picked.id === 'money'
              ? '바로 112에 전화해서 돈을 보낸 계좌를 막아 달라고 하세요.'
              : '바로 112에 전화해서 무엇을 알려 줬는지 말하세요.'}
          </p>
          <CallButton name={POLICE.name} number={POLICE.number} source={sourceText()} />
          <p className="screen-body help-note">은행에도 알리세요. 번호는 통장이나 카드 뒤에 적혀 있어요.</p>
        </>
      )}

      {picked && (
        <div className="screen-actions">
          <ActionButton variant="secondary" onClick={() => setChoice(null)}>다른 것 고르기</ActionButton>
          <ActionButton variant="secondary" onClick={() => navigate('/')}>처음으로</ActionButton>
        </div>
      )}
      <NoLinkFooter />
    </main>
  )
}
