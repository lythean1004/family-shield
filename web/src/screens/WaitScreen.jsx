/**
 * P6. 가족 답 기다리기 /check/wait
 *
 * - 가장 먼저, 가장 크게: "답이 올 때까지 링크를 누르거나 돈을 보내지 마세요."
 * - 3초마다 확인(F5-6). 지금은 localStorage 가짜 저장소, 4주차에 confirm_requests 조회로 교체.
 *   다른 탭에서 보호자가 답하면 storage 이벤트로 바로 반영된다.
 * - 5분 [임시] 넘게 답이 없으면 "답이 늦어요. 원래 번호로 전화해 보세요."(F5-7)
 * - 답이 오면 자동으로 P8
 * - 보호자 화면 주소는 개발 시연용으로만 보인다(실서비스는 웹 푸시, C1).
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { confirmStore, DEV_FAMILY, formatTime, POLL_MS, SLOW_ANSWER_MS } from '../data/confirm.js'
import { loadCurrentRequestId } from '../data/session.js'

export default function WaitScreen() {
  const navigate = useNavigate()
  const id = loadCurrentRequestId()
  const [req, setReq] = useState(() => (id ? confirmStore.get(id) : null))
  const [now, setNow] = useState(Date.now())
  const who = DEV_FAMILY.guardian.callName

  useEffect(() => {
    if (!id) return undefined
    const check = () => {
      setReq(confirmStore.get(id))
      setNow(Date.now())
    }
    const timer = setInterval(check, POLL_MS)
    window.addEventListener('storage', check)
    return () => { clearInterval(timer); window.removeEventListener('storage', check) }
  }, [id])

  useEffect(() => {
    if (req?.state === 'responded') navigate('/check/answer', { replace: true })
  }, [req, navigate])

  if (!req) {
    return (
      <main className="mode-parent">
        <h1 className="screen-title">물어본 내용이 없어요.</h1>
        <p className="screen-body">결과 화면에서 다시 가족에게 물어보세요.</p>
        <div className="screen-actions">
          <ActionButton variant="primary" onClick={() => navigate('/check/result')}>결과 화면으로</ActionButton>
        </div>
        <NoLinkFooter />
      </main>
    )
  }

  const slow = now - req.sentAt >= SLOW_ANSWER_MS

  return (
    <main className="mode-parent">
      <p className="wait-warning" role="alert">
        답이 올 때까지 링크를 누르거나 돈을 보내지 마세요.
      </p>
      <h1 className="screen-title">{who}에게 물어봤어요.</h1>
      <p className="screen-body wait-status" aria-live="polite">
        보낸 시각 {formatTime(req.sentAt)} · {slow ? '답이 늦어요. 원래 번호로 전화해 보세요.' : '아직 답이 없어요'}
        {!slow && <span className="wait-dots" aria-hidden="true"><i /><i /><i /></span>}
      </p>
      <div className="screen-actions">
        <CallButton
          name={`${who} 원래 번호로 전화`}
          number={DEV_FAMILY.guardian.phone}
          source="가족이 등록한 번호"
        />
        <ActionButton variant="secondary" onClick={() => navigate('/contacts')}>공식 번호 보기</ActionButton>
      </div>
      {import.meta.env.DEV && (
        <p className="dev-note">
          개발 시연: 다른 탭에서 <Link to={`/family/req/${req.id}`}>보호자 화면</Link>을 열어 답해 보세요.
        </p>
      )}
      <NoLinkFooter />
    </main>
  )
}
