import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLayout } from '../components/layoutContext'
import { isSeason } from '../hooks/useSeasonRoute'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { trackEvent } from '../lib/analytics'
import { CURRENT_SEASON } from '../lib/seasons'
import { seoText, type NotFoundKind } from '../lib/seoText'
import './NotFound.css'

// The "not found" page: an address the app has no route for (the catch-all
// in App.tsx, which the server also answers with status 404), or a driver,
// team, circuit or race the API doesn't know, shown by that page in its place.
// It says what happened, shows the address, and offers the search and the
// sections people most likely came for.

const LEAD: Record<NotFoundKind, TKey> = {
  page: 'nf.pageLead',
  driver: 'nf.driverLead',
  team: 'nf.teamLead',
  circuit: 'nf.circuitLead',
  race: 'nf.raceLead',
}

const SECTIONS: { to: string; name: TKey; note: TKey }[] = [
  { to: '/standings', name: 'nav.standings', note: 'nf.standingsNote' },
  { to: '/calendar', name: 'nav.calendar', note: 'nf.calendarNote' },
  { to: '/drivers', name: 'nav.drivers', note: 'nf.driversNote' },
  { to: '/teams', name: 'nav.teams', note: 'nf.teamsNote' },
  { to: '/circuits', name: 'nav.circuits', note: 'nf.circuitsNote' },
  { to: '/compare', name: 'nav.compare', note: 'nf.compareNote' },
]

// The address as typed, readable (%-escapes decoded where they can be).
function shownAddress(): string {
  const path = window.location.pathname
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

export default function NotFound({
  kind = 'page',
  season,
}: {
  kind?: NotFoundKind
  // A race page's season, for the way back to that season's calendar.
  season?: string
}) {
  const { t, lang } = useI18n()
  const layout = useLayout()
  const { pathname } = useLocation()
  useSeo({ ...seoText.notFound(kind, lang), noindex: true })

  // Count it in analytics (with consent), so broken links pointing here show up.
  useEffect(() => {
    trackEvent('page_not_found', { page_path: window.location.pathname, kind })
  }, [pathname, kind])

  const back: { to: string; label: string } =
    kind === 'driver'
      ? { to: '/drivers', label: t('nf.allDrivers') }
      : kind === 'team'
        ? { to: '/teams', label: t('nf.allTeams') }
        : kind === 'circuit'
          ? { to: '/circuits', label: t('nf.allCircuits') }
          : kind === 'race'
            ? isSeason(season)
              ? { to: `/calendar/${season}`, label: t('nf.calendarOf', { season }) }
              : { to: '/calendar', label: t('nav.calendar') }
            : { to: '/', label: t('nf.home') }

  return (
    <section className="nf">
      <div className="nf-main">
        <p className="nf-code" aria-hidden="true">
          404
        </p>
        <div className="nf-copy">
          <h1>{t(`nf.${kind}` as TKey)}</h1>
          <p className="nf-lead">{t(LEAD[kind])}</p>
          <p className="nf-address">
            <span>{t('nf.address')}</span>
            <code>{shownAddress()}</code>
          </p>
          <div className="nf-actions">
            {layout && (
              <button type="button" className="btn btn--primary" onClick={layout.openSearch}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {t('nf.search')}
              </button>
            )}
            <Link to={back.to} className="btn">
              {back.label}
            </Link>
          </div>
        </div>
      </div>

      <h2 className="nf-next">{t('nf.next')}</h2>
      <ul className="nf-links">
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <Link to={s.to}>
              <span className="nf-link-name">{t(s.name)}</span>
              <span className="nf-link-note">{t(s.note, { season: CURRENT_SEASON })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
