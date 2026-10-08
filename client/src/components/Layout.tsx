import { Link, NavLink, Outlet } from 'react-router-dom'
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
  const isLive = !!status?.live

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" title="Home">
          <span className="mark">F1</span> DASHBOARD
        </Link>
        <nav className="nav">
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
