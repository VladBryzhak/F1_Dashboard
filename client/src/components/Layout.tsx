import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Standings', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/teams', label: 'Teams' },
  { to: '/telemetry', label: 'Telemetry' },
]

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <span className="mark">F1</span> DASHBOARD
        </span>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
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
