/**
 * P4. 판별 결과 /check/result
 *
 * ?t=토큰 이 있으면(챗봇 [자세히 보기], D34) 스킬 서버에서 한 번 조회하고 주소에서 지운다.
 *   - 만료·사용됨·없음 → TokenExpiredView(PRD 13-4)
 *   - 받은 결과는 이 탭 sessionStorage에만(P6·P8·새로고침용)
 * 토큰이 없으면 이 탭의 현재 결과, 그것도 없으면 개발용 가짜 결과.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ResultView from '../components/ResultView.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import TokenExpiredView from '../components/TokenExpiredView.jsx'
import {
  fetchResultByToken, loadCurrentResult, saveCurrentResult, saveCurrentRequestId,
} from '../data/session.js'
import { confirmStore } from '../data/confirm.js'

export default function ResultScreen({ fallbackResult, familyName, hasFamilyConsent }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const token = params.get('t')
  const [state, setState] = useState(() =>
    token ? { status: 'loading' } : { status: 'ok', result: loadCurrentResult() ?? fallbackResult },
  )
  const fetched = useRef(false)

  useEffect(() => {
    if (!token || fetched.current) return // StrictMode 이중 실행에서 1회용 토큰을 두 번 쓰지 않도록
    fetched.current = true
    fetchResultByToken(token).then((r) => {
      if (r.ok) {
        saveCurrentResult(r.result)
        setState({ status: 'ok', result: r.result })
      } else {
        setState({ status: 'gone', reason: r.reason })
      }
      setParams({}, { replace: true }) // 주소창·방문 기록에 토큰을 남기지 않는다
    })
  }, [token, setParams])

  const askFamily = () => {
    saveCurrentResult(state.result)
    const req = confirmStore.create(state.result)
    saveCurrentRequestId(req.id)
    navigate('/check/wait')
  }

  return (
    <main className="mode-parent">
      <h1 className="visually-hidden">판별 결과</h1>
      {state.status === 'loading' && <ResultSkeleton />}
      {state.status === 'gone' && <TokenExpiredView reason={state.reason} />}
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
