import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveStatus } from '../hooks/useLiveStatus'
import { useI18n, type Lang, type TKey } from '../i18n/core'
import CookieBanner from './CookieBanner'
import SearchPalette from './SearchPalette'
import Footer from './Footer'
import ErrorBoundary from './ErrorBoundary'
import ErrorScreen from './ErrorScreen'
import type { LayoutContext } from './layoutContext'
import './Layout.css'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const outlet = useMemo<LayoutContext>(() => ({ openSearch: () => setSearchOpen(true) }), [])

  // ⌘K / Ctrl+K anywhere, or "/" when not typing, opens the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((o) => !o)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
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
      {/* First stop for the keyboard: past the header to the page. */}
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <header
        ref={topbarRef}
        className={`topbar${menuOpen ? ' menu-open' : ''}`}
      >
        <Link to="/" className="brand" title={t('nav.home')}>
          <span className="mark">PT</span> PADDOCK TIMES
        </Link>
        <button
          type="button"
          className="search-btn"
          onClick={() => {
            setMenuOpen(false)
            setSearchOpen(true)
          }}
          aria-label={t('search.label')}
          title={`${t('search.label')} (${isMac ? '⌘' : 'Ctrl+'}K)`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <kbd className="search-kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
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
      <main className="content" id="main" tabIndex={-1}>
        {/* A page that fails to render shows a way out inside the frame;
            moving to another page clears it. */}
        <ErrorBoundary resetKey={pathname} fallback={(error) => <ErrorScreen error={error} />}>
          <Outlet context={outlet} />
        </ErrorBoundary>
      </main>
      <Footer />
      <CookieBanner />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
