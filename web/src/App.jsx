// 라우팅 뼈대 (docs/frontend-structure.md 2장: 앱 하나, 화면은 역할별)
// 화면은 디자인 토큰 + React 컴포넌트로 직접 구현한다(코드가 디자인 산출물, D31).
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'

import HomeScreen       from './screens/HomeScreen.jsx'
import ContactsScreen   from './screens/ContactsScreen.jsx'
import DemoScreen       from './screens/DemoScreen.jsx'
import HangupScreen     from './screens/HangupScreen.jsx'
import ResultScreen     from './screens/ResultScreen.jsx'
import HelpScreen       from './screens/HelpScreen.jsx'
import CallScreen       from './screens/CallScreen.jsx'
import WaitScreen       from './screens/WaitScreen.jsx'
import AnswerScreen     from './screens/AnswerScreen.jsx'
import FamilyScreen     from './screens/FamilyScreen.jsx'
import InputScreen      from './screens/InputScreen.jsx'
import WhoScreen        from './screens/WhoScreen.jsx'
import CallResultScreen from './screens/CallResultScreen.jsx'
import NoLinkFooter     from './components/NoLinkFooter.jsx'
import TopNav           from './components/TopNav.jsx'
import { DEV_RESULT } from './data/result.js'
import SettingsScreen   from './screens/SettingsScreen.jsx'
import ShareScreen       from './screens/ShareScreen.jsx'
import QuizScreen        from './screens/QuizScreen.jsx'
import FamilyDashboardScreen from './screens/FamilyDashboardScreen.jsx'

// 없는 주소(B10 404). 부모님이 길을 잃지 않도록 큰 글씨 + 처음으로 버튼 하나.
function NotFound() {
  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title">찾는 화면이 없어요</h1>
      <p className="screen-body">주소가 바뀌었거나 잘못 들어왔어요. 아래 버튼을 누르면 처음 화면으로 갑니다.</p>
      <div className="screen-actions">
        <Link className="action-btn action-btn--primary" to="/">처음으로</Link>
      </div>
      <NoLinkFooter />
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {/* B10: 키보드·화면 읽기 사용자가 본문으로 바로 가는 링크. 초점을 받을 때만 보인다 */}
      <a className="skip-link" href="#main">본문으로 바로가기</a>
      {/* 전체 메뉴: 어느 화면에서든 처음으로 돌아갈 수 있게 맨 위에 고정 (보호자 화면 제외) */}
      <TopNav />
      <Routes>
        <Route path="/"               element={<HomeScreen />} />
        <Route path="/contacts"       element={<ContactsScreen />} />
        <Route path="/demo"           element={<DemoScreen />} />
        <Route path="/help"           element={<HelpScreen />} />
        <Route path="/settings"       element={<SettingsScreen />} />

        {/* 부모님 판별 흐름. 결과는 ?t= 1회용 토큰(D34) → 이 탭 sessionStorage → 없으면 개발용 가짜 결과 */}
        <Route path="/check/hangup"      element={<HangupScreen />} />
        {/* 가족 확인 버튼은 동의 ②가 있을 때만(F5-9). ResultScreen이 화면을 열 때 기기 동의를 읽는다. */}
        <Route path="/check/result"      element={<ResultScreen fallbackResult={DEV_RESULT} />} />
        <Route path="/check/call"        element={<CallScreen fallbackResult={DEV_RESULT} />} />
        <Route path="/check/wait"        element={<WaitScreen />} />
        <Route path="/check/answer"      element={<AnswerScreen fallbackResult={DEV_RESULT} />} />
        <Route path="/check/input"       element={<InputScreen />} />
        <Route path="/check/who"         element={<WhoScreen fallbackResult={DEV_RESULT} />} />
        <Route path="/check/callresult"  element={<CallResultScreen fallbackResult={DEV_RESULT} />} />

        {/* F5-10: 보호자 대시보드 — /family/* 앞에 두어 순서도 명시적으로 보장 */}
        <Route path="/family/dashboard" element={<FamilyDashboardScreen />} />
        {/* 보호자 화면 C2·C3. 로그인·대상자 확인은 4주차(Supabase Auth) */}
        <Route path="/family/*"       element={<FamilyScreen />} />

        {/* F4-2: 안드로이드 공유 수신 */}
        <Route path="/share"          element={<ShareScreen />} />
        {/* F7: 연습 모드 퀴즈 */}
        <Route path="/quiz"           element={<QuizScreen />} />

        <Route path="*"               element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

