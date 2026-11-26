import { StrictMode, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyContrast, CONTRAST_KEY, ContrastContext, nextPref, readPref, resolveContrast } from './data/contrast-pref.js'

const more = window.matchMedia?.('(prefers-contrast: more)')
const forced = window.matchMedia?.('(forced-colors: active)')
function subscribeToDevice(callback) {
  more?.addEventListener('change', callback)
  forced?.addEventListener('change', callback)
  return () => {
    more?.removeEventListener('change', callback)
    forced?.removeEventListener('change', callback)
  }
}

function deviceMode(pref) {
  return resolveContrast(pref, { prefersMore: more?.matches, forcedColors: forced?.matches })
}

function readDevicePref() {
  try { return readPref(window.localStorage) } catch { return 'auto' }
}

const initialPref = readDevicePref()
applyContrast(document, deviceMode(initialPref))

function AppWithContrast() {
  const [pref, setPref] = useState(initialPref)
  const mode = useSyncExternalStore(subscribeToDevice, () => deviceMode(pref))
  useLayoutEffect(() => { applyContrast(document, mode) }, [mode])
  useEffect(() => {
    function sync(event) {
      if (event.key === CONTRAST_KEY || event.key === null) setPref(readDevicePref())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function toggleContrast() {
    const next = nextPref(mode)
    setPref(next)
    try { window.localStorage.setItem(CONTRAST_KEY, next) } catch { /* 이번 탭에서만 적용 */ }
  }

  return (
    <ContrastContext.Provider value={{ highContrast: mode === 'high', toggleContrast }}>
      <App />
    </ContrastContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithContrast />
  </StrictMode>,
)
