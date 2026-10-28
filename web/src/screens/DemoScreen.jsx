/**
 * D1. 공개 데모 /demo — 고정 예시 SC1~SC4(AI 호출 없음, DB 읽지 않음, PRD 12-5).
 * 결과는 P4와 같은 ResultView로 보여 준다. 맨 위에 '예시' 띠 고정.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ResultView from '../components/ResultView.jsx'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { DEMO_SCENARIOS } from '../data/demo.js'
import { levelKey } from '../data/result.js'

const BADGE = { danger: '위험', caution: '주의', check: '확인 필요' }

export default function DemoScreen() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(null)
  const sc = DEMO_SCENARIOS.find((s) => s.id === selectedId)

  return (
    <main id="main" className="mode-parent">
      <p className="demo-badge" role="note">예시</p>

      {!sc && (
        <>
          <h1 className="screen-title">예시 보기</h1>
          <p className="screen-body">
            실제 사기 문자를 바꿔 만든 예시예요. 실제 판별은 카카오톡 채널에서 해요.
          </p>
          <ul className="demo-list">
            {DEMO_SCENARIOS.map((s) => {
              const key = s.result ? levelKey(s.result.level) : 'danger'
              return (
                <li key={s.id}>
                  <button type="button" className="demo-list__btn" onClick={() => setSelectedId(s.id)}>
                    <span className={`demo-list__badge demo-list__badge--${key}`}>
                      {s.result ? BADGE[key] : '사후 대응'}
                    </span>
                    {s.title}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {sc && (
        <>
          <section className="demo-message" aria-label="예시 문자">
            {sc.callContext && <p className="demo-message__context">{sc.callContext}</p>}
            <p className="demo-message__text">{sc.message}</p>
          </section>
          {sc.result ? (
            <ResultView
              result={sc.result}
              familyName={sc.result.impersonated_relation}
              hasFamilyConsent
              demo
            />
          ) : (
            <div className="screen-actions">
              <p className="screen-body">이미 링크를 눌렀다면 이렇게 안내해요.</p>
              <ActionButton variant="primary" onClick={() => navigate('/help')}>
                사후 대응 보기
              </ActionButton>
            </div>
          )}
          <div className="screen-actions">
            <ActionButton variant="secondary" onClick={() => setSelectedId(null)}>
              다른 예시 보기
            </ActionButton>
          </div>
        </>
      )}
      <NoLinkFooter />
    </main>
  )
}
