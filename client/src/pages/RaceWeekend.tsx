import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import Flag from '../components/Flag'
import RaceStory from '../components/RaceStory'
import RaceStrategy from '../components/RaceStrategy'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import { breadcrumbLd, raceLd } from '../lib/jsonld'
import { teamColor } from '../lib/f1meta'
import { raceSummary } from '../lib/summaries'
import type {
  CalendarSession,
  PracticeSession,
  QualifyingEntry,
  WeekendHighlight,
  WeekendResult,
} from '../types/f1'
import { gpTitle } from '../lib/gpNames'
import './RaceWeekend.css'
import { seoText } from '../lib/seoText'
import NotFound from './NotFound'

type Tab = 'race' | 'sprint' | 'quali' | 'practice' | 'strategy'

function Highlight({
  label,
  name,
  constructorId,
  detail,
}: {
  label: string
  name: string
  constructorId: string
  detail: string
}) {
  return (
    <div className="wknd-hl">
      <div className="wknd-hl-label">{label}</div>
      <div className="wknd-hl-name">
        <span
          className="wknd-hl-swatch"
          style={{ background: teamColor(constructorId) }}
          aria-hidden="true"
        />
        {name}
      </div>
      <div className="wknd-hl-detail muted">{detail}</div>
    </div>
  )
}

// A colored ± delta for grid → finish.
function Delta({ n }: { n: number | null }) {
  if (n == null || n === 0) return null
  const up = n > 0
  return (
    <span className={up ? 'delta up' : 'delta down'}>
      {up ? '▲' : '▼'} {Math.abs(n)}
    </span>
  )
}

function TeamCell({ id, name }: { id: string; name: string }) {
  return (
    <span className="team">
      <span className="dot" style={{ background: teamColor(id) }} />
      {name}
    </span>
  )
}

function DriverCell({
  name,
  code,
  countryCode,
  nationality,
}: {
  name: string
  code: string | null
  countryCode?: string | null
  nationality?: string
}) {
  return (
    <span className="country">
      {countryCode !== undefined && <Flag code={countryCode} nationality={nationality ?? ''} />}
      <span className="name">{name}</span>
      {code && <span className="code">{code}</span>}
    </span>
  )
}

function ResultTable({ rows }: { rows: WeekendResult[] }) {
  const { t } = useI18n()
  return (
    <div className="table-scroll">
      <table className="standings standings--rank">
        <thead>
          <tr>
            <th className="pos">{t('wk.colPos')}</th>
            <th>{t('wk.colDriver')}</th>
            <th>{t('wk.colTeam')}</th>
            <th className="num">{t('wk.colGrid')}</th>
            <th className="num">+/−</th>
            <th>{t('wk.colTime')}</th>
            <th className="num">{t('wk.colPts')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.driverId}>
              <td className="pos">{r.positionText}</td>
              <td>
                <DriverCell
                  name={r.driverName}
                  code={r.driverCode}
                  countryCode={r.countryCode}
                  nationality={r.nationality}
                />
              </td>
              <td>
                <TeamCell id={r.constructorId} name={r.constructorName} />
              </td>
              <td className="num muted">{r.gridPosition ?? ''}</td>
              <td className="num">
                <Delta n={r.positionsGained} />
              </td>
              <td className="muted">{r.timeDisplay}</td>
              <td className="num points">{r.points || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QualiTable({ rows, prefix }: { rows: QualifyingEntry[]; prefix: string }) {
  const { t } = useI18n()
  return (
    <div className="table-scroll">
      <table className="standings standings--rank">
        <thead>
          <tr>
            <th className="pos">{t('wk.colPos')}</th>
            <th>{t('wk.colDriver')}</th>
            <th>{t('wk.colTeam')}</th>
            <th>{prefix}1</th>
            <th>{prefix}2</th>
            <th>{prefix}3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.driverId}>
              <td className="pos">{q.position ?? ''}</td>
              <td>
                <DriverCell name={q.driverName} code={q.driverCode} />
              </td>
              <td>
                <TeamCell id={q.constructorId} name={q.constructorName} />
              </td>
              <td className="muted mono">{q.q1 ?? ''}</td>
              <td className="muted mono">{q.q2 ?? ''}</td>
              <td className="mono">{q.q3 ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PracticeTable({ session }: { session: PracticeSession }) {
  const { t } = useI18n()
  return (
    <div className="table-scroll">
      <table className="standings standings--rank">
        <thead>
          <tr>
            <th className="pos">{t('wk.colPos')}</th>
            <th>{t('wk.colDriver')}</th>
            <th>{t('wk.colTeam')}</th>
            <th>{t('wk.colBest')}</th>
            <th>{t('wk.colGap')}</th>
            <th className="num">{t('wk.colLaps')}</th>
          </tr>
        </thead>
        <tbody>
          {session.results.map((p) => (
            <tr key={p.driverId}>
              <td className="pos">{p.positionText}</td>
              <td>
                <DriverCell name={p.driverName} code={p.driverCode} />
              </td>
              <td>
                <TeamCell id={p.constructorId} name={p.constructorName} />
              </td>
              <td className="mono">{p.time ?? ''}</td>
              <td className="muted mono">{p.gap ?? ''}</td>
              <td className="num muted">{p.laps ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RaceWeekend() {
  const { season = '', round = '' } = useParams()
  const { t, lang, fmtDate } = useI18n()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, notFound } = useAsync(
    () => api.raceWeekend(season, Number(round)),
    [season, round],
  )
  const [practiceN, setPracticeN] = useState<number | null>(null)
  // Race story: loads alongside (OpenF1 can be slow); quietly absent on error.
  const story = useAsync(() => api.raceStory(season, Number(round)), [season, round])

  useSeo({
    skip: notFound,
    ...(data ? seoText.race(data, lang) : {}),
    jsonLd: data
      ? [
          raceLd(data),
          breadcrumbLd([
            { name: t('nav.home'), path: '/' },
            { name: t('nav.calendar'), path: '/calendar' },
            {
              name: `${gpTitle(data.grandPrixName, lang)} ${data.season}`,
              path: `/calendar/${data.season}/${data.round}`,
            },
          ]),
        ]
      : undefined,
  })

  // Which session tabs this weekend has, in running order.
  const available: Tab[] = data
    ? (
        [
          ['race', data.results.length > 0],
          ['sprint', data.sprintResults.length > 0 || data.sprintQualifying.length > 0],
          ['quali', data.qualifying.length > 0],
          ['practice', data.practices.length > 0],
          // Lap chart + tyres come from OpenF1, which starts in 2023.
          ['strategy', Number(data.season) >= 2023 && data.results.length > 0],
        ] as [Tab, boolean][]
      )
        .filter(([, has]) => has)
        .map(([tab]) => tab)
    : []
  const asked = params.get('tab') as Tab | null
  const tab: Tab | undefined = asked && available.includes(asked) ? asked : available[0]

  function chooseTab(next: Tab) {
    setParams(next === available[0] ? {} : { tab: next }, {
      replace: true,
      preventScrollReset: true,
    })
  }

  const pole = data?.qualifying.find((q) => q.position === 1) ?? data?.qualifying[0]
  const lapWord = (detail: string) =>
    detail
      .replace(/\(lap (\d+)\)/, (_, n: string) => t('wk.lapN', { n }))
      .replace('of the vote', t('wk.ofVote'))

  const highlights: { label: string; h: WeekendHighlight | null }[] = data
    ? [
        {
          label: t('wk.pole'),
          h: pole
            ? {
                driverId: pole.driverId,
                driverName: pole.driverName,
                constructorId: pole.constructorId,
                constructorName: pole.constructorName,
                detail: pole.q3 ?? pole.q2 ?? pole.q1 ?? '',
              }
            : null,
        },
        { label: t('wk.fastestLap'), h: data.fastestLap },
        { label: t('wk.dotd'), h: data.driverOfTheDay },
      ]
    : []

  // Session date line under each table title ("Sat 10 Oct").
  const sessionDate = (kind: CalendarSession['kind']) => {
    const s = data?.sessions.find((x) => x.kind === kind)
    return s ? fmtDate(s.start, { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  }

  const practice =
    data?.practices.find((p) => p.number === practiceN) ?? data?.practices[0] ?? null

  if (notFound) return <NotFound kind="race" season={season} />

  return (
    <section>
      {!data && (
        <div className="page-head">
          <Link to="/calendar" className="back-link">
            ← {t('nav.calendar')}
          </Link>
        </div>
      )}

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && error && <p className="banner">{t('wk.loadError', { error })}</p>}

      {!loading && data && (
        <>
          <Breadcrumbs
            trail={[
              { name: t('nav.home'), path: '/' },
              { name: t('nav.calendar'), path: '/calendar' },
              {
                name: `${gpTitle(data.grandPrixName, lang)} ${data.season}`,
                path: `/calendar/${data.season}/${data.round}`,
              },
            ]}
          />

          <div className="wknd-title">
            <Flag code={data.countryCode} nationality="" />
            <div>
              <h1>{gpTitle(data.grandPrixName, lang)}</h1>
              <p className="muted wknd-meta">
                <span>{data.season}</span>
                <span>
                  {t('common.round')} {data.round}
                </span>
                <span className="mono">
                  {fmtDate(data.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <Link to={`/circuits/${data.circuitId}`} className="wknd-circuit">
                  {data.circuitName}
                </Link>
              </p>
            </div>
          </div>

          <p className="profile-summary">{raceSummary(data, lang)}</p>

          <div className="wknd-highlights">
            {highlights.map(
              ({ label, h }) =>
                h && (
                  <Highlight
                    key={label}
                    label={label}
                    name={h.driverName}
                    constructorId={h.constructorId}
                    detail={lapWord(h.detail)}
                  />
                ),
            )}
          </div>

          {story.data && data.results.length > 0 && <RaceStory story={story.data} />}

          {available.length > 1 && (
            <div className="tabs wknd-tabs" role="tablist">
              {available.map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'tab active' : 'tab'}
                  onClick={() => chooseTab(id)}
                >
                  {t(`wk.tab.${id}`)}
                </button>
              ))}
            </div>
          )}

          {tab === 'race' && (
            <div className="card">
              <h3 className="wknd-section">
                {t('wk.raceResult')}
                <span className="wknd-when">{sessionDate('RACE')}</span>
              </h3>
              <ResultTable rows={data.results} />
            </div>
          )}

          {tab === 'sprint' && (
            <>
              {data.sprintResults.length > 0 && (
                <div className="card">
                  <h3 className="wknd-section">
                    {t('wk.sprintResult')}
                    <span className="wknd-when">{sessionDate('SPRINT')}</span>
                  </h3>
                  <ResultTable rows={data.sprintResults} />
                </div>
              )}
              {data.sprintQualifying.length > 0 && (
                <div className="card" style={{ marginTop: '1rem' }}>
                  <h3 className="wknd-section">
                    {t('session.sq')}
                    <span className="wknd-when">{sessionDate('SQ')}</span>
                  </h3>
                  <QualiTable rows={data.sprintQualifying} prefix="SQ" />
                </div>
              )}
            </>
          )}

          {tab === 'quali' && (
            <div className="card">
              <h3 className="wknd-section">
                {t('session.q')}
                <span className="wknd-when">{sessionDate('Q')}</span>
              </h3>
              <QualiTable rows={data.qualifying} prefix="Q" />
            </div>
          )}

          {tab === 'strategy' && (
            <RaceStrategy
              season={data.season}
              round={data.round}
              hasSprint={data.sprintResults.length > 0}
            />
          )}

          {tab === 'practice' && practice && (
            <div className="card">
              <div className="wknd-practice-head">
                <h3 className="wknd-section">
                  {t('wk.practiceN', { n: practice.number })}
                  <span className="wknd-when">
                    {sessionDate(`FP${practice.number}` as CalendarSession['kind'])}
                  </span>
                </h3>
                {data.practices.length > 1 && (
                  <div className="seg-switch" role="group" aria-label={t('wk.tab.practice')}>
                    {data.practices.map((p) => (
                      <button
                        key={p.number}
                        type="button"
                        className={p.number === practice.number ? 'on' : undefined}
                        aria-pressed={p.number === practice.number}
                        onClick={() => setPracticeN(p.number)}
                      >
                        FP{p.number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <PracticeTable session={practice} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
