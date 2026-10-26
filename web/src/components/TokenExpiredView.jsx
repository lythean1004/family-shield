/**
 * 만료·사용된 결과 토큰 (PRD 13-4)
 * "이 결과는 다시 볼 수 없어요. 카카오톡에서 다시 확인해 주세요." + 공식 번호 버튼
 */
import { useNavigate } from 'react-router-dom'
import ActionButton from './ActionButton.jsx'
import CallButton from './CallButton.jsx'
import { POLICE, sourceText } from '../data/contacts.js'

export default function TokenExpiredView({ reason }) {
  const navigate = useNavigate()
  return (
    <>
      <h2 className="screen-title">이 결과는 다시 볼 수 없어요.</h2>
      <p className="screen-body">카카오톡에서 다시 확인해 주세요.</p>
      {reason === 'network' && (
        <p className="screen-body help-note">인터넷 연결을 확인한 뒤 카카오톡에서 다시 눌러 주세요.</p>
      )}
      <div className="screen-actions">
        <ActionButton variant="primary" onClick={() => navigate('/contacts')}>공식 번호 보기</ActionButton>
        <CallButton name={`${POLICE.name}에 전화`} number={POLICE.number} source={sourceText()} />
      </div>
    </>
  )
}
