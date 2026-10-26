/**
 * S1(간소). 설정 /settings — Supabase Auth 전 로컬 전용
 *
 * 1차: 가족 확인 동의(②) 하나만. 나머지(S2~S6 가족 초대, 번호 등록, 탈퇴)는
 * Supabase circle_members / phone_auth 연결 뒤(4주차)에 추가한다.
 *
 * 동의를 끄면 ResultView의 "가족에게 물어보기" 버튼이 사라진다(F5-9).
 * storage 이벤트로 같은 기기의 다른 탭에도 즉시 반영된다.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { loadFamilyConsent, saveFamilyConsent } from '../data/consent.js'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const [consent, setConsent] = useState(loadFamilyConsent)

  const toggle = () => {
    const next = !consent
    saveFamilyConsent(next)
    setConsent(next)
  }

  // 다른 탭에서 바꾼 경우 동기화
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'fs.consent.family') setConsent(e.newValue === 'true')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <main className="mode-parent">
      <h1 className="screen-title">설정</h1>

      <section className="settings-section" aria-label="가족 확인 동의">
        <p className="settings-section__title">가족 확인 요청</p>
        <p className="screen-body">
          의심 문자를 판별하면 가족에게 직접 확인해 달라고 알릴 수 있어요.
          이 기능을 켜면 판별 결과 화면에서 가족에게 물어보기 버튼이 나와요.
        </p>
        <div className="settings-toggle-row">
          <span className="settings-toggle-label" id="consent-toggle-label">
            {consent ? '켜짐' : '꺼짐'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={consent}
            aria-labelledby="consent-toggle-label"
            className={`settings-toggle${consent ? ' settings-toggle--on' : ''}`}
            onClick={toggle}
          >
            <span className="settings-toggle__thumb" />
            <span className="visually-hidden">{consent ? '가족 확인 요청 끄기' : '가족 확인 요청 켜기'}</span>
          </button>
        </div>

        {consent && (
          <p className="screen-body settings-note">
            가족 초대와 번호 등록은 다음 업데이트에서 추가돼요.
          </p>
        )}
      </section>

      <div className="screen-actions">
        <ActionButton variant="secondary" onClick={() => navigate('/')}>처음으로</ActionButton>
      </div>
      <NoLinkFooter />
    </main>
  )
}
