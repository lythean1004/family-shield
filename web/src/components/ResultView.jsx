/**
 * ResultView — P4 판별 결과 본문. P4(/check/result)와 D1 데모가 같이 쓴다(screen-spec D1).
 * 순서: 판정 → 이유 → 지금 할 일 → 행동 → 한계 (screen-spec 5장 P4)
 *
 * result: core pipeline analyze() 출력 모양
 *   { level, signals_final, impersonation_type, impersonated_relation,
 *     explanation_for_parent, fallback_used }
 * familyName: 가족 사칭일 때 버튼에 쓸 이름(모르면 '가족', P3는 2차)
 * hasFamilyConsent: 동의 ②(가족 확인) 여부 — 없으면 가족 확인 버튼 대신 공식 번호(F5-9)
 * demo: 데모면 버튼이 실제 흐름으로 가지 않음
 * onAskFamily: 가족 확인 요청을 만든 뒤 P6로 가는 함수(P4가 넘김). 없으면 /check/wait로만 이동
 * showReportLink: 한계 문구 아래 "이 판정이 이상해요"(F4-13, screen-spec P4)
 */
import { useNavigate } from 'react-router-dom'
import VerdictBanner from './VerdictBanner.jsx'
import SignalList from './SignalList.jsx'
import Warning112 from './Warning112.jsx'
import LimitNotice from './LimitNotice.jsx'
import ActionButton from './ActionButton.jsx'
import CallButton from './CallButton.jsx'
import MisjudgeLink from './MisjudgeLink.jsx'
import { levelKey, verdictDescription, AI_FALLBACK_TEXT } from '../data/result.js'
import { POLICE, sourceText } from '../data/contacts.js'

export default function ResultView({
  result, familyName, hasFamilyConsent = false, demo = false, onAskFamily, showReportLink = false,
}) {
  const navigate = useNavigate()
  const key = levelKey(result.level)
  const type = result.impersonation_type
  const who = familyName || result.impersonated_relation || '가족'
  const explanation = result.explanation_for_parent ?? []

  const askFamily = () => {
    if (demo) return navigate('/demo')
    if (onAskFamily) return onAskFamily()
    navigate('/check/wait')
  }
  const toContacts = () => navigate('/contacts')
  const toHelp = () => navigate('/help')

  return (
    <>
      <VerdictBanner level={key} description={verdictDescription(result.level, type)} />

      {key !== 'check' && (
        <section aria-label="이유">
          <SignalList signals={result.signals_final} impersonatedRelation={result.impersonated_relation} />
          {result.fallback_used ? (
            <p className="screen-body">{AI_FALLBACK_TEXT}</p>
          ) : (
            explanation.slice(0, 3).map((s) => (
              <p key={s} className="screen-body">{s}</p>
            ))
          )}
        </section>
      )}

      {key === 'danger' && (
        <>
          <p className="screen-body"><strong>링크를 누르지 말고, 돈을 보내지 마세요.</strong></p>
          <Warning112 />
        </>
      )}
      {key === 'caution' && (
        <p className="screen-body"><strong>링크를 누르지 마세요.</strong></p>
      )}

      <div className="screen-actions">
        {key === 'danger' && (
          <>
            {type === 'family' && hasFamilyConsent ? (
              <ActionButton variant="primary" onClick={askFamily}>
                {who}에게 진짜인지 물어보기
              </ActionButton>
            ) : (
              <ActionButton variant="primary" onClick={toContacts}>
                공식 번호로 직접 확인
              </ActionButton>
            )}
            <CallButton name={`${POLICE.name}에 전화`} number={POLICE.number} source={sourceText()} />
            <ActionButton variant="secondary" onClick={toHelp}>이미 눌렀거나 보냈어요</ActionButton>
          </>
        )}
        {key === 'caution' && (
          <>
            {hasFamilyConsent ? (
              <ActionButton variant="primary" onClick={askFamily}>가족에게 물어보기</ActionButton>
            ) : null}
            <ActionButton variant={hasFamilyConsent ? 'secondary' : 'primary'} onClick={toContacts}>
              공식 번호 보기
            </ActionButton>
            <ActionButton variant="secondary" onClick={toHelp}>이미 눌렀거나 보냈어요</ActionButton>
          </>
        )}
        {key === 'check' && (
          <>
            <ActionButton variant="primary" onClick={toContacts}>공식 번호 보기</ActionButton>
            {hasFamilyConsent && (
              <ActionButton variant="secondary" onClick={askFamily}>가족에게 물어보기</ActionButton>
            )}
          </>
        )}
      </div>

      <LimitNotice />
      {showReportLink && !demo && <MisjudgeLink result={result} />}
    </>
  )
}
