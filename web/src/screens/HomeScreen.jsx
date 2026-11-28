/**
 * H0. 홈 /
 * 소개 + 입구 안내. 로그인 없이 공개.
 */
import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContrastContext } from '../data/contrast-pref.js'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { SERVICE_PERIOD_NOTICE } from '../data/legal.js'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { highContrast, toggleContrast } = useContext(ContrastContext)
  return (
    <main id="main" className="mode-parent">
      <header className="home-intro">
        <h1 className="screen-title">의심 문자, 혼자 판단하지 마세요</h1>
        <p className="screen-body">
          의심 문자를 받으면 카카오톡 '가족방패' 채널에 붙여 넣으세요.
        </p>
        <p className="screen-body">
          혼자 판단하지 말고 가족과 같이 확인해요.
        </p>
      </header>
      <div className="screen-actions">
        <ActionButton variant="primary" onClick={() => navigate('/contacts')}>
          공식 번호 보기
        </ActionButton>
        <ActionButton variant="danger" onClick={() => navigate('/help')}>
          이미 눌렀거나 보냈어요
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => navigate('/demo')}>
          예시 보기
        </ActionButton>
        {/* F7: 연습 모드 */}
        <ActionButton variant="secondary" onClick={() => navigate('/quiz')}>
          오늘의 퀴즈 (연습)
        </ActionButton>
      </div>
      <p className="screen-body service-period" role="note">{SERVICE_PERIOD_NOTICE}</p>
      {/* 설정은 맨 위 [메뉴]에도 있다 */}
      <p className="screen-body home-settings">
        <button type="button" className="text-link" onClick={() => navigate('/settings')}>설정</button>
        <button type="button" className="text-link" aria-pressed={highContrast} onClick={toggleContrast}>
          {highContrast ? '기본 화면으로 보기' : '고대비로 보기'}
        </button>
      </p>
      <NoLinkFooter />
    </main>
  )
}
