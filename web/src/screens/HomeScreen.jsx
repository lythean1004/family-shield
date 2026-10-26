/**
 * H0. 홈 /
 * 소개 + 입구 안내. 로그인 없이 공개.
 */
import { useNavigate } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'

export default function HomeScreen() {
  const navigate = useNavigate()
  return (
    <main className="mode-parent">
      <h1 className="screen-title">가족방패</h1>
      <p className="screen-body">
        의심 문자를 받으면 카카오톡 '가족방패' 채널에 붙여 넣으세요.
      </p>
      <p className="screen-body">
        혼자 판단하지 말고 가족과 같이 확인해요.
      </p>
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
      <p className="screen-body home-settings">
        <button type="button" className="text-link" onClick={() => navigate('/settings')}>설정</button>
      </p>
      <NoLinkFooter />
    </main>
  )
}
