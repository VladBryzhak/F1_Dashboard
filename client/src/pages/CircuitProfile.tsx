import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import CircuitOutline from '../components/CircuitOutline'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { countryName } from '../lib/countries'
import { teamColor } from '../lib/f1meta'
import { breadcrumbLd } from '../lib/jsonld'
import type { CircuitTally } from '../types/f1'
import { gpShort, gpTitle } from '../lib/gpNames'
import './CircuitProfile.css'
import { seoText } from '../lib/seoText'

function Tally({
  title,
  rows,
  linkBase,
  colorOf,
}: {
  title: string
  rows: CircuitTally[]
  linkBase: string
  colorOf?: (id: string) => string
}) {
  if (rows.length === 0) return null
  return (
    <div className="card circ-tally">
      <h3 className="wknd-section">{title}</h3>
      <ol>
        {rows.map((r, i) => (
          <li key={r.id}>
            <span className="circ-tally-pos">{i + 1}</span>
            {colorOf && <span className="dot" style={{ background: colorOf(r.id) }} />}
            <Link to={`${linkBase}/${r.id}`} className="circ-tally-name">
              {r.name}
            </Link>
            <span className="circ-tally-num">{r.count}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function CircuitProfile() {
  const { circuitId = '' } = useParams<{ circuitId: string }>()
  const navigate = useNavigate()
  const { t, lang, fmtDate, fmtNum, locale } = useI18n()
  const { data: c, loading, error } = useAsync(() => api.circuitProfile(circuitId), [circuitId])

  useSeo({
    ...(c ? seoText.circuit(c, lang) : {}),
    jsonLd: c
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'SportsActivityLocation',
            name: c.name,
            address: { '@type': 'PostalAddress', addressLocality: c.placeName },
            ...(c.latitude != null && c.longitude != null
              ? { geo: { '@type': 'GeoCoordinates', latitude: c.latitude, longitude: c.longitude } }
              : {}),
          },
          breadcrumbLd([
            { name: t('nav.home'), path: '/' },
            { name: t('nav.circuits'), path: '/circuits' },
            { name: c.name, path: `/circuits/${c.circuitId}` },
          ]),
        ]
      : undefined,
  })

  if (loading) return <p className="muted">{t('common.loading')}</p>
  if (error || !c)
    return (
      <div>
        <p className="banner">{t('circ.loadOneError', { error: error ?? '404' })}</p>
        <Link to="/circuits" className="back-link">
          {t('circ.back')}
        </Link>
      </div>
    )

  const country = countryName(c.countryCode, locale)
  const mapUrl =
    c.latitude != null && c.longitude != null
      ? `https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=15/${c.latitude}/${c.longitude}`
      : null
  const km = (n: number | null) =>
    n == null ? '' : t('circ.km', { n: fmtNum(n, { maximumFractionDigits: 3 }) })

  return (
    <section>
      <Breadcrumbs
        trail={[
          { name: t('nav.home'), path: '/' },
          { name: t('nav.circuits'), path: '/circuits' },
          { name: c.name, path: `/circuits/${c.circuitId}` },
        ]}
      />

      <div className={`circ-hero${c.outline ? ' has-map' : ''}`}>
        <div className="circ-hero-main">
          <div className="wknd-title">
            <Flag code={c.countryCode} nationality={c.nationality} />
            <div>
              <h1>{c.name}</h1>
              <p className="wknd-meta">
                <span>{c.placeName}</span>
                {country && <span>{country}</span>}
                <span>{t(`circ.type.${c.type}` as TKey)}</span>
                {c.direction && <span>{t(`circ.dir.${c.direction}` as TKey)}</span>}
              </p>
            </div>
          </div>

          <div className="circ-actions">
            {c.nextRace && (
              <Link
                className="circ-next"
                to={`/calendar/${c.nextRace.season}?schedule=${c.nextRace.round}`}
              >
                <span className="next-tag">{t('common.next')}</span>
                {t('circ.next', {
                  gp: gpTitle(c.nextRace.grandPrixName, lang),
                  date: fmtDate(c.nextRace.date, { day: 'numeric', month: 'long' }),
                })}
              </Link>
            )}
            {mapUrl && (
              <a className="sched-ics" href={mapUrl} target="_blank" rel="noopener noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                {t('circ.map')}
              </a>
            )}
          </div>

          <div className="wknd-highlights circ-stats">
            <div className="wknd-hl">
              <div className="wknd-hl-label">{t('circ.length')}</div>
              <div className="wknd-hl-name">{km(c.length)}</div>
            </div>
            <div className="wknd-hl">
              <div className="wknd-hl-label">{t('circ.turns')}</div>
              <div className="wknd-hl-name">{c.turns ?? ''}</div>
            </div>
            <div className="wknd-hl">
              <div className="wknd-hl-label">{t('circ.racesHeld')}</div>
              <div className="wknd-hl-name">{c.racesHeld}</div>
            </div>
            <div className="wknd-hl">
              <div className="wknd-hl-label">{t('circ.firstGp')}</div>
              <div className="wknd-hl-name">{c.firstYear ?? ''}</div>
            </div>
          </div>
        </div>
        {c.outline && (
          <div className="circ-map">
            <CircuitOutline
              outline={c.outline}
              label={t('circ.outlineOf', { name: c.name })}
              strokeWidth={3.6}
            />
          </div>
        )}
      </div>

      <div className="card circ-record">
        <h3 className="wknd-section">{t('circ.lapRecord')}</h3>
        {c.lapRecord ? (
          <div className="circ-record-body">
            <span className="circ-record-time mono">{c.lapRecord.time}</span>
            <span className="circ-record-who">
              <Link to={`/drivers/${c.lapRecord.driverId}`}>{c.lapRecord.driverName}</Link>
              <span className="circ-record-team">
                <span
                  className="wknd-hl-swatch"
                  style={{ background: teamColor(c.lapRecord.constructorId) }}
                />
                {c.lapRecord.constructorName}
              </span>
              <span className="mono circ-record-year">{c.lapRecord.year}</span>
            </span>
            <span className="circ-record-note">{t('circ.lapRecordNote')}</span>
          </div>
        ) : (
          <p className="muted">{t('circ.noLapRecord')}</p>
        )}
      </div>

      <div className="circ-cols">
        <Tally title={t('circ.mostWins')} rows={c.topDrivers} linkBase="/drivers" />
        <Tally
          title={t('circ.mostTeamWins')}
          rows={c.topConstructors}
          linkBase="/teams"
          colorOf={teamColor}
        />
        <Tally title={t('circ.mostPoles')} rows={c.topPoles} linkBase="/drivers" />
      </div>

      {c.layouts.length > 1 && (
        <div className="card circ-block">
          <h3 className="wknd-section">{t('circ.layouts')}</h3>
          <div className="table-scroll">
            <table className="standings">
              <thead>
                <tr>
                  <th>{t('circ.layoutYears')}</th>
                  <th className="num">{t('circ.length')}</th>
                  <th className="num">{t('circ.turns')}</th>
                  <th className="num">{t('circ.layoutRaces')}</th>
                </tr>
              </thead>
              <tbody>
                {c.layouts
                  .slice()
                  .reverse()
                  .map((l) => (
                    <tr key={l.layoutId}>
                      <td>{l.firstYear === l.lastYear ? l.firstYear : `${l.firstYear}-${l.lastYear}`}</td>
                      <td className="num">{km(l.length)}</td>
                      <td className="num">{l.turns ?? ''}</td>
                      <td className="num">{l.races}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {c.races.length > 0 && (
        <div className="card circ-block">
          <h3 className="wknd-section">{t('circ.winners')}</h3>
          <div className="table-scroll">
            <table className="standings">
              <thead>
                <tr>
                  <th>{t('circ.colYear')}</th>
                  {c.grandsPrix.length > 1 && <th>{t('circ.colGp')}</th>}
                  <th>{t('circ.colWinner')}</th>
                  <th>{t('circ.colTeam')}</th>
                  <th>{t('circ.colPole')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {c.races.map((r) => (
                  <tr
                    key={`${r.year}-${r.round}`}
                    className="row-clickable"
                    onClick={() => navigate(`/calendar/${r.year}/${r.round}`)}
                  >
                    <td className="mono">{r.year}</td>
                    {c.grandsPrix.length > 1 && <td className="muted">{gpShort(r.grandPrixName, lang)}</td>}
                    <td>
                      <span className="name">{r.winnerName ?? ''}</span>
                    </td>
                    <td>
                      {r.winnerConstructorName ? (
                        <span className="team">
                          <span
                            className="dot"
                            style={{ background: teamColor(r.winnerConstructorId ?? '') }}
                          />
                          {r.winnerConstructorName}
                        </span>
                      ) : null}
                    </td>
                    <td className="muted">{r.poleDriverName ?? ''}</td>
                    <td className="muted chevron">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {c.previousNames && (
        <p className="muted circ-prev">{t('circ.previousNames', { names: c.previousNames })}</p>
      )}
    </section>
  )
}
