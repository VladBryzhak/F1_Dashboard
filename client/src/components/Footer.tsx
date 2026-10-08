import { Link } from 'react-router-dom'

// Global site footer. Carries the data/image attributions we're obliged to show
// (f1db is CC-BY 4.0), an independence + trademark disclaimer so we don't imply
// any official tie to Formula 1, an analytics disclosure (we run GA4), and a set
// of quick links that double as internal linking for search engines.
const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/standings', label: 'Standings' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/teams', label: 'Teams' },
  { to: '/compare', label: 'Compare' },
  { to: '/telemetry', label: 'Telemetry' },
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
      <nav className="footer-links" aria-label="Footer">
        {quickLinks.map((l) => (
          <Link key={l.to} to={l.to}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="footer-meta">
        <p>
          Data by <Ext href="https://github.com/f1db/f1db">f1db</Ext> (
          <Ext href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Ext>)
          and <Ext href="https://openf1.org">OpenF1</Ext>. Flag icons by{' '}
          <Ext href="https://flagcdn.com">flagcdn</Ext>.
        </p>
        <p>
          Driver and car images are © Formula 1. F1, FORMULA 1 and related marks
          are trademarks of Formula One Licensing B.V. F1 Dashboard is an
          independent, fan-made project and is not affiliated with, endorsed by,
          or associated with Formula 1, Formula One Management or the FIA.
        </p>
        <p>This site uses Google Analytics to measure site traffic.</p>
        <p className="footer-copy">
          © {year} F1 Dashboard · Formula 1 statistics, 1950–present
        </p>
      </div>
    </footer>
  )
}
