// 라우팅 뼈대 (docs/frontend-structure.md 2장: 앱 하나, 화면은 역할별)
// 화면 내용은 Figma 시안 뒤에 채운다. 지금은 경로와 공통 문구만 둔다.
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'

// project.md의 결과 화면 한계 문구(모든 결과 화면에 표시, F4-8)
export const LIMIT_NOTICE =
  '이 결과는 참고용입니다. 정상 메시지를 위험으로 보거나 위험한 메시지를 놓칠 수 있습니다. ' +
  '확실하지 않으면 메시지 속 번호나 링크가 아닌, 직접 찾은 공식 번호로 확인하세요.'

function Home() {
  return (
    <main>
      <h1>가족방패</h1>
      <p>의심 문자를 받으면 카카오톡 채널에 붙여 넣어 확인하세요.</p>
      <p className="notice">가족방패는 먼저 링크를 보내지 않습니다.</p>
      <nav>
        <Link to="/contacts">공식 번호 카드</Link>
        <Link to="/demo">예시 보기</Link>
      </nav>
    </main>
  )
}

// 오프라인에서도 보이는 112 카드(PRD 12-1: 인증 없이, 캐시)
function Contacts() {
  return (
    <main>
      <h1>공식 번호</h1>
      <a className="call" href="tel:112">112 경찰</a>
      <p>가족이 등록한 번호 카드는 로그인 후 보입니다.</p>
    </main>
  )
}

// 공개 데모: 고정 콘텐츠만, AI 호출 없음(PRD 12-5)
function Demo() {
  return (
    <main>
      <h1>예시 보기</h1>
      <p>준비 중입니다. 미리 정한 예시 문자와 결과만 보여 줍니다.</p>
      <p className="limit">{LIMIT_NOTICE}</p>
    </main>
  )
}

function Placeholder({ title }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>준비 중입니다.</p>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/demo" element={<Demo />} />
        {/* 부모님 화면(P1~P8), 보호자 화면(C1~C4, S1~S6)은 로그인 구현 뒤 */}
        <Route path="/check/*" element={<Placeholder title="판별 결과" />} />
        <Route path="/family/*" element={<Placeholder title="가족용 화면" />} />
        <Route path="*" element={<Placeholder title="페이지를 찾을 수 없어요" />} />
      </Routes>
    </BrowserRouter>
  )
}
