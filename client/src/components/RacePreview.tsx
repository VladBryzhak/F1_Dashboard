import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { useI18n } from '../i18n/core'
import { localName } from '../lib/ukNames'
import { teamColor } from '../lib/f1meta'
import { fetchForecast, previewFacts, skyKey, weekday } from '../lib/racePreview'
import type { RacePreview as Preview } from '../types/f1'
import WeekendSchedule from './WeekendSchedule'
import './RacePreview.css'

// An upcoming race's page before the result: three facts from the data, then
// the weekend schedule and the circuit's forecast beside the last races here
// with their winner and pole, and who has won here most.
export default function RacePreview({ preview }: { preview: Preview }) {
  const { t, lang, fmtNum } = useI18n()
  // Without the server's forecast the page asks Open-Meteo itself.
  const q = preview.weather ? null : preview.forecastFor
  const asked = useAsync(() => (q ? fetchForecast(q) : Promise.resolve(null)), [
    q?.lat,
    q?.lon,
    q?.start,
    q?.end,
  ])
  const p = preview.weather || !asked.data ? preview : { ...preview, weather: asked.data }
  const facts = previewFacts(p, lang)
  const c = p.circuit

  return (
    <section className="pv" aria-labelledby="pv-title">
      <h2 id="pv-title" className="wknd-section">
        {t('pv.title')}
      </h2>

      {facts.length > 0 && (
        <ul className="pv-facts">
          {facts.map((f) => (
            <li key={f.tag} className="pv-fact">
              <span className="pv-tag">{t(f.tag)}</span>
              <span className="pv-fact-text">{f.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pv-grid">
        <div className="pv-col">
          <WeekendSchedule season={p.season} race={p.race} />

          {p.weather && (
            <div className="pv-card">
              <h3 className="pv-card-title">{t('pv.weather')}</h3>
              <ol className="pv-rows">
                {p.weather.map((d) => (
                  <li key={d.date} className={`pv-row${d.date === p.race.date ? ' is-race' : ''}`}>
                    <span className="pv-day">{weekday(d.date, lang, 'short')}</span>
                    <span className="pv-sky">{t(skyKey(d.code))}</span>
                    <span className="pv-num mono">
                      {d.tMax}° / {d.tMin}°
                    </span>
                    <span className="pv-num pv-rain mono">{t('pv.rain', { n: d.rain })}</span>
                  </li>
                ))}
              </ol>
              <p className="pv-credit">
                {t('pv.forecastBy')}{' '}
                <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
                  Open-Meteo
                </a>
              </p>
            </div>
          )}
        </div>

        <div className="pv-card">
          {p.history.length > 0 && (
            <>
              <h3 className="pv-card-title">{t('pv.history')}</h3>
              <ol className="pv-rows">
                {p.history.map((r) => (
                  <li key={r.year} className="pv-row pv-row--past">
                    <Link to={`/calendar/${r.year}/${r.round}`} className="pv-year mono">
                      {r.year}
                    </Link>
                    <span className="pv-winner">
                      <span
                        className="pv-swatch"
                        style={{ background: teamColor(r.winnerConstructorId) }}
                        aria-hidden="true"
                      />
                      <Link to={`/drivers/${r.winnerId}`}>{localName(r.winnerId, r.winnerName, lang)}</Link>
                      <span className="pv-team">{r.winnerConstructorName}</span>
                    </span>
                    {r.poleName && <span className="pv-pole">{t('pv.pole', { name: localName(r.poleId, r.poleName, lang) })}</span>}
                  </li>
                ))}
              </ol>
            </>
          )}

          {p.topWinners.length > 0 && (
            <p className="pv-most">
              <span className="pv-most-label">{t('pv.mostWins')}:</span>{' '}
              {p.topWinners.map((w, i) => (
                <span key={w.id}>
                  {i > 0 && ' · '}
                  <Link to={`/drivers/${w.id}`}>{localName(w.id, w.name, lang)}</Link> <span className="mono">{w.count}</span>
                </span>
              ))}
            </p>
          )}

          <dl className="pv-circuit">
            {c.length != null && (
              <div>
                <dt>{t('pv.length')}</dt>
                <dd className="mono">{t('pv.km', { n: fmtNum(c.length, { maximumFractionDigits: 3 }) })}</dd>
              </div>
            )}
            {c.turns != null && (
              <div>
                <dt>{t('pv.turns')}</dt>
                <dd className="mono">{c.turns}</dd>
              </div>
            )}
            <div>
              <dt>{t('pv.racesHeld')}</dt>
              <dd className="mono">{c.racesHeld}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
