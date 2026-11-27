/**
 * P6. 가족 답 기다리기 /check/wait
 *
 * - 가장 먼저, 가장 크게: "답이 올 때까지 링크를 누르거나 돈을 보내지 마세요."
 * - 현재 검사에 연결된 요청을 3초마다 확인한다(F5-6).
 * - 5분 [임시] 넘게 답이 없으면 "답이 늦어요. 원래 번호로 전화해 보세요."(F5-7)
 * - 답이 오면 자동으로 P8
 * - 보호자 화면 주소는 개발 시연용으로만 보인다(실서비스는 웹 푸시, C1).
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { formatTime, POLL_MS, SLOW_ANSWER_MS } from '../data/confirm.js'
import { canReportOriginalCall, getCurrentRequest } from '../data/session.js'

export default function WaitScreen() {
  const navigate = useNavigate()
  const id = useLocation().state?.requestId
  const [req, setReq] = useState(undefined)
  const [now, setNow] = useState(Date.now())
  const who = req?.guardianName || '가족'
  const [error,setError] = useState('')

  useEffect(() => {
    let active = true
    let timer
    setReq(undefined)
    setError('')
    const check = async () => {
      try {
        const updated = await getCurrentRequest(id)
        if (!active) return
        setReq(updated)
        setNow(Date.now())
        setError('')
        if (updated?.state === 'responded') {
          navigate('/check/answer', { replace: true, state: { requestId: updated.id } })
          return
        }
        if (updated?.state !== 'pending') return
      } catch (e) {
        if (!active) return
        setError(e.message)
      }
      timer = setTimeout(check, POLL_MS)
    }
    check()
    return () => { active = false; clearTimeout(timer) }
  }, [id, navigate])

  if (req === undefined && !error) {
    return <main id="main" className="mode-parent"><p role="status" className="screen-body">물어본 내용을 확인하고 있어요.</p></main>
  }

  if (!req) {
    return (
      <main id="main" className="mode-parent">
        <h1 className="screen-title">{error ? '가족 확인 요청을 불러오기 어려워요.' : '물어본 내용이 없어요.'}</h1>
        <p className="screen-body" role={error?'alert':undefined}>{error || '결과 화면에서 다시 가족에게 물어보세요.'}</p>
        <div className="screen-actions">
          <ActionButton variant="primary" onClick={() => navigate('/check/result')}>결과 화면으로</ActionButton>
        </div>
        <NoLinkFooter />
      </main>
    )
  }

  const slow = now - req.sentAt >= SLOW_ANSWER_MS
  const awaiting = req.state === 'pending'

  return (
    <main id="main" className="mode-parent">
      <p className="wait-warning" role="alert">
        답이 올 때까지 링크를 누르거나 돈을 보내지 마세요.
      </p>
      <h1 className="screen-title">{who}에게 물어봤어요.</h1>
      {error && <p role="alert" className="screen-body">{error}</p>}
      <p className="screen-body wait-status" aria-live="polite">
        보낸 시각 {formatTime(req.sentAt)} · {req.state==='cancelled'?'동의를 꺼서 요청이 취소됐어요.':req.state==='expired'?'요청 시간이 지났어요.':slow ? '아직 가족의 답이 오지 않았어요.' : '아직 답이 없어요'}
        {awaiting && !slow && <span className="wait-dots" aria-hidden="true"><i /><i /><i /></span>}
      </p>
      <div className="screen-actions">
        {req.deviceSuspect ? <>
          <p className="screen-body">이 휴대폰 대신 다른 휴대폰이나 집 전화로 도움을 받으세요.</p>
          <ActionButton variant="primary" onClick={() => navigate('/help')}>다른 기기로 도움받기</ActionButton>
        </> : <>
          <p className="screen-body">휴대폰 연락처에서 원래 알던 가족 번호로 전화해 주세요.</p>
          {canReportOriginalCall(req) && <ActionButton variant="primary"
            onClick={() => navigate('/check/callresult', { state: { requestId: req.id } })}>원래 번호로 통화한 결과</ActionButton>}
          <ActionButton variant="secondary" onClick={() => navigate('/contacts')}>공식 번호 보기</ActionButton>
        </>}
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
