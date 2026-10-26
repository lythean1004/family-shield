/**
 * F4-2. 안드로이드 공유 수신 /share
 *
 * Web Share Target API (GET). 문자 앱의 공유 버튼 → 이 앱 → 입력 화면에 내용 미리 채움.
 * 아이폰은 Web Share Target을 지원하지 않으므로 안드로이드 전용(PRD F4-2).
 * manifest.json의 share_target.action이 이 경로를 가리킨다.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function ShareScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    // Web Share Target GET: ?text=…&title=…&url=…
    // 문자 앱은 보통 text만 보낸다.
    const text = [params.get('text'), params.get('title'), params.get('url')]
      .filter(Boolean)
      .join('\n')
      .trim()

    // InputScreen이 location.state.sharedText를 읽어 초기값으로 쓴다.
    navigate('/check/input', { replace: true, state: { sharedText: text } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
