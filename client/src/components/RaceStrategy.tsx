import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { useI18n, type TKey } from '../i18n/core'
import { teamColor, tyre } from '../lib/live'
import type { RaceStrategy as Strategy, StrategyDriver } from '../types/f1'
import './RaceStrategy.css'

const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const

// Position-by-lap chart. Each car is a line in its team colour (the second
// car of a team dashed); tapping a code focuses that car and dims the rest.
function LapChart({ data }: { data: Strategy }) {
  const { t } = useI18n()
  const [focus, setFocus] = useState<Set<number>>(new Set())
  const [hover, setHover] = useState<number | null>(null)

  const rows = data.drivers.length
  const laps = data.totalLaps
  const W = 1000
  const ROW = 26
  const PAD_L = 52
  const PAD_R = 52
  const PAD_T = 14
  const PAD_B = 30
  const H = PAD_T + (rows - 1) * ROW + PAD_B
  const x = (lap: number) => PAD_L + (lap / Math.max(laps, 1)) * (W - PAD_L - PAD_R)
  const y = (pos: number) => PAD_T + (pos - 1) * ROW

  // Second car of each team (by colour) gets a dashed line.
  const dashed = useMemo(() => {
    const seen = new Set<string>()
    const out = new Set<number>()
    for (const d of data.drivers) {
      const c = d.colour ?? ''
      if (seen.has(c)) out.add(d.num)
      seen.add(c)
    }
    return out
  }, [data.drivers])

  const active = (num: number) =>
    hover != null ? hover === num : focus.size === 0 || focus.has(num)

  function toggle(num: number) {
    setFocus((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  // Path segments: a retirement (null) ends the line.
  function path(d: StrategyDriver): string {
    let s = ''
    let pen = false
    d.positions.forEach((p, lap) => {
      if (p == null) {
        pen = false
        return
      }
      s += `${pen ? 'L' : 'M'}${x(lap).toFixed(1)},${y(p)} `
      pen = true
    })
    return s
  }

  const ticks: number[] = []
  const step = laps > 40 ? 10 : 5
  // Skip a tick that would crowd the final-lap label.
  for (let l = step; l <= laps - step / 2; l += step) ticks.push(l)

  const byGrid = [...data.drivers].filter((d) => d.grid != null)

  return (
    <div className="strat-chart-wrap">
      <svg
        className="strat-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('strat.lapChart')}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: rows }, (_, i) => (
          <line key={i} x1={PAD_L} x2={W - PAD_R} y1={y(i + 1)} y2={y(i + 1)} className="strat-grid" />
        ))}
        {ticks.map((l) => (
          <g key={l}>
            <line x1={x(l)} x2={x(l)} y1={PAD_T - 6} y2={H - PAD_B + 6} className="strat-grid" />
            <text x={x(l)} y={H - 8} className="strat-axis" textAnchor="middle">
              {l}
            </text>
          </g>
        ))}
        <text x={x(laps)} y={H - 8} className="strat-axis" textAnchor="middle">
          {laps}
        </text>

        {/* Dimmed lines first, highlighted ones on top. */}
        {[...data.drivers]
          .sort((a, b) => Number(active(a.num)) - Number(active(b.num)))
          .map((d) => {
            const on = active(d.num)
            const end = d.positions.reduce<number>((m, p, i) => (p != null ? i : m), 0)
            return (
              <g key={d.num} className={on ? 'strat-line on' : 'strat-line'}>
                <path
                  d={path(d)}
                  stroke={teamColor(d.colour)}
                  strokeDasharray={dashed.has(d.num) ? '7 5' : undefined}
                  onMouseEnter={() => setHover(d.num)}
                  onClick={() => toggle(d.num)}
                />
                {d.retired && d.positions[end] != null && (
                  <circle cx={x(end)} cy={y(d.positions[end]!)} r={4.5} fill={teamColor(d.colour)} />
                )}
              </g>
            )
          })}

        {/* Grid order on the left, finishing order on the right. */}
        {byGrid.map((d) => (
          <text
            key={`g${d.num}`}
            x={PAD_L - 10}
            y={y(d.grid!) + 4}
            textAnchor="end"
            className={active(d.num) ? 'strat-code on' : 'strat-code'}
            onMouseEnter={() => setHover(d.num)}
            onClick={() => toggle(d.num)}
          >
            {d.code}
          </text>
        ))}
        {data.drivers.map((d) => {
          const end = d.positions.reduce<number>((m, p, i) => (p != null ? i : m), 0)
          const p = d.positions[end]
          if (p == null || d.retired) return null
          return (
            <text
              key={`f${d.num}`}
              x={W - PAD_R + 10}
              y={y(p) + 4}
              className={active(d.num) ? 'strat-code on' : 'strat-code'}
              onMouseEnter={() => setHover(d.num)}
              onClick={() => toggle(d.num)}
            >
              {d.code}
            </text>
          )
        })}
      </svg>
      <div className="strat-chart-foot">
        <span>{t('strat.lapChartHint')}</span>
        {focus.size > 0 && (
          <button type="button" className="strat-clear" onClick={() => setFocus(new Set())}>
            {t('strat.clear')}
          </button>
        )}
      </div>
    </div>
  )
}

// One bar per car, split into stints coloured by compound.
function TyreStrategy({ data }: { data: Strategy }) {
  const { t } = useI18n()
  const laps = Math.max(data.totalLaps, 1)
  return (
    <div className="strat-tyres">
      {data.drivers.map((d) => {
        const stints = data.stints
          .filter((s) => s.num === d.num && s.end >= s.start)
          .sort((a, b) => a.start - b.start)
        return (
          <div className="strat-tyre-row" key={d.num}>
            <span className="strat-tyre-code">
              <span className="strat-tyre-pos">{d.finish ?? '–'}</span>
              <span className="strat-tyre-stripe" style={{ background: teamColor(d.colour) }} />
              {d.code}
            </span>
            <span className="strat-tyre-track">
              {stints.map((s) => {
                const tc = tyre(s.compound)
                const n = s.end - s.start + 1
                return (
                  <span
                    key={`${s.start}-${s.end}`}
                    className={`strat-stint tyre-${tc.cls}`}
                    style={{
                      left: `${((s.start - 1) / laps) * 100}%`,
                      width: `${(n / laps) * 100}%`,
                    }}
                    title={`${s.compound ?? '?'} · ${t('strat.laps', { from: s.start, to: s.end })}`}
                  >
                    {n >= 5 ? n : ''}
                  </span>
                )
              })}
            </span>
          </div>
        )
      })}
      <div className="strat-legend">
        {COMPOUNDS.map((c) => (
          <span key={c}>
            <span className={`tyre tyre-${tyre(c).cls}`}>{tyre(c).label}</span>
            {t(`tyre.${c}` as TKey)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RaceStrategy({
  season,
  round,
  hasSprint,
}: {
  season: string
  round: number
  hasSprint: boolean
}) {
  const { t } = useI18n()
  const [kind, setKind] = useState<'race' | 'sprint'>('race')
  const { data, loading, error } = useAsync(
    () => api.raceStrategy(season, round, kind),
    [season, round, kind],
  )

  return (
    <>
      {hasSprint && (
        <div className="seg-switch strat-kind" role="group">
          {(['race', 'sprint'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={kind === k ? 'on' : undefined}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {t(k === 'race' ? 'wk.tab.race' : 'wk.tab.sprint')}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="muted">{t('strat.loading')}</p>}
      {!loading && error && <p className="banner">{t('strat.error', { error })}</p>}

      {!loading && data && (
        <>
          <div className="card">
            <h3 className="wknd-section">{t('strat.lapChart')}</h3>
            <LapChart data={data} />
          </div>
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 className="wknd-section">{t('strat.tyres')}</h3>
            <TyreStrategy data={data} />
          </div>
          <p className="muted strat-source">{t('strat.source')}</p>
        </>
      )}
    </>
  )
}
