// 라우팅 뼈대 (docs/frontend-structure.md 2장: 앱 하나, 화면은 역할별)
// 화면은 디자인 토큰 + React 컴포넌트로 직접 구현한다(코드가 디자인 산출물, D31).
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'

import HomeScreen    from './screens/HomeScreen.jsx'
import ContactsScreen from './screens/ContactsScreen.jsx'
import DemoScreen    from './screens/DemoScreen.jsx'
import HangupScreen  from './screens/HangupScreen.jsx'
import ResultScreen  from './screens/ResultScreen.jsx'
import HelpScreen    from './screens/HelpScreen.jsx'
import NoLinkFooter  from './components/NoLinkFooter.jsx'
import { DEV_RESULT } from './data/result.js'

function Placeholder({ title }) {
  return (
    <main>
      <h1 className="screen-title">{title}</h1>
      <p className="screen-body">준비 중입니다.</p>
      <NoLinkFooter />
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<HomeScreen />} />
        <Route path="/contacts"       element={<ContactsScreen />} />
        <Route path="/demo"           element={<DemoScreen />} />
        <Route path="/help"           element={<HelpScreen />} />

        {/* 부모님 판별 흐름 */}
        <Route path="/check/hangup"   element={<HangupScreen />} />
        {/* /check/result: 실제 서비스에서는 URL 토큰(D34)으로 판별 건을 받음. 지금은 가짜 데이터 */}
        <Route path="/check/result"   element={<ResultScreen result={DEV_RESULT} hasFamilyConsent />} />
        <Route path="/check/call"     element={<Placeholder title="전화 받았는지" />} />
        <Route path="/check/wait"     element={<Placeholder title="가족 답 기다리는 중" />} />
        <Route path="/check/answer"   element={<Placeholder title="가족 답 반영 결과" />} />

        {/* 보호자 화면 (Supabase 연결 뒤) */}
        <Route path="/family/*"       element={<Placeholder title="가족용 화면" />} />

        <Route path="*"               element={<Placeholder title="페이지를 찾을 수 없어요" />} />
      </Routes>
    </BrowserRouter>
  )
}

