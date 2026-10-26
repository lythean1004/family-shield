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

      {/* F5-10: 보호자 대시보드 링크 */}
      <section className="settings-section" aria-label="보호자 대시보드">
        <p className="settings-section__title">보호자 화면</p>
        <p className="screen-body">
          최근 24시간의 확인 요청과 응답 상태를 볼 수 있어요.
        </p>
        <div className="screen-actions">
          <ActionButton variant="secondary" onClick={() => navigate('/family/dashboard')}>
            확인 요청 내역 보기
          </ActionButton>
        </div>
      </section>

      <div className="screen-actions">
        <ActionButton variant="secondary" onClick={() => navigate('/')}>처음으로</ActionButton>
      </div>

      {/* F3-1: 암호 정하는 방법 안내 */}
      <section className="settings-section" aria-label="가족 암호">
        <p className="settings-section__title">가족 암호 정하기 (F3-1)</p>
        <p className="screen-body">
          사기범이 가족인 척 연락할 때 바로 확인할 수 있는 암호를 미리 정해 두세요.
        </p>
        <ul className="settings-list">
          <li>질문과 답 형태로 정하세요. 예: "우리 강아지 이름이 뭐야?"</li>
          <li>SNS나 인터넷에 나온 적 없는 내용으로 정하세요.</li>
          <li>반드시 <strong>만나거나 목소리로 통화할 때</strong> 말로 정하세요. 문자·카카오톡으로 보내지 마세요.</li>
        </ul>
        <p className="screen-body settings-note">
          암호를 이 앱에 저장하지 마세요. 가족끼리 기억만 해 두세요.
        </p>
      </section>

      {/* F3-3: 가족 약속 3가지 */}
      <section className="settings-section" aria-label="가족 약속">
        <p className="settings-section__title">가족 약속 3가지 (F3-3)</p>
        <ol className="settings-list">
          <li>
            <strong>새 번호로 연락이 오면</strong> — 원래 알던 번호로 직접 전화해서 확인하세요.
          </li>
          <li>
            <strong>가족이라며 전화가 오면</strong> — 암호를 물어보세요. 모르면 가족이 아니에요.
          </li>
          <li>
            <strong>돈 얘기는 목소리로 통화한 뒤에만</strong> — 문자·카카오톡으로 온 송금 요청은 절대 응하지 마세요.
          </li>
        </ol>
      </section>

      <NoLinkFooter />
    </main>
  )
}
