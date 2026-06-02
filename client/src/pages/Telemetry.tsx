import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'

// OpenF1 telemetry is available from 2023 onward.
const TELEMETRY_SEASONS = ['2026', '2025', '2024', '2023']

function formatLap(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return m > 0 ? `${m}:${s.padStart(6, '0')}` : s
}

export default function Telemetry() {
  const [season, setSeason] = useState('2024')
  const [sessionKey, setSessionKey] = useState<number | null>(null)
  const [driverNumber, setDriverNumber] = useState<number | null>(null)
  const [lapNumber, setLapNumber] = useState<number | null>(null)

  const sessions = useAsync(() => api.telemetrySessions(season), [season])
  const drivers = useAsync(
    () => (sessionKey ? api.sessionDrivers(sessionKey) : Promise.resolve([])),
    [sessionKey],
  )
  const laps = useAsync(
    () =>
      sessionKey && driverNumber
        ? api.driverLaps(sessionKey, driverNumber)
        : Promise.resolve([]),
    [sessionKey, driverNumber],
  )
  const telemetry = useAsync(
    () =>
      sessionKey && driverNumber && lapNumber
        ? api.lapTelemetry(sessionKey, driverNumber, lapNumber)
        : Promise.resolve(null),
    [sessionKey, driverNumber, lapNumber],
  )

  // Cascade defaults: pick the first race, first driver, and the fastest lap.
  useEffect(() => {
    const list = sessions.data
    if (list && list.length) setSessionKey((k) => k ?? list[0].sessionKey)
  }, [sessions.data])
  // Reset downstream selection whenever the race changes.
  useEffect(() => {
    setDriverNumber(null)
    setLapNumber(null)
  }, [sessionKey])
  useEffect(() => {
    const list = drivers.data
    if (list && list.length) setDriverNumber((d) => d ?? list[0].driverNumber)
  }, [drivers.data])

  const validLaps = useMemo(
    () => (laps.data ?? []).filter((l) => l.lapDuration && !l.isPitOutLap),
    [laps.data],
  )
  const fastestLap = useMemo(
    () =>
      validLaps.reduce<typeof validLaps[number] | null>(
        (best, l) =>
          !best || (l.lapDuration ?? Infinity) < (best.lapDuration ?? Infinity)
            ? l
            : best,
        null,
      ),
    [validLaps],
  )
  useEffect(() => {
    if (fastestLap) setLapNumber((n) => n ?? fastestLap.lapNumber)
  }, [fastestLap])

  const driver = drivers.data?.find((d) => d.driverNumber === driverNumber)
  const teamColor = driver ? `#${driver.colour}` : '#e10600'

  return (
    <section>
      <div className="page-head">
        <h1>Telemetry</h1>
        <select value={season} onChange={(e) => {
          setSeason(e.target.value)
          setSessionKey(null)
        }} aria-label="Season">
          {TELEMETRY_SEASONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="controls">
        <label>
          <span className="lbl">Race</span>
          <select
            value={sessionKey ?? ''}
            onChange={(e) => setSessionKey(Number(e.target.value))}
            disabled={!sessions.data?.length}
          >
            {(sessions.data ?? []).map((s) => (
              <option key={s.sessionKey} value={s.sessionKey}>
                {s.name} — {s.location}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lbl">Driver</span>
          <select
            value={driverNumber ?? ''}
            onChange={(e) => {
              setDriverNumber(Number(e.target.value))
              setLapNumber(null)
            }}
            disabled={!drivers.data?.length}
          >
            {(drivers.data ?? []).map((d) => (
              <option key={d.driverNumber} value={d.driverNumber}>
                #{d.driverNumber} {d.acronym} — {d.team}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lbl">Lap</span>
          <select
            value={lapNumber ?? ''}
            onChange={(e) => setLapNumber(Number(e.target.value))}
            disabled={!validLaps.length}
          >
            {validLaps.map((l) => (
              <option key={l.lapNumber} value={l.lapNumber}>
                Lap {l.lapNumber} — {formatLap(l.lapDuration)}
                {fastestLap?.lapNumber === l.lapNumber ? ' (fastest)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sessions.error && (
        <p className="banner">Could not load races: {sessions.error}</p>
      )}

      {/* Lap times across the race */}
      <div className="chart-card">
        <h2 className="chart-title">Lap times — {driver?.acronym ?? ''}</h2>
        {laps.loading && <p className="muted">Loading laps…</p>}
        {!laps.loading && validLaps.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={validLaps.map((l) => ({
                lap: l.lapNumber,
                time: l.lapDuration,
              }))}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke="#2a2a35" vertical={false} />
              <XAxis dataKey="lap" stroke="#9a9aa8" fontSize={12} />
              <YAxis
                stroke="#9a9aa8"
                fontSize={12}
                domain={['dataMin - 1', 'dataMax + 1']}
                tickFormatter={(v: number) => formatLap(v)}
                width={64}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a35' }}
                formatter={(v: number) => [formatLap(v), 'Lap time']}
              />
              {lapNumber != null && (
                <ReferenceLine x={lapNumber} stroke="#e10600" strokeDasharray="4 3" />
              )}
              <Line
                type="monotone"
                dataKey="time"
                stroke={teamColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Speed trace for the selected lap */}
      <div className="chart-card">
        <h2 className="chart-title">
          Speed trace — Lap {lapNumber ?? '—'}
        </h2>
        {telemetry.loading && <p className="muted">Loading telemetry…</p>}
        {telemetry.error && (
          <p className="banner">Could not load telemetry: {telemetry.error}</p>
        )}
        {!telemetry.loading && telemetry.data && (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={telemetry.data.points}
                margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid stroke="#2a2a35" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="#9a9aa8"
                  fontSize={12}
                  tickFormatter={(v: number) => `${v}s`}
                />
                <YAxis stroke="#9a9aa8" fontSize={12} unit=" km/h" width={70} />
                <Tooltip
                  contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a35' }}
                  labelFormatter={(v) => `${v}s`}
                />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke={teamColor}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <h3 className="chart-subtitle">Throttle &amp; brake</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart
                data={telemetry.data.points}
                margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid stroke="#2a2a35" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="#9a9aa8"
                  fontSize={12}
                  tickFormatter={(v: number) => `${v}s`}
                />
                <YAxis stroke="#9a9aa8" fontSize={12} unit="%" width={48} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a35' }}
                  labelFormatter={(v) => `${v}s`}
                />
                <Line type="monotone" dataKey="throttle" stroke="#36d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="brake" stroke="#e10600" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </section>
  )
}
