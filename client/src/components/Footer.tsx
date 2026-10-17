import { Link } from 'react-router-dom'
import { useI18n, type TKey } from '../i18n/core'
import { OPEN_EVENT } from './CookieBanner'
import './Footer.css'

// Global site footer. Carries the data/image attributions we're obliged to show
// (f1db is CC-BY 4.0), an independence + trademark disclaimer so we don't imply
// any official tie to Formula 1, an analytics disclosure (we run GA4), and a set
// of quick links that double as internal linking for search engines. Laid out as
// columns spread across the full content width.
const quickLinks: { to: string; label: TKey }[] = [
  { to: '/', label: 'nav.home' },
  { to: '/live', label: 'nav.live' },
  { to: '/standings', label: 'nav.standings' },
  { to: '/calendar', label: 'nav.calendar' },
  { to: '/circuits', label: 'nav.circuits' },
  { to: '/drivers', label: 'nav.drivers' },
  { to: '/teams', label: 'nav.teams' },
  { to: '/compare', label: 'nav.compare' },
  { to: '/telemetry', label: 'nav.telemetry' },
  { to: '/feedback', label: 'nav.feedback' },
]

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-brand">
          <div className="footer-logo">
            <span className="mark">F1</span> DASHBOARD
          </div>
          <p>{t('footer.tagline')}</p>
          <p className="footer-copy">© {year} F1 Dashboard</p>
        </div>

        <nav className="footer-col" aria-label="Footer">
          <h4>{t('footer.explore')}</h4>
          <ul>
            {quickLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{t(l.label)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-col">
          <h4>{t('footer.credits')}</h4>
          <ul>
            <li>
              {t('footer.dataBy')} <Ext href="https://github.com/f1db/f1db">f1db</Ext> (
              <Ext href="https://creativecommons.org/licenses/by/4.0/">
                CC BY 4.0
              </Ext>
              )
            </li>
            <li>
              {t('footer.telemetryBy')} <Ext href="https://openf1.org">OpenF1</Ext>
            </li>
            <li>
              {t('footer.flagsBy')} <Ext href="https://flagcdn.com">flagcdn</Ext>
            </li>
            <li>
              {t('footer.outlinesBy')}{' '}
              <Ext href="https://github.com/bacinger/f1-circuits">f1-circuits</Ext> (MIT, © Tomislav
              Bacinger)
            </li>
            <li>
              {t('footer.photosVia')}{' '}
              <Ext href="https://commons.wikimedia.org">Wikimedia Commons</Ext>{' '}
              {t('footer.photosLicense')}
            </li>
          </ul>
        </div>

        <div className="footer-col footer-legal">
          <h4>{t('footer.legal')}</h4>
          <p>{t('footer.trademark')}</p>
          <p>{t('footer.independent')}</p>
          <p>{t('footer.analytics')}</p>
          <p className="footer-links">
            <Link to="/about">{t('nav.about')}</Link>
            <Link to="/privacy">{t('nav.privacy')}</Link>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
            >
              {t('footer.cookieSettings')}
            </button>
          </p>
        </div>
      </div>
    </footer>
  )
}
