import { Fragment, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import Flag from '../components/Flag'
import SeasonSelect from '../components/SeasonSelect'
import WeekendSchedule from '../components/WeekendSchedule'
import { useAsync } from '../hooks/useAsync'
import { useSeasonRoute } from '../hooks/useSeasonRoute'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import { teamColor } from '../lib/f1meta'

export default function Calendar() {
  const { season: seasonParam } = useParams()
  const { season, canonicalPath, goToSeason, badSeason } = useSeasonRoute(
    '/calendar',
    seasonParam,
  )
  const navigate = useNavigate()
  const { t, fmtDate } = useI18n()

  // Upcoming races expand in place to show their session schedule. The open
  // round lives in ?schedule=N so the home page's "Next race" card can link
  // straight to it.
  const [params, setParams] = useSearchParams()
  const scheduleParam = Number(params.get('schedule')) || null
  const [openRound, setOpenRound] = useState<number | null>(scheduleParam)

  useSeo({
    title: `${season} F1 Race Calendar & Results`,
    description: `The ${season} Formula 1 race calendar with winners, teams and full results for every Grand Prix.`,
    canonicalPath,
  })
  const { data, loading, error } = useAsync(() => api.calendar(season), [season])

  // The first race without a result is the next one to run.
  const nextRound = data?.races.find((r) => !r.winnerName)?.round

  // Arriving from a link with ?schedule=N: bring that race into view once the
  // table has rendered (only on arrival, not on every toggle).
  const arrivedFor = useRef<number | null>(scheduleParam)
  useEffect(() => {
    const round = arrivedFor.current
    if (!data || round == null) return
    arrivedFor.current = null
    requestAnimationFrame(() =>
      document
        .getElementById(`race-${round}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    )
  }, [data])

  function toggleSchedule(round: number) {
    const next = openRound === round ? null : round
    setOpenRound(next)
    setParams(next == null ? {} : { schedule: String(next) }, {
      replace: true,
      preventScrollReset: true,
    })
  }

  if (badSeason) return <Navigate to="/calendar" replace />

  return (
    <section>
      <div className="page-head">
        <h1>{t('cal.title', { season })}</h1>
        <SeasonSelect value={season} onChange={goToSeason} />
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && error && <p className="banner">{t('cal.loadError', { error })}</p>}

      {!loading && data && (
        <div className="card">
          <table className="standings">
            <thead>
              <tr>
                <th>{t('cal.colGp')}</th>
                <th>{t('cal.colDate')}</th>
                <th>{t('cal.colWinner')}</th>
                <th>{t('cal.colTeam')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.races.map((r) => {
                const done = !!r.winnerName
                const isNext = r.round === nextRound
                const open = !done && openRound === r.round
                const rowClass = [
                  'row-clickable',
                  isNext ? 'row-next' : '',
                  open ? 'row-open' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <Fragment key={r.round}>
                    <tr
                      id={`race-${r.round}`}
                      className={rowClass}
                      onClick={() =>
                        done
                          ? navigate(`/calendar/${season}/${r.round}`)
                          : toggleSchedule(r.round)
                      }
                      title={
                        done
                          ? t('cal.viewWeekend', { name: r.name })
                          : t(open ? 'cal.hideSchedule' : 'cal.showSchedule')
                      }
                      aria-expanded={done ? undefined : open}
                    >
                      <td>
                        <span className="entity">
                          <Flag code={r.countryCode} nationality={r.nationality} />
                          <span className="name" style={{ marginLeft: '0.65rem' }}>
                            {r.name}
                          </span>
                          {r.isSprint && <span className="sprint-badge">{t('cal.sprint')}</span>}
                        </span>
                      </td>
                      <td className="muted">
                        {fmtDate(r.date, { day: '2-digit', month: 'short' }) || r.date}
                      </td>
                      <td>
                        {r.winnerName ? (
                          <span className="name">{r.winnerName}</span>
                        ) : isNext ? (
                          <span className="next-tag">{t('common.next')}</span>
                        ) : (
                          <span className="muted">{t('cal.upcoming')}</span>
                        )}
                      </td>
                      <td>
                        {r.winnerConstructorName ? (
                          <span className="team">
                            <span
                              className="dot"
                              style={{
                                background: teamColor(r.winnerConstructorId ?? ''),
                              }}
                            />
                            {r.winnerConstructorName}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="muted chevron">
                        {done ? '›' : <span className={`sched-caret${open ? ' open' : ''}`}>›</span>}
                      </td>
                    </tr>
                    {open && (
                      <tr className="sched-row">
                        <td colSpan={5}>
                          <WeekendSchedule season={season} race={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
