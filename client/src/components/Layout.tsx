import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveStatus } from '../hooks/useLiveStatus'
import { useI18n, type Lang, type TKey } from '../i18n/core'
import CookieBanner from './CookieBanner'
import Footer from './Footer'

const links: { to: string; label: TKey }[] = [
  { to: '/live', label: 'nav.live' },
  { to: '/standings', label: 'nav.standings' },
  { to: '/calendar', label: 'nav.calendar' },
  { to: '/circuits', label: 'nav.circuits' },
  { to: '/drivers', label: 'nav.drivers' },
  { to: '/teams', label: 'nav.teams' },
  { to: '/compare', label: 'nav.compare' },
  { to: '/telemetry', label: 'nav.telemetry' },
]

const langs: { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'uk', label: 'UA', name: 'Українська' },
]

// Compact EN | UA switch in the header (stays visible next to the burger on
// phones). The choice is remembered in this browser.
function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {langs.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          className={lang === l.code ? 'on' : undefined}
          aria-pressed={lang === l.code}
          title={l.name}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { t } = useI18n()
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
        <Link to="/" className="brand" title={t('nav.home')}>
          <span className="mark">F1</span> DASHBOARD
        </Link>
        <LangSwitch />
        <button
          type="button"
          className="nav-toggle"
          aria-label={t(menuOpen ? 'nav.closeMenu' : 'nav.openMenu')}
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
                  title={t(isLive ? 'nav.liveOn' : 'nav.liveOff')}
                />
              )}
              {t(l.label)}
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
