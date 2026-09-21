import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { teamColor } from '../lib/f1meta'
import type { SeasonProgression } from '../types/f1'

interface SeriesMeta {
  driverId: string
  label: string // "ANT" / short
  name: string
  color: string
  dashed: boolean
}

// Recharts tooltip: round + GP, drivers ranked by points at that round.
interface TipPayload {
  dataKey?: string | number
  value?: unknown
}

const toNum = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)

function ChartTooltip({
  active,
  payload,
  label,
  meta,
  gpByRound,
}: {
  active?: boolean
  payload?: TipPayload[]
  label?: number | string
  meta: Map<string, SeriesMeta>
  gpByRound: Map<number, string>
}) {
  if (!active || !payload?.length) return null
  const round = Number(label)
  const rows = [...payload].sort((a, b) => toNum(b.value) - toNum(a.value))
  return (
    <div className="chart-tip">
      <div className="chart-tip-head">
        R{round} · {gpByRound.get(round)}
      </div>
      {rows.map((r) => {
        const m = meta.get(String(r.dataKey))
        if (!m) return null
        return (
          <div className="chart-tip-row" key={String(r.dataKey)}>
            <span className="dot" style={{ background: m.color }} />
            <span className="chart-tip-name">{m.label}</span>
            <span className="chart-tip-val">{toNum(r.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function TitleRaceChart({ data }: { data: SeasonProgression }) {
  if (!data.series.length) {
    return <p className="muted">No standings data for this season yet.</p>
  }

  // Teammates share a team colour → dash the second one so they're separable.
  const seenTeam = new Set<string>()
  const meta = new Map<string, SeriesMeta>()
  const series: SeriesMeta[] = data.series.map((s) => {
    const color = teamColor(s.constructorId)
    const dashed = seenTeam.has(s.constructorId)
    seenTeam.add(s.constructorId)
    const m: SeriesMeta = {
      driverId: s.driverId,
      label: s.driverCode ?? s.driverName,
      name: s.driverName,
      color,
      dashed,
    }
    meta.set(s.driverId, m)
    return m
  })

  const gpByRound = new Map<number, string>()
  data.rounds.forEach((round, i) => gpByRound.set(round, data.grandPrixNames[i]))

  // One row per round: { round, [driverId]: cumulativePoints }.
  const rows = data.rounds.map((round, i) => {
    const row: Record<string, number> = { round }
    data.series.forEach((s) => {
      row[s.driverId] = s.points[i]
    })
    return row
  })

  return (
    <div className="card title-race">
      <div className="title-race-head">
        <h3>Title race — points by round</h3>
        <span className="muted">{data.season} season</span>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#2a2a35" vertical={false} />
          <XAxis
            dataKey="round"
            stroke="#9a9aa8"
            fontSize={12}
            tickFormatter={(v: number) => `R${v}`}
          />
          <YAxis stroke="#9a9aa8" fontSize={12} width={36} />
          <Tooltip
            cursor={{ stroke: '#4a4a58', strokeWidth: 1 }}
            content={(p) => (
              <ChartTooltip {...p} meta={meta} gpByRound={gpByRound} />
            )}
          />
          {series.map((s) => (
            <Line
              key={s.driverId}
              type="monotone"
              dataKey={s.driverId}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              strokeDasharray={s.dashed ? '6 4' : undefined}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Custom legend: identity via name text, not colour alone. */}
      <div className="chart-legend">
        {series.map((s) => (
          <span className="legend-item" key={s.driverId}>
            <span
              className={s.dashed ? 'legend-line dashed' : 'legend-line'}
              style={{ color: s.color }}
            />
            <span className="legend-code">{s.label}</span>
            <span className="legend-name muted">{s.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
