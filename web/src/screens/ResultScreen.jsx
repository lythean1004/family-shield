/**
 * P4. 판별 결과 /check/result
 *
 * ?t=토큰 이 있으면(챗봇 [자세히 보기], D34) 스킬 서버에서 한 번 조회하고 주소에서 지운다.
 *   - 만료·사용됨·없음 → TokenExpiredView(PRD 13-4)
 *   - 받은 결과는 이 탭 sessionStorage에만(P6·P8·새로고침용)
 * 토큰이 없으면 이 탭의 현재 결과. 없으면 입력·고정 예시로 안내한다.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ResultView from '../components/ResultView.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import TokenExpiredView from '../components/TokenExpiredView.jsx'
import {
  beginCurrentResult, bindCurrentRequest, fetchResultByToken, getCurrentRequest, loadCurrentResult,
} from '../data/session.js'
import { confirmStore } from '../data/confirm.js'
import { loadFamilyConsent } from '../data/consent.js'
import { REQUEST_TYPES } from '../data/confirm.js'
import ActionButton from '../components/ActionButton.jsx'

export default function ResultScreen({ fallbackResult, familyName, hasFamilyConsent: consentProp }) {
  const navigate = useNavigate()
  // F5-9: 동의 ②가 없으면 가족 확인 버튼 대신 공식 번호. prop이 오면 그것을 우선(테스트·데모용).
  const [hasFamilyConsent, setHasFamilyConsent] = useState(consentProp ?? false)
  const [params, setParams] = useSearchParams()
  const token = params.get('t')
  const [state, setState] = useState(() =>
    token ? { status: 'loading' } : loadCurrentResult() || fallbackResult
      ? { status: 'ok', result: loadCurrentResult() ?? fallbackResult } : {status:'empty'},
  )
  const fetched = useRef(null)
  const mounted = useRef(false)
  const [error,setError] = useState('')
  const [needsProcessingConsent,setNeedsProcessingConsent] = useState(false)
  const [sending,setSending] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // 동의 상태 로드
  useEffect(() => {
    if (consentProp !== undefined) return // prop이 있으면 사용
    loadFamilyConsent().then(setHasFamilyConsent)
  }, [consentProp])

  useEffect(() => {
    if (!token) { fetched.current = null; return }
    // A one-time token is redeemed once even when React repeats the effect.
    if (fetched.current?.token !== token) {
      fetched.current = { token, pending: fetchResultByToken(token) }
    }
    let active = true
    setState({ status: 'loading' })
    setNeedsProcessingConsent(false)
    setError('')
    fetched.current.pending.then((r) => {
      if (!active) return
      if (r.ok) {
        beginCurrentResult(r.result)
        setState({ status: 'ok', result: r.result })
      } else {
        setState({ status: 'gone', reason: r.reason })
      }
      setParams({}, { replace: true }) // 주소창·방문 기록에 토큰을 남기지 않는다
    })
    return () => { active = false }
  }, [token, setParams])

  const askFamily = async (processingConsent = false) => {
    if(sending) return
    setSending(true);setError('')
    // F5-3: 가족 사칭이면 IMPERSONATION, 그 외(링크·일반)는 LINK_CHECK
    const requestType = state.result?.impersonation_type === 'family'
      ? REQUEST_TYPES.IMPERSONATION
      : REQUEST_TYPES.LINK_CHECK
    try {
      const active = await getCurrentRequest(null)
      if (!mounted.current || fetched.current || state.result.receipt !== loadCurrentResult()?.receipt) return
      if (active?.state === 'pending' || active?.state === 'responded') {
        const screen = active.state === 'responded' ? '/check/answer' : '/check/wait'
        navigate(screen, { state: { requestId: active.id } })
        return
      }
      const req = await confirmStore.create(state.result, { requestType,processingConsent:processingConsent===true })
      if (!fetched.current && bindCurrentRequest(state.result.receipt, req) && mounted.current) {
        navigate('/check/wait', { state: { requestId: req.id } })
      }
    } catch(e) {
      if(e.reason==='processing_consent_required')setNeedsProcessingConsent(true)
      else setError(e.message)
    } finally {setSending(false)}
  }

  return (
    <main id="main" className="mode-parent">
      <h1 className="visually-hidden">판별 결과</h1>
      {error && <p role="alert" className="screen-body">{error}</p>}
      {needsProcessingConsent && <section className="confirm-box" aria-label="확인 요청 기록 동의">
        <h2 className="screen-title">이번 요청의 기록을 남길까요?</h2>
        <p className="screen-body">가족의 답을 받기 위해 위험 단계·신호·요청과 응답을 24시간 보관해요. 삭제 작업은 10분마다 실행되며 백업에는 최대 7일 남을 수 있어요. 문자 원문은 남기지 않아요. 이번 요청에만 동의하며 설정의 ③은 바뀌지 않아요.</p>
        <div className="screen-actions"><ActionButton disabled={sending} onClick={()=>askFamily(true)}>동의하고 가족에게 물어보기</ActionButton>
        <ActionButton variant="secondary" onClick={()=>setNeedsProcessingConsent(false)}>보내지 않기</ActionButton></div>
      </section>}
      {state.status === 'loading' && <ResultSkeleton />}
      {state.status === 'gone' && <TokenExpiredView reason={state.reason} />}
      {state.status === 'empty' && <section><h1 className="screen-title">확인한 문자가 없어요</h1><p className="screen-body">문자를 확인하거나 고정 예시를 먼저 살펴보세요.</p><div className="screen-actions"><ActionButton onClick={()=>navigate('/check/input')}>문자 확인하기</ActionButton><ActionButton variant="secondary" onClick={()=>navigate('/demo')}>예시 보기</ActionButton></div></section>}
      {state.status === 'ok' && (
        <ResultView
          result={state.result}
          familyName={familyName}
          hasFamilyConsent={hasFamilyConsent}
          onAskFamily={askFamily}
          showReportLink
        />
      )}
      <NoLinkFooter />
    </main>
  )
}

/** U9: 로딩은 결과 화면 모양의 뼈대 */
function ResultSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="결과를 불러오는 중">
      <div className="skeleton__block skeleton__block--banner" />
      <div className="skeleton__block" />
      <div className="skeleton__block" />
      <div className="skeleton__block skeleton__block--button" />
    </div>
  )
}
