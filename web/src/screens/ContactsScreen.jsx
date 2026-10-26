/**
 * N1. 공식 번호 카드 /contacts
 * 112 맨 위 고정(F2-4) → 근거 카드 active 번호만(U7). 오프라인에서도 보인다(F2-6, 서비스 워커 캐시).
 * 하지 않는 것: 검색창, 번호 직접 입력.
 */
import CallButton from '../components/CallButton.jsx'
import OfflineBanner from '../components/OfflineBanner.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { OFFICIAL_CONTACTS, sourceText } from '../data/contacts.js'

export default function ContactsScreen() {
  return (
    <main className="mode-parent">
      <OfflineBanner />
      <h1 className="screen-title">공식 번호</h1>
      <p className="screen-body">문자에 적힌 번호 말고, 여기 있는 번호로 직접 거세요.</p>
      <div className="contact-list">
        {OFFICIAL_CONTACTS.map((c) => (
          <CallButton key={c.id} name={c.name} number={c.number} source={sourceText()} />
        ))}
      </div>
      <NoLinkFooter />
    </main>
  )
}
