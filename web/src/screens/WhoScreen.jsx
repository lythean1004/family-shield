/**
 * P3. 가족 관계 고르기 /check/who (PRD F4-7)
 *
 * 사칭 유형이 'unknown'(가족인 척하되 관계를 모름)일 때 부모님이 직접 고른다.
 * 고르면 impersonation_type을 'family'로, impersonated_relation을 선택값으로 채우고
 * P4(/check/result)로 간다. 판정 단계는 규칙 엔진이 이미 SIG_FAMILY_IMPERSONATION
 * 신호로 처리 했으므로 여기서는 화면용 필드만 보충한다.
 */
import { useNavigate } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { loadCurrentResult, saveCurrentResult } from '../data/session.js'

const RELATIONS = ['아들', '딸', '남편', '아내', '엄마', '아빠', '형', '오빠', '누나', '언니', '동생']

export default function WhoScreen({ fallbackResult }) {
  const navigate = useNavigate()

  const pick = (relation) => {
    const current = loadCurrentResult() ?? fallbackResult
    const next = {
      ...current,
      impersonation_type: 'family',
      impersonated_relation: relation,
    }
    saveCurrentResult(next)
    navigate('/check/result')
  }

  return (
    <main className="mode-parent">
      <h1 className="screen-title">누가 보낸 척했나요?</h1>
      <p className="screen-body">문자에서 가족인 척했지만 누구인지 못 찾았어요. 가장 비슷한 관계를 골라 주세요.</p>

      <ul className="action-choice-list" role="radiogroup" aria-label="가족 관계">
        {RELATIONS.map((r) => (
          <li key={r}>
            <button
              type="button"
              className="demo-list__btn"
              role="radio"
              aria-checked="false"
              onClick={() => pick(r)}
            >
              {r}
            </button>
          </li>
        ))}
      </ul>

      <div className="screen-actions">
        <ActionButton variant="secondary" onClick={() => navigate('/check/result')}>모르겠어요</ActionButton>
      </div>
      <NoLinkFooter />
    </main>
  )
}
