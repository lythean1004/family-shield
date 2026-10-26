// 라우팅 뼈대 (docs/frontend-structure.md 2장: 앱 하나, 화면은 역할별)
// 화면은 디자인 토큰 + React 컴포넌트로 직접 구현한다(코드가 디자인 산출물, D31).
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { DEV_RESULT } from './data/result.js'
import SettingsScreen   from './screens/SettingsScreen.jsx'
import ShareScreen       from './screens/ShareScreen.jsx'
import QuizScreen        from './screens/QuizScreen.jsx'
import FamilyDashboardScreen from './screens/FamilyDashboardScreen.jsx'

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

        <Route path="*"               element={<Placeholder title="페이지를 찾을 수 없어요" />} />
      </Routes>
    </BrowserRouter>
  )
}

