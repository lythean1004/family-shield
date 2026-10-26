/**
 * SpeakButton — 결과 읽어주기 (PRD F4-12)
 *
 * Web Speech API(SpeechSynthesis). 음성·텍스트를 서버로 보내지 않는다.
 * 한국어(ko-KR)가 가능한 환경에서만 버튼이 보인다.
 *  - 처음 누르면 판정·이유·한계 문구를 순서대로 읽는다.
 *  - 읽는 중에 다시 누르면 멈춘다.
 *  - 읽기가 끝나면 버튼 라벨이 "다시 듣기"로 바뀐다.
 */
import { useEffect, useState } from 'react'

function pickKoreanVoice(synth) {
  const voices = synth.getVoices()
  return voices.find((v) => /^ko(-|$|_)/i.test(v.lang)) || null
}

export default function SpeakButton({ text, label = '음성으로 듣기', stopLabel = '멈추기', replayLabel = '다시 듣기' }) {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [done, setDone] = useState(false)

  // 단일 useEffect: 지원 여부 파악 + 한국어 음성 비동기 로드 + 재생 종료 감지를 한 곳에서 처리.
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!synth || typeof synth.speak !== 'function') return undefined

    // 버튼 표시 여부: 한국어 음성이 하나라도 있어야 한다. 목록은 비동기로 로드될 수 있다.
    const updateSupport = () => { if (pickKoreanVoice(synth)) setSupported(true) }
    updateSupport()
    synth.addEventListener?.('voiceschanged', updateSupport)

    // utterance.onend로 충분하지만, 페이지가 다른 곳으로 이동한 뒤에도 멈춤 상태가
    // 풀리지 않는 구형 엔진이 있어 'end' 이벤트로 보조한다.
    const onEnd = () => setSpeaking(false)
    synth.addEventListener?.('end', onEnd)

    return () => {
      synth.removeEventListener?.('voiceschanged', updateSupport)
      synth.removeEventListener?.('end', onEnd)
    }
  }, [])

  if (!supported) return null

  const toggle = () => {
    const synth = window.speechSynthesis
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(String(text ?? ''))
    u.lang = 'ko-KR'
    const v = pickKoreanVoice(synth)
    if (v) u.voice = v
    u.onend = () => { setSpeaking(false); setDone(true) }
    u.onerror = () => setSpeaking(false)
    synth.cancel()
    synth.speak(u)
    setSpeaking(true)
    setDone(false)
  }

  const currentLabel = speaking ? stopLabel : done ? replayLabel : label
  return (
    <button
      type="button"
      className="speak-btn"
      onClick={toggle}
      aria-label={currentLabel}
      aria-pressed={speaking}
    >
      <span aria-hidden="true">{speaking ? '■' : '♪'}</span> {currentLabel}
    </button>
  )
}
