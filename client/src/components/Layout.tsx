import { Link, NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/standings', label: 'Standings' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/teams', label: 'Teams' },
  { to: '/telemetry', label: 'Telemetry' },
]

export default function Layout() {
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
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
