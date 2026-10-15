import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveStatus } from '../hooks/useLiveStatus'
import CookieBanner from './CookieBanner'
import Footer from './Footer'

const links = [
  { to: '/live', label: 'Live' },
  { to: '/standings', label: 'Standings' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/teams', label: 'Teams' },
  { to: '/compare', label: 'Compare' },
  { to: '/telemetry', label: 'Telemetry' },
]

export default function Layout() {
  const status = useLiveStatus(60000)
  // A session is on whether we can read it (live) or OpenF1 has locked us out.
  const isLive = !!status?.live || !!status?.locked

  // Phone menu: the nav becomes a dropdown opened by a burger button.
  const [menuOpen, setMenuOpen] = useState(false)
  const topbarRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // Close after navigating.
  useEffect(() => setMenuOpen(false), [pathname])

  // Close on Escape or a click/tap outside the header.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    const onPointer = (e: PointerEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menuOpen])

  return (
    <div className="app">
      <header
        ref={topbarRef}
        className={`topbar${menuOpen ? ' menu-open' : ''}`}
      >
        <Link to="/" className="brand" title="Home">
          <span className="mark">F1</span> DASHBOARD
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            )}
          </svg>
          {isLive && !menuOpen && <span className="nav-toggle-dot" aria-hidden="true" />}
        </button>
        <nav className="nav" id="site-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {l.to === '/live' && (
                <span
                  className={`nav-live-dot${isLive ? ' on' : ''}`}
                  title={isLive ? 'Session live now' : 'No session live'}
                />
              )}
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  )
}
