/**
 * P4. 판별 결과 /check/result
 * 실제 서비스: 챗봇 [자세히 보기]의 1회용 토큰 ?t=(D34, PRD 13-4)로 결과를 조회한다.
 * 지금(Supabase·토큰 연결 전): props로 받은 개발용 가짜 결과를 보여 준다.
 */
import ResultView from '../components/ResultView.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'

export default function ResultScreen({ result, familyName, hasFamilyConsent }) {
  return (
    <main className="mode-parent">
      <h1 className="visually-hidden">판별 결과</h1>
      <ResultView result={result} familyName={familyName} hasFamilyConsent={hasFamilyConsent} />
      <NoLinkFooter />
    </main>
  )
}
