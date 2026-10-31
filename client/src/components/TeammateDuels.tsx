import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { useI18n, type TKey } from '../i18n/core'
import { driverPortraitUrl } from '../lib/f1meta'
import { gpShort } from '../lib/gpNames'
import type { DuelDriver, DuelSide, TeammateDuel } from '../types/f1'
import DriverThumb from './DriverThumb'
import Flag from './Flag'
import './TeammateDuels.css'

// Teammate head-to-heads for one team and season: qualifying and race score,
// points, the median qualifying gap and a round-by-round strip. Teammates
// share the team colour, so driver "a" gets it and driver "b" a light grey.

// Grey team colours (Haas, older teams) would blend with the light grey, so
// their teammate side turns dark grey instead.
function mateColor(team: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(team.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const sat = max ? (max - Math.min(r, g, b)) / max : 0
  return sat < 0.2 ? 'var(--color-rule-2)' : 'var(--color-ink-2)'
}

const lastName = (d: DuelDriver) => d.name.split(' ').slice(-1)[0]
const label = (d: DuelDriver) => d.code ?? lastName(d)

// A two-sided score bar: a's share in the team colour, b's in grey.
function ScoreRow({
  title,
  a,
  b,
  fmt,
}: {
  title: string
  a: number
  b: number
  fmt?: (n: number) => string
}) {
  const total = a + b
  const pct = total ? (a / total) * 100 : 50
  const f = fmt ?? String
  return (
    <div className="duel-row">
      <span className={`duel-val${a > b ? ' win' : ''}`}>{f(a)}</span>
      <div className="duel-mid">
        <span className="duel-lbl">{title}</span>
        <div className="duel-bar" aria-hidden="true">
          <span className="duel-bar-a" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`duel-val${b > a ? ' win' : ''}`}>{f(b)}</span>
    </div>
  )
}

// Plain numbers (no bar) for the smaller tallies; lower is better for DNFs.
function StatRow({
  title,
  a,
  b,
  lowerWins = false,
}: {
  title: string
  a: number | null
  b: number | null
  lowerWins?: boolean
}) {
  const ok = a != null && b != null && a !== b
  const aWins = ok && (lowerWins ? a! < b! : a! > b!)
  const bWins = ok && !aWins
  return (
    <div className="duel-row duel-row--plain">
      <span className={`duel-val${aWins ? ' win' : ''}`}>{a ?? ''}</span>
      <span className="duel-lbl">{title}</span>
      <span className={`duel-val${bWins ? ' win' : ''}`}>{b ?? ''}</span>
    </div>
  )
}

function Strip({ duel, a, b }: { duel: TeammateDuel; a: DuelDriver; b: DuelDriver }) {
  const { t, lang } = useI18n()
  const who = (s: DuelSide) => (s === 'a' ? label(a) : s === 'b' ? label(b) : t('duel.noDuel'))
  const rows: [TKey, TKey, 'quali' | 'race'][] = [
    ['duel.rowQ', 'duel.quali', 'quali'],
    ['duel.rowR', 'duel.race', 'race'],
  ]
  return (
    <div className="duel-strip" style={{ '--n': duel.rounds.length } as CSSProperties}>
      {rows.map(([short, long, kind]) => (
        <div className="duel-strip-row" key={kind}>
          <span className="duel-strip-lbl" title={t(long)}>
            {t(short)}
          </span>
          <div className="duel-cells">
            {duel.rounds.map((r) => (
              <span
                key={r.round}
                className={`duel-cell${r[kind] ? ` ${r[kind]}` : ''}`}
                title={t('duel.cellTitle', {
                  round: r.round,
                  gp: gpShort(r.grandPrix, lang),
                  who: who(r[kind]),
                })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Duel({
  duel,
  drivers,
  constructorId,
  season,
}: {
  duel: TeammateDuel
  drivers: Map<string, DuelDriver>
  constructorId: string
  season: number
}) {
  const { t, tn, fmtNum } = useI18n()
  const a = drivers.get(duel.a)!
  const b = drivers.get(duel.b)!
  const gap = duel.qualiGapMs
  const faster = gap == null || gap === 0 ? null : gap < 0 ? a : b

  return (
    <div className="duel">
      <div className="duel-names">
        {[a, b].map((d, i) => (
          <Link
            key={d.driverId}
            to={`/drivers/${d.driverId}`}
            className={`duel-name duel-name--${i ? 'b' : 'a'}`}
          >
            <DriverThumb
              urls={[driverPortraitUrl(d.driverId, constructorId, String(season)), d.photoUrl]}
              code={label(d)}
            />
            <span className="duel-id">
              <Flag code={d.countryCode} nationality={d.nationality} />
              <span className="duel-first">
                {d.name.slice(0, d.name.length - lastName(d).length).trim()}
              </span>
              <span className="duel-last">{lastName(d)}</span>
            </span>
          </Link>
        ))}
      </div>

      <ScoreRow title={t('duel.quali')} a={duel.quali.a} b={duel.quali.b} />
      <ScoreRow title={t('duel.race')} a={duel.race.a} b={duel.race.b} />
      <ScoreRow title={t('duel.points')} a={a.points} b={b.points} fmt={(n) => fmtNum(n)} />
      <StatRow title={t('duel.starts')} a={a.races} b={b.races} />
      <StatRow title={t('duel.wins')} a={a.wins} b={b.wins} />
      <StatRow title={t('duel.podiums')} a={a.podiums} b={b.podiums} />
      <StatRow title={t('duel.poles')} a={a.poles} b={b.poles} />
      <StatRow title={t('duel.best')} a={a.bestFinish} b={b.bestFinish} lowerWins />
      <StatRow title={t('duel.dnfs')} a={a.dnfs} b={b.dnfs} lowerWins />

      {gap != null && (
        <p className="duel-gap">
          {faster
            ? t('duel.gap', {
                who: label(faster),
                gap: fmtNum(Math.abs(gap) / 1000, {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                }),
              })
            : t('duel.gapEven')}{' '}
          <span className="muted">{tn('duel.gapOver', duel.qualiGapRounds)}</span>
        </p>
      )}

      {duel.rounds.length > 0 && (
        <>
          <h3 className="duel-sub">{t('duel.byRound')}</h3>
          <Strip duel={duel} a={a} b={b} />
          <div className="duel-legend">
            <span>
              <i className="duel-cell a" /> {label(a)}
            </span>
            <span>
              <i className="duel-cell b" /> {label(b)}
            </span>
            <span>
              <i className="duel-cell" /> {t('duel.noDuel')}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function TeammateDuels({
  constructorId,
  teamName,
  initialSeason,
  color,
}: {
  constructorId: string
  teamName: string
  initialSeason: number
  color: string
}) {
  const { t } = useI18n()
  const [season, setSeason] = useState(initialSeason)
  const [pair, setPair] = useState(0)
  const { data, loading, error } = useAsync(
    () => api.teamDuels(constructorId, season),
    [constructorId, season],
  )
  // Keep the season list from the first answer while another season loads.
  const [seasons, setSeasons] = useState<number[]>([])
  useEffect(() => {
    if (data) setSeasons(data.seasons)
  }, [data])

  const drivers = new Map((data?.drivers ?? []).map((d) => [d.driverId, d]))
  const duel = data?.duels[Math.min(pair, (data?.duels.length ?? 1) - 1)]

  return (
    <div
      className="card duels"
      style={{ '--team': color, '--mate': mateColor(color) } as CSSProperties}
    >
      <div className="duels-head">
        <h2 className="wknd-section">
          {t('duel.title')}
          <span className="wknd-when">{t('duel.hint', { team: teamName })}</span>
        </h2>
        {seasons.length > 0 && (
          <select
            value={season}
            onChange={(e) => {
              setSeason(Number(e.target.value))
              setPair(0)
            }}
            aria-label={t('common.season')}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && error && <p className="muted">{t('duel.loadError', { error })}</p>}

      {!loading && data && data.duels.length > 1 && (
        <div className="seg-switch duel-pairs" role="group" aria-label={t('duel.pairs')}>
          {data.duels.map((d, i) => (
            <button
              key={`${d.a}-${d.b}`}
              type="button"
              className={i === pair ? 'on' : undefined}
              aria-pressed={i === pair}
              onClick={() => setPair(i)}
            >
              {label(drivers.get(d.a)!)}/{label(drivers.get(d.b)!)}
            </button>
          ))}
        </div>
      )}

      {!loading && data && !duel && <p className="muted">{t('duel.solo', { season })}</p>}
      {!loading && duel && (
        <Duel duel={duel} drivers={drivers} constructorId={constructorId} season={season} />
      )}
      {!loading && duel && <p className="duel-note">{t('duel.note')}</p>}
    </div>
  )
}
