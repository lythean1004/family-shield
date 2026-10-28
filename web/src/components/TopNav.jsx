/**
 * 전체 메뉴 (모든 부모님·공개 화면 맨 위, 스크롤해도 고정)
 *
 * 왼쪽: 처음으로(홈에서는 '가족방패'). 오른쪽: 메뉴 열기/닫기.
 * 아이콘만 두지 않고 글자를 함께 쓴다. 지금 화면은 aria-current로 표시.
 * Esc·닫기·바깥 누르기·화면 이동으로 닫힌다. 열면 첫 항목으로, 닫으면 메뉴 버튼으로 초점을 옮긴다.
 */
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS, showNav } from '../data/nav.js'

export default function TopNav() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const toggleRef = useRef(null)
  const firstLinkRef = useRef(null)
  const wasOpen = useRef(false)

  // 화면이 바뀌면 닫는다
  useEffect(() => { setOpen(false) }, [pathname])

  // 초점 옮기기
  useEffect(() => {
    if (open) firstLinkRef.current?.focus()
    else if (wasOpen.current) toggleRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!showNav(pathname)) return null
  const atHome = pathname === '/'

  return (
    <header className={`top-nav mode-parent${open ? ' top-nav--open' : ''}`}>
      <nav className="top-nav__bar" aria-label="전체 메뉴">
        <NavLink to="/" end className="top-nav__home">
          {atHome ? '가족방패' : (<><span aria-hidden="true">←</span> 처음으로</>)}
        </NavLink>
        <button
          ref={toggleRef}
          type="button"
          className="top-nav__toggle"
          aria-expanded={open}
          aria-controls="top-nav-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="top-nav__icon" aria-hidden="true"><i /><i /><i /></span>
          {open ? '닫기' : '메뉴'}
        </button>
      </nav>

      {open && (
        <>
          <div className="top-nav__backdrop" onClick={() => setOpen(false)} />
          <div id="top-nav-panel" className="top-nav__panel">
            <ul className="top-nav__list">
              {NAV_ITEMS.map((item, i) => (
                <li key={item.to}>
                  <NavLink
                    ref={i === 0 ? firstLinkRef : undefined}
                    to={item.to}
                    end={item.to === '/'}
                    className={`action-btn action-btn--${item.variant ?? 'secondary'} top-nav__link`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </header>
  )
}
