import { Link } from 'react-router-dom'

// Global site footer. Carries the data/image attributions we're obliged to show
// (f1db is CC-BY 4.0), an independence + trademark disclaimer so we don't imply
// any official tie to Formula 1, an analytics disclosure (we run GA4), and a set
// of quick links that double as internal linking for search engines. Laid out as
// columns spread across the full content width.
const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/standings', label: 'Standings' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/teams', label: 'Teams' },
  { to: '/compare', label: 'Compare' },
  { to: '/telemetry', label: 'Telemetry' },
  { to: '/feedback', label: 'Feedback' },
]

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-brand">
          <div className="footer-logo">
            <span className="mark">F1</span> DASHBOARD
          </div>
          <p>Formula 1 standings, calendars and career stats — 1950 to today.</p>
          <p className="footer-copy">© {year} F1 Dashboard</p>
        </div>

        <nav className="footer-col" aria-label="Footer">
          <h4>Explore</h4>
          <ul>
            {quickLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-col">
          <h4>Data &amp; credits</h4>
          <ul>
            <li>
              Data by <Ext href="https://github.com/f1db/f1db">f1db</Ext> (
              <Ext href="https://creativecommons.org/licenses/by/4.0/">
                CC BY 4.0
              </Ext>
              )
            </li>
            <li>
              Telemetry by <Ext href="https://openf1.org">OpenF1</Ext>
            </li>
            <li>
              Flag icons by <Ext href="https://flagcdn.com">flagcdn</Ext>
            </li>
          </ul>
        </div>

        <div className="footer-col footer-legal">
          <h4>Legal</h4>
          <p>
            Driver and car images are © Formula 1. F1, FORMULA 1 and related
            marks are trademarks of Formula One Licensing B.V.
          </p>
          <p>
            An independent, fan-made project — not affiliated with, endorsed by,
            or associated with Formula 1, Formula One Management or the FIA.
          </p>
          <p>This site uses Google Analytics to measure site traffic.</p>
        </div>
      </div>
    </footer>
  )
}
