/**
 * P1. 문자 붙여넣기 /check/input (PRD F4-1, F4-4)
 *
 * 카카오톱 채널이 아니어도 웹에서 직접 문자를 판별 받을 수 있게 한다.
 * 캡처 사진 올리기는 개인정보 보호 검토(D24) 전이라 붙여넣기만 허용한다.
 *
 * 흐름:
 *   입력 → POST /api/analyze → 결과 sessionStorage 저장 → /check/result
 *   실패: 서버 429(한도 초과)·500·네트워크 오류 각각 안내
 *
 * 입력 길이 상한은 서버(MAX_INPUT_CHARS=2000)와 같다. 넘기면 버튼이 비활성화.
 */
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ActionButton from '../components/ActionButton.jsx'
import NoLinkFooter from '../components/NoLinkFooter.jsx'
import { saveCurrentResult } from '../data/session.js'

const MAX_CHARS = 2000
const MIN_CHARS = 2

function analyzeText(text, { fetchImpl = fetch, base = '' } = {}) {
  return fetchImpl(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json', 'x-fs-request': '1' },
    credentials: 'same-origin',
    body: JSON.stringify({ text }),
    cache: 'no-store',
  }).then(async (res) => {
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  })
}

export default function InputScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  // F4-2: Web Share Target이 /share → 이 화면으로 리다이렉트하며 sharedText를 state로 넘긴다.
  const [text, setText] = useState(() => location.state?.sharedText ?? '')
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState(null)

  const len = [...text].length
  const canSubmit = status !== 'loading' && len >= MIN_CHARS && len <= MAX_CHARS

  const submit = async () => {
    setStatus('loading')
    setError(null)
    try {
      const { status: http, body } = await analyzeText(text)
      if (http === 200 && body?.ok && body.result) {
        saveCurrentResult(body.result)
        navigate('/check/result')
        return
      }
      if (http === 401) {
        setError('먼저 설정에서 가족 연결을 시작해 주세요.')
      } else if (http === 429) {
        setError('조금 전에 여러 번 물어보셨어요. 1분 뒤에 다시 시도해 주세요.')
      } else if (http === 400 && body?.reason === 'too_long') {
        setError('글이 너무 길어요. 2000자 이내로 줄여 주세요.')
      } else if (http === 400 && body?.reason === 'empty') {
        setError('판별할 문자 내용을 붙여 넣어 주세요.')
      } else if (http >= 500) {
        setError('지금은 확인이 어렵습니다. 잠시 후 다시 시도해 주세요.')
      } else {
        setError('지금은 확인이 어렵습니다. 잠시 후 다시 시도해 주세요.')
      }
      setStatus('error')
    } catch {
      setError('인터넷 연결을 확인해 주세요.')
      setStatus('error')
    }
  }

  return (
    <main id="main" className="mode-parent">
      <h1 className="screen-title">의심 문자 붙여넣기</h1>
      <p className="screen-body">
        받은 문자를 그대로 복사해 붙여 넣으세요. 판별한 뒤 결과 화면으로 안내해요.
      </p>

      <label className="input-textarea-label" htmlFor="fs-input-text">문자 내용</label>
      {/* F3-5: 입력창에 암호 경고 — 가족 암호를 여기 입력하면 안 됨을 명시 */}
      <p className="input-passphrase-warning" aria-live="polite">
        가족 암호는 여기에 쓰지 마세요.
      </p>
      <textarea
        id="fs-input-text"
        className="input-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 엄마 폰이 고장나서 잠깐 이 번호로 연락해요. 문화상품권 사 줄 수 있어?"
        maxLength={MAX_CHARS}
        rows={6}
        aria-describedby="fs-input-count"
        disabled={status === 'loading'}
      />
      <p id="fs-input-count" className="input-count" aria-live="polite">
        {len} / {MAX_CHARS}자
      </p>

      {error && (
        <p className="screen-body" role="alert">{error}</p>
      )}

      <div className="screen-actions">
        <ActionButton
          variant="primary"
          onClick={submit}
          disabled={!canSubmit}
        >
          {status === 'loading' ? '판별 중...' : '판별 받기'}
        </ActionButton>
        <ActionButton variant="secondary" onClick={() => navigate('/')}>처음으로</ActionButton>
      </div>

      <NoLinkFooter />
    </main>
  )
}
