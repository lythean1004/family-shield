/**
 * P7. 원래 번호로 전화한 뒤 /check/callresult (PRD 9-8)
 *
 * P6에서 "원래 번호로 전화해 보세요" 안내를 받고, 실제로 전화한 뒤 결과를 고른다.
 *   ① 안 보냈대요 → family_denied=true로 규칙 엔진 재실행(R5 → 위험)
 *   ② 보냈대요 → 판정 그대로(F5-5와 같은 원칙). 목소리 통화 전까지 돈·결제 금지
 *   ③ 통화가 안 돼요 → 판정 그대로. 다른 방법으로 확인하라고 안내
 *
 * 서버가 R5를 적용하고 결과에 다시 서명한다.
 */
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import ActionButton from '../components/ActionButton.jsx'
import CallButton from '../components/CallButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { ANSWERS } from '../data/confirm.js'
import { POLICE, sourceText } from '../data/contacts.js'
import { canReportOriginalCall, commitResultUpdate, getCurrentRequest, loadCurrentResult, updateResultContext } from '../data/session.js'

export default function CallResultScreen() {
  const navigate = useNavigate()
  const id = useLocation().state?.requestId
  const [request, setRequest] = useState(undefined)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    let active = true
    setRequest(undefined)
    getCurrentRequest(id).then(req => { if (active) setRequest(req) }).catch(e => {
      if (active) { setError(e.message); setRequest(null) }
    })
    return () => { active = false; mounted.current = false }
  }, [id])

  async function apply(answer) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const base = loadCurrentResult()
      const req = await getCurrentRequest(request.id)
      if (!mounted.current || !base?.receipt || loadCurrentResult()?.receipt !== base.receipt) return
      setRequest(req)
      if (!canReportOriginalCall(req)) return
      if (answer === ANSWERS.WILL_CALL) { setUnreachable(true); return }
      if (answer === ANSWERS.NOT_SENT && !base.fired_rules?.includes('R5')) {
        const result = await updateResultContext(base, { familyDenied: true, requestId: req.id })
        if (!mounted.current || !commitResultUpdate(base.receipt, result)) return
      }
      navigate('/check/result')
    } catch (e) { if (mounted.current) setError(e.message) }
    finally { if (mounted.current) setBusy(false) }
  }

  if (request === undefined) return <main id="main" className="mode-parent"><p role="status" className="screen-body">가족 확인 요청을 찾고 있어요.</p></main>
  if (request?.deviceSuspect) return <Navigate to="/help" replace />
  if (!canReportOriginalCall(request)) return <main id="main" className="mode-parent">
    <h1 className="screen-title">이 문자에 연결된 사칭 확인 요청을 찾을 수 없어요.</h1>
    {error && <p role="alert" className="screen-body">{error}</p>}
    <ActionButton onClick={() => navigate('/check/result')}>결과 화면으로</ActionButton>
    <NoLinkFooter />
  </main>
  if (unreachable) return <main id="main" className="mode-parent">
    <h1 className="screen-title">아직 가족과 통화하지 못했어요.</h1>
    <p className="screen-body">돈을 보내거나 링크를 누르기 전에 다른 가족에게도 원래 알던 번호로 물어보세요.</p>
    {loadCurrentResult()?.level === '위험' && <CallButton name={POLICE.name} number={POLICE.number} source={sourceText()} />}
    <ActionButton onClick={() => navigate('/check/result')}>결과 화면으로</ActionButton>
    <NoLinkFooter />
  </main>

  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title">원래 번호로 전화했어요.</h1>
      {error&&<p role="alert" className="screen-body">{error}</p>}
      <p className="screen-body">문자를 보낸 것처럼 보이는 가족에게 원래 알던 번호로 전화해 보셨나요? 그 가족의 답을 골라 주세요.</p>

      <div className="screen-actions">
        <ActionButton variant="danger" disabled={busy} onClick={() => apply(ANSWERS.NOT_SENT)}>
          안 보냈대요
        </ActionButton>
        <ActionButton variant="secondary" disabled={busy} onClick={() => apply(ANSWERS.SENT)}>
          보냈대요
        </ActionButton>
        <ActionButton variant="secondary" disabled={busy} onClick={() => apply(ANSWERS.WILL_CALL)}>
          통화가 안 돼요
        </ActionButton>
      </div>

      <NoLinkFooter />
    </main>
  )
}
