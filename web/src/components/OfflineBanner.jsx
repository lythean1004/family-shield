/**
 * OfflineBanner — 오프라인일 때 안내 (F2-6)
 */
import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (online) return null
  return (
    <p className="offline-banner" role="status">
      인터넷이 끊겼어요. 112와 번호 카드는 볼 수 있어요.
    </p>
  )
}
