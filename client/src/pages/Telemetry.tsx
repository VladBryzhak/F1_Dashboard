import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import './Telemetry.css'
import { seoText } from '../lib/seoText'
import { CURRENT_SEASON } from '../lib/seasons'

// Recharts tooltip box on the panel surface with a hairline, as the cards.
const TOOLTIP = {
  background: 'var(--color-paper-2)',
  border: '1px solid var(--color-rule-2)',
  borderRadius: 6,
  color: 'var(--color-ink)',
}

// OpenF1 telemetry is available from 2023 onward.
const TELEMETRY_SEASONS = Array.from({ length: Math.max(1, CURRENT_SEASON - 2022) }, (_, i) =>
  String(CURRENT_SEASON - i),
)

function formatLap(seconds: number | null): string {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return m > 0 ? `${m}:${s.padStart(6, '0')}` : s
}

export default function Telemetry() {
  // Opens on the latest race run: this season's (or last season's, before
  // this one's first race).
  const [season, setSeason] = useState(String(CURRENT_SEASON))
  const autoSeason = useRef(true)
  const [sessionKey, setSessionKey] = useState<number | null>(null)
  const [driverNumber, setDriverNumber] = useState<number | null>(null)

  const { t, lang } = useI18n()
  useSeo({
    ...seoText.telemetry(lang),
  })
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

  // Cascade defaults: the latest race, first driver, and the fastest lap.
  useEffect(() => {
    const list = sessions.data
    // Right after a season change the list is still the previous season's.
    if (sessions.loading || (list?.length && !list[0].date.startsWith(season))) return
    if (list && list.length) setSessionKey((k) => k ?? list[list.length - 1].sessionKey)
    // No race run yet this season: open last season's final race instead.
    else if (list && autoSeason.current && Number(season) > 2023) {
      autoSeason.current = false
      setSeason(String(Number(season) - 1))
    }
  }, [sessions.data, sessions.loading, season])
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
  const teamColor = driver ? `#${driver.colour}` : 'var(--color-accent)'

  return (
    <section>
      <div className="page-head">
        <h1>{t('nav.telemetry')}</h1>
        <select value={season} onChange={(e) => {
          autoSeason.current = false
          setSeason(e.target.value)
          setSessionKey(null)
        }} aria-label={t('common.season')}>
          {TELEMETRY_SEASONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="controls">
        <label>
          <span className="lbl">{t('session.race')}</span>
          <select
            value={sessionKey ?? ''}
            onChange={(e) => setSessionKey(Number(e.target.value))}
            disabled={!sessions.data?.length}
          >
            {(sessions.data ?? []).map((s) => (
              <option key={s.sessionKey} value={s.sessionKey}>
                {s.name}, {s.location}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lbl">{t('wk.colDriver')}</span>
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
                #{d.driverNumber} {d.acronym}, {d.team}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="lbl">{t('tel.lap')}</span>
          <select
            value={lapNumber ?? ''}
            onChange={(e) => setLapNumber(Number(e.target.value))}
            disabled={!validLaps.length}
          >
            {validLaps.map((l) => (
              <option key={l.lapNumber} value={l.lapNumber}>
                {t('tel.lapN', { n: l.lapNumber })}: {formatLap(l.lapDuration)}
                {fastestLap?.lapNumber === l.lapNumber ? ` (${t('tel.fastest')})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sessions.error && (
        <p className="banner">{t('tel.racesError', { error: sessions.error })}</p>
      )}

      {/* Lap times across the race */}
      <div className="chart-card">
        <h2 className="chart-title">
          {t('tel.lapTimes')} <span className="chart-title-note mono">{driver?.acronym ?? ''}</span>
        </h2>
        {laps.loading && <p className="muted">{t('common.loading')}</p>}
        {!laps.loading && laps.error && (
          <p className="banner">{t('tel.error', { error: laps.error })}</p>
        )}
        {!laps.loading && validLaps.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={validLaps.map((l) => ({
                lap: l.lapNumber,
                time: l.lapDuration,
              }))}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke="var(--color-rule)" vertical={false} />
              <XAxis dataKey="lap" stroke="var(--color-muted)" fontSize={12} />
              <YAxis
                stroke="var(--color-muted)"
                fontSize={12}
                domain={['dataMin - 1', 'dataMax + 1']}
                tickFormatter={(v: number) => formatLap(v)}
                width={64}
              />
              <Tooltip
                contentStyle={TOOLTIP}
                formatter={(v: number) => [formatLap(v), t('tel.lapTime')]}
              />
              {lapNumber != null && (
                <ReferenceLine x={lapNumber} stroke="var(--color-cool)" strokeDasharray="4 3" />
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
          {t('tel.speedTrace')}{' '}
          {lapNumber != null && (
            <span className="chart-title-note">{t('tel.lapN', { n: lapNumber })}</span>
          )}
        </h2>
        {telemetry.loading && <p className="muted">{t('common.loading')}</p>}
        {telemetry.error && (
          <p className="banner">{t('tel.error', { error: telemetry.error })}</p>
        )}
        {!telemetry.loading && telemetry.data && (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={telemetry.data.points}
                margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="var(--color-muted)"
                  fontSize={12}
                  tickFormatter={(v: number) => `${v}s`}
                />
                <YAxis stroke="var(--color-muted)" fontSize={12} unit={` ${t('tel.kmh')}`} width={70} />
                <Tooltip
                  contentStyle={TOOLTIP}
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

            <h3 className="chart-subtitle">{t('tel.throttleBrake')}</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart
                data={telemetry.data.points}
                margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="var(--color-muted)"
                  fontSize={12}
                  tickFormatter={(v: number) => `${v}s`}
                />
                <YAxis stroke="var(--color-muted)" fontSize={12} unit="%" width={48} domain={[0, 100]} />
                <Tooltip
                  contentStyle={TOOLTIP}
                  labelFormatter={(v) => `${v}s`}
                />
                <Line type="monotone" dataKey="throttle" name={t('tel.throttle')} stroke="var(--color-ok)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="brake" name={t('tel.brake')} stroke="var(--color-bad)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </section>
  )
}
