/**
 * F5-10. 보호자 대시보드 /family/dashboard
 *
 * 최근 24시간의 확인 요청·알림과 응답 상태를 보여 준다.
 * VM API에서 3초마다 조회한다. 요청 항목을 누르면 해당 C2 화면으로 이동.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import VerdictBanner from '../components/VerdictBanner.jsx'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { confirmStore, DEV_FAMILY, formatTime, ANSWERS, ANSWERS_LINK, REQUEST_TYPES } from '../data/confirm.js'
import { levelKey } from '../data/result.js'

const WINDOW_MS = 24 * 60 * 60 * 1000
const ANSWER_LABEL = {
  [ANSWERS.NOT_SENT]:         '보낸 적 없음',
  [ANSWERS.WILL_CALL]:        '전화한다고 답함',
  [ANSWERS.SENT]:             '보냈다고 답함',
  [ANSWERS_LINK.DONT_PRESS]:  '누르지 마세요',
  [ANSWERS_LINK.WILL_CALL]:   '제가 전화할게요',
  [ANSWERS_LINK.WAIT]:        '잠깐 기다려 주세요',
}

export default function FamilyDashboardScreen() {
  const navigate = useNavigate()
  const { parent } = DEV_FAMILY
  const [requests, setRequests] = useState([])
  const [error,setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try{const list = await confirmStore.listRecent(WINDOW_MS);setRequests(list);setError('')}
      catch(e){setError(e.message)}
    }
    load()
    const timer = setInterval(load, 3000)
    window.addEventListener('storage', load)
    return () => { clearInterval(timer); window.removeEventListener('storage', load) }
  }, [])

  return (
    <main id="main" className="mode-guardian">
      <h1 className="screen-title">가족 확인 요청 내역</h1>
      <p className="screen-body">
        연결된 가족에게서 온 최근 24시간 요청이에요.
      </p>
      {error && <p role="alert" className="screen-body">{error}</p>}

      {requests.length === 0 ? (
        <p className="screen-body dashboard-empty">최근 24시간 안에 온 요청이 없어요.</p>
      ) : (
        <ul className="dashboard-list">
          {requests.map((req) => (
            <li key={req.id} className="dashboard-card">
              <div className="dashboard-card__row">
                <VerdictBanner level={levelKey(req.summary.level)} />
                <span className="dashboard-card__time tabular">{formatTime(req.sentAt)}</span>
              </div>
              <div className="dashboard-card__meta">
                {req.requestType === REQUEST_TYPES.LINK_CHECK ? '링크·일반 문자 확인' : '가족 사칭 확인'}
                {req.summary.impersonated_relation && ` · ${req.summary.impersonated_relation}`}
              </div>
              {req.state === 'responded' ? (
                <p className="dashboard-card__answer">
                  ✓ {ANSWER_LABEL[req.answer] ?? req.answer}
                </p>
              ) : req.state==='pending' ? (
                <Link to={`/family/req/${req.id}`} className="dashboard-card__pending">
                  미응답 — 여기를 눌러 답하기
                </Link>
              ) : <p>{req.state==='cancelled'?'취소된 요청':'시간이 지난 요청'}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="screen-actions">
        <ActionButton variant="secondary" onClick={() => navigate('/settings')}>설정으로</ActionButton>
      </div>
      <NoLinkFooter />
    </main>
  )
}
