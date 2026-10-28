import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { fmtTime, segmentClass, sessionLabel, teamColor, tyre } from '../lib/live'
import type { ReplayData, ReplayLap, ReplaySession } from '../types/f1'
import WeatherCard, { weatherAt } from './WeatherCard'
import BestSectors, { type LapRecord, type SectorRecord } from './BestSectors'
import TrackMap from './TrackMap'
import { buildTrackModel } from '../lib/trackModel'
import { useI18n, type TKey } from '../i18n/core'
import './ReplayPlayer.css'

const SPEEDS = [5, 15, 30, 60]

// Compact session labels for the session switch.
const SESSION_SHORT: Record<string, TKey> = {
  'Practice 1': 'rp.fp1',
  'Practice 2': 'rp.fp2',
  'Practice 3': 'rp.fp3',
  'Sprint Qualifying': 'rp.sq',
  'Sprint Shootout': 'rp.sq',
  Sprint: 'session.sprint',
  Qualifying: 'rp.q',
  Race: 'session.race',
}
const TICK_MS = 200

const STATUS: Record<string, { label: TKey; cls: string }> = {
  green: { label: 'flag.green', cls: 'green' },
  yellow: { label: 'flag.yellow', cls: 'yellow' },
  sc: { label: 'flag.sc', cls: 'sc' },
  vsc: { label: 'flag.vsc', cls: 'vsc' },
  red: { label: 'flag.red', cls: 'red' },
  chequered: { label: 'flag.chequered', cls: 'chequered' },
}

interface Sector {
  shown: boolean
  time: number | null
  color: string
}
interface Row {
  num: number
  code: string
  colour: string | null
  position: number | null
  last: number | null
  best: number | null
  gl: string | null // gap to the leader
  iv: string | null // interval to the car ahead
  tyreCompound: string | null
  tyreAge: number | null
  sectors: Sector[]
  inPit: boolean
  lap: ReplayLap | null
  // Direction of the driver's most recent position change, non-null only while
  // that change is still "fresh" (so the arrow + row highlight fade out).
  posMove: 'up' | 'down' | null
}

function indexReplay(d: ReplayData) {
  const lapsByDriver = new Map<number, ReplayLap[]>()
  for (const l of d.laps) {
    const arr = lapsByDriver.get(l.num) ?? []
    arr.push(l)
    lapsByDriver.set(l.num, arr)
  }
  for (const arr of lapsByDriver.values()) arr.sort((a, b) => a.t - b.t)

  const posByDriver = new Map<number, { p: number; t: number }[]>()
  for (const p of d.pos) {
    const arr = posByDriver.get(p.num) ?? []
    arr.push(p)
    posByDriver.set(p.num, arr)
  }
  for (const arr of posByDriver.values()) arr.sort((a, b) => a.t - b.t)

  return { lapsByDriver, posByDriver }
}
type Indexed = ReturnType<typeof indexReplay>

function statusAt(flags: { t: number; s: string }[], absT: number): string {
  let s = 'green'
  for (const f of flags) {
    if (f.t <= absT) s = f.s
    else break
  }
  return s
}

// Best completed lap at time `at` (practice / qualifying order by this).
function bestUpTo(laps: ReplayLap[], at: number): number | null {
  let best: number | null = null
  for (const lap of laps) {
    if (lap.d != null && lap.t + lap.d * 1000 <= at && (best == null || lap.d < best)) best = lap.d
  }
  return best
}

// Order by best lap so far: rank per driver (0-based), drivers without a time last.
function rankByBest(d: ReplayData, ix: Indexed, at: number): Map<number, number> {
  const bests = d.drivers
    .map((drv) => ({ num: drv.num, best: bestUpTo(ix.lapsByDriver.get(drv.num) ?? [], at) }))
    .filter((x) => x.best != null)
    .sort((a, b) => a.best! - b.best!)
  return new Map(bests.map((x, i) => [x.num, i]))
}

// `timed`: practice and qualifying, where the order is by best lap and the gap
// is to the fastest lap — not the race order from line crossings.
function buildBoard(
  d: ReplayData,
  ix: Indexed,
  absT: number,
  moveWindow: number,
  timed: boolean,
): { rows: Row[]; lap: number } {
  let maxLap = 0
  const rows: Row[] = d.drivers.map((drv) => {
    const laps = ix.lapsByDriver.get(drv.num) ?? []

    // The lap currently under way, and the one before it.
    let curIdx = -1
    for (let i = 0; i < laps.length; i++) {
      if (laps[i].t <= absT) curIdx = i
      else break
    }
    const current = curIdx >= 0 ? laps[curIdx] : null
    const prev = curIdx >= 1 ? laps[curIdx - 1] : null
    if (current) maxLap = Math.max(maxLap, current.lap)

    let lastDone: ReplayLap | null = null
    let best: number | null = null
    for (const lap of laps) {
      if (lap.d != null && lap.t + lap.d * 1000 <= absT) {
        lastDone = lap
        if (best == null || lap.d < best) best = lap.d
      }
    }

    let position: number | null = null
    let posMove: 'up' | 'down' | null = null
    const posSeries = ix.posByDriver.get(drv.num) ?? []
    let curPosIdx = -1
    for (let i = 0; i < posSeries.length; i++) {
      if (posSeries[i].t <= absT) curPosIdx = i
      else break
    }
    if (curPosIdx >= 0) {
      position = posSeries[curPosIdx].p
      // The latest change is still fresh if it landed within the window; its
      // direction is relative to the position held just before it.
      if (curPosIdx >= 1 && absT - posSeries[curPosIdx].t <= moveWindow) {
        const prevP = posSeries[curPosIdx - 1].p
        if (position < prevP) posMove = 'up'
        else if (position > prevP) posMove = 'down'
      }
    }

    // Keep the just-finished lap on screen through the new lap's sector 1, so
    // its final sector doesn't vanish the instant the car crosses the line.
    const s1Done =
      !!current &&
      current.s[0] != null &&
      absT >= current.t + current.s[0] * 1000
    const holdPrev = !!current && !s1Done && !!prev
    const show = holdPrev ? prev! : current

    const sectors: Sector[] = [0, 1, 2].map((i) => {
      if (!show) return { shown: false, time: null, color: '' }
      let shown: boolean
      if (holdPrev) {
        shown = show.s[i] != null
      } else {
        let acc = 0
        for (let k = 0; k <= i; k++) acc += show.s[k] ?? 0
        shown = show.s[i] != null && absT >= show.t + acc * 1000
      }
      return { shown, time: show.s[i], color: show.sc[i] ?? '' }
    })

    const lapNum = current?.lap ?? 0
    const stints = d.stints.filter((s) => s.num === drv.num)
    const st =
      stints.find((s) => lapNum >= s.start && lapNum <= s.end) ??
      stints[stints.length - 1]
    const age =
      st && lapNum ? (st.age ?? 0) + (Math.min(lapNum, st.end) - st.start) : null

    const inPit = d.pits.some(
      (p) => p.num === drv.num && absT >= p.from && absT <= p.to,
    )

    return {
      num: drv.num,
      code: drv.code,
      colour: drv.colour,
      position,
      last: lastDone?.d ?? null,
      best,
      gl: lastDone?.gl ?? null,
      iv: lastDone?.iv ?? null,
      tyreCompound: st?.compound ?? null,
      tyreAge: age,
      sectors,
      inPit,
      lap: show,
      posMove,
    }
  })

  if (timed) {
    const now = rankByBest(d, ix, absT)
    const before = rankByBest(d, ix, absT - moveWindow)
    const leaderBest = rows.reduce<number | null>(
      (m, r) => (r.best != null && (m == null || r.best < m) ? r.best : m),
      null,
    )
    for (const r of rows) {
      const rank = now.get(r.num)
      r.position = rank == null ? null : rank + 1
      r.gl = rank && r.best != null && leaderBest != null ? `+${(r.best - leaderBest).toFixed(3)}` : null
      const prev = before.get(r.num)
      r.posMove = rank == null || prev == null || prev === rank ? null : rank < prev ? 'up' : 'down'
    }
  }

  rows.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  // Practice and qualifying: the interval is the best-lap difference to the
  // driver ranked just above.
  if (timed) {
    rows.forEach((r, i) => {
      const ahead = rows[i - 1]
      r.iv = i > 0 && r.position != null && r.best != null && ahead?.best != null
        ? `+${(r.best - ahead.best).toFixed(3)}`
        : null
    })
  }
  return { rows, lap: maxLap }
}

function hhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Expanded per-lap detail for the clicked driver.
function RowDetail({ data, row }: { data: ReplayData; row: Row }) {
  const { t: tr } = useI18n()
  const lap = row.lap
  const stints = data.stints.filter((s) => s.num === row.num)
  return (
    <div className="ld-detail">
      {lap && (
        <div className="ld-sectors">
          {[0, 1, 2].map((i) => (
            <div className="ld-sector" key={i}>
              <div className="ld-sector-head">
                <span>{tr('rp.sectorN', { n: i + 1 })}</span>
                <span
                  className={`ld-sector-time${
                    row.sectors[i].shown ? ` sector-${sectorLong(lap.sc[i])}` : ''
                  }`}
                >
                  {row.sectors[i].shown ? fmtTime(lap.s[i]) : ''}
                </span>
              </div>
              <span className="seg-bar">
                {(row.sectors[i].shown ? lap.seg[i] : []).map((code, k) => (
                  <span key={k} className={`seg seg-${segmentClass(code)}`} />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="ld-cols">
        {/* Phone-only: the board drops its Last/Best columns there. */}
        <div className="ld-col ld-col--phone">
          <h4>{tr('tel.lap')}</h4>
          <div className="ld-kv">
            <span>{tr('rp.last')}</span>
            <span className="mono">{fmtTime(row.last)}</span>
          </div>
          <div className="ld-kv">
            <span>{tr('rp.best')}</span>
            <span className="mono">{fmtTime(row.best)}</span>
          </div>
        </div>
        <div className="ld-col">
          <h4>{tr('rp.speeds')}</h4>
          <div className="ld-kv">
            <span>{tr('rp.speedTrap')}</span>
            <span className="mono">
              {lap?.sp[2] != null ? `${lap.sp[2]} ${tr('tel.kmh')}` : ''}
            </span>
          </div>
        </div>
        <div className="ld-col">
          <h4>{tr('rp.tyres')}</h4>
          {stints.map((s) => {
            const t = tyre(s.compound)
            return (
              <div className="ld-kv" key={s.start}>
                <span className="ld-stint">
                  <span className={`tyre tyre-${t.cls}`}>{t.label}</span>
                  <span>{tr('strat.laps', { from: s.start, to: s.end })}</span>
                </span>
                <span className="muted">{s.compound ?? ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function sectorLong(c: string): string {
  return c === 'p' ? 'purple' : c === 'g' ? 'green' : c === 'y' ? 'yellow' : ''
}

export default function ReplayPlayer() {
  // `t` is the playback clock below, so the translator is `tr` here.
  const { t: tr } = useI18n()
  const sessions = useAsync(() => api.replaySessions(), [])
  // Weekends (newest first), each with its sessions in running order.
  const weekends = useMemo(() => {
    const byMeeting = new Map<number, ReplaySession[]>()
    for (const s of sessions.data ?? []) {
      const arr = byMeeting.get(s.meetingKey) ?? []
      arr.push(s)
      byMeeting.set(s.meetingKey, arr)
    }
    return [...byMeeting.values()].map((list) =>
      list.slice().sort((a, b) => a.date.localeCompare(b.date)),
    )
  }, [sessions.data])
  const [sessionKey, setSessionKey] = useState<number | null>(null)
  // Default: the latest weekend's race (or its last session so far).
  useEffect(() => {
    if (sessionKey == null && weekends.length) {
      const w = weekends[0]
      setSessionKey((w.find((s) => s.sessionName === 'Race') ?? w[w.length - 1]).sessionKey)
    }
  }, [weekends, sessionKey])
  const weekend = weekends.find((w) => w.some((s) => s.sessionKey === sessionKey)) ?? null
  const current = weekend?.find((s) => s.sessionKey === sessionKey) ?? null
  const timed = !!current && current.sessionName !== 'Race' && current.sessionName !== 'Sprint'

  function pickWeekend(meetingKey: number) {
    const w = weekends.find((x) => x[0].meetingKey === meetingKey)
    if (w) setSessionKey((w.find((s) => s.sessionName === 'Race') ?? w[w.length - 1]).sessionKey)
  }

  const replay = useAsync(
    () => (sessionKey ? api.replay(sessionKey) : Promise.resolve(null)),
    [sessionKey],
  )
  const data = replay.data ?? null

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(15)
  // Driver numbers whose lap detail is expanded — several can be open at once.
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const span = data ? data.endMs - data.startMs : 0

  useEffect(() => {
    setT(0)
    setPlaying(false)
    setExpanded(new Set())
  }, [sessionKey])

  const toggleRow = (num: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })

  useEffect(() => {
    if (!playing || !data) return
    const id = setInterval(() => {
      setT((prev) => {
        const next = prev + TICK_MS * speed
        if (next >= span) {
          setPlaying(false)
          return span
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, speed, data, span])

  const ix = useMemo(() => (data ? indexReplay(data) : null), [data])
  // Keep the position-change cue visible for ~2.5s of real time regardless of
  // playback speed (virtual time advances by 1000·speed ms per real second).
  const moveWindow = speed * 2500
  const board = useMemo(
    () =>
      data && ix ? buildBoard(data, ix, data.startMs + t, moveWindow, timed) : null,
    [data, ix, t, moveWindow, timed],
  )
  const status = useMemo(
    () => (data ? statusAt(data.flags, data.startMs + t) : 'green'),
    [data, t],
  )
  const st = STATUS[status] ?? STATUS.green
  // Track map: positions from timing (see lib/trackModel). Overtakes are
  // pinned in races only — in practice/qualifying the order is by best lap.
  const trackModel = useMemo(() => (data ? buildTrackModel(data, !timed) : null), [data, timed])
  const weather = useMemo(
    () => (data?.weather ? weatherAt(data.weather, data.startMs + t) : null),
    [data, t],
  )
  // Best sector times so far and who set them: a sector counts once the car
  // has crossed its end line on the replay clock.
  const bestSectors = useMemo((): SectorRecord[] => {
    const out: SectorRecord[] = [0, 1, 2].map(() => ({ time: null, code: null, colour: null }))
    if (!data) return out
    const absT = data.startMs + t
    const drivers = new Map(data.drivers.map((d) => [d.num, d]))
    for (const lap of data.laps) {
      if (lap.t > absT) continue
      let end = lap.t
      for (let i = 0; i < 3; i++) {
        const s = lap.s[i]
        if (s == null) break
        end += s * 1000
        if (end > absT) break
        if (out[i].time == null || s < out[i].time!) {
          const drv = drivers.get(lap.num)
          out[i] = { time: s, code: drv?.code ?? String(lap.num), colour: drv?.colour ?? null }
        }
      }
    }
    return out
  }, [data, t])

  // Session-fastest lap so far and who set it, for the bests card.
  const fastest = useMemo((): LapRecord | null => {
    if (!data) return null
    const absT = data.startMs + t
    let best: ReplayLap | null = null
    for (const lap of data.laps) {
      if (lap.d == null || lap.t + lap.d * 1000 > absT) continue
      if (!best || lap.d < best.d!) best = lap
    }
    if (!best) return null
    const drv = data.drivers.find((d) => d.num === best!.num)
    return { time: best.d, code: drv?.code ?? String(best.num), colour: drv?.colour ?? null, lap: best.lap }
  }, [data, t])

  return (
    <div className="replay">
      <div className="rp-head">
        <select
          className="rp-select"
          value={weekend?.[0].meetingKey ?? ''}
          onChange={(e) => pickWeekend(Number(e.target.value))}
          aria-label={tr('rp.weekend')}
        >
          {weekends.map((w) => (
            <option key={w[0].meetingKey} value={w[0].meetingKey}>
              {w[0].location} {w[0].year}
            </option>
          ))}
        </select>
        {weekend && (
          <div className="seg-switch rp-sessions" role="group" aria-label={tr('rp.session')}>
            {weekend.map((s) => (
              <button
                key={s.sessionKey}
                type="button"
                className={s.sessionKey === sessionKey ? 'on' : undefined}
                aria-pressed={s.sessionKey === sessionKey}
                title={sessionLabel(s.sessionName, tr)}
                onClick={() => setSessionKey(s.sessionKey)}
              >
                {tr(SESSION_SHORT[s.sessionName] ?? 'session.race')}
              </button>
            ))}
          </div>
        )}
      </div>
      {timed && <p className="rp-note muted">{tr('rp.timedNote')}</p>}

      {replay.loading && <p className="muted">{tr('common.loading')}</p>}
      {replay.error && (
        <p className="banner">{tr('rp.error', { error: replay.error })}</p>
      )}

      {data && board && (
        <>
          <div className={`rp-status rp-status--${st.cls}`}>
            <span className="rp-status-dot" />
            {tr(st.label)}
          </div>

          <div className="rp-controls">
            <button
              className="rp-play"
              onClick={() => setPlaying((p) => !p)}
              aria-label={tr(playing ? 'rp.pause' : 'rp.play')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                {playing ? (
                  <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
                ) : (
                  <path d="M4.5 2.2v11.6L13.5 8z" fill="currentColor" />
                )}
              </svg>
            </button>
            <input
              className="rp-scrub"
              type="range"
              min={0}
              max={span}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              aria-label={tr('rp.timeline')}
            />
            <span className="rp-lap mono">
              {!timed && <span>{tr('tel.lapN', { n: board.lap })}</span>}
              <span>
                {hhmmss(t)} / {hhmmss(span)}
              </span>
            </span>
            <span className="rp-speeds">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={s === speed ? 'rp-speed active' : 'rp-speed'}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </span>
          </div>

          <div className={`rp-layout${trackModel ? ' has-map' : ''}`}>
          {trackModel && (
            <div className="rp-map-slot">
              <TrackMap
                data={data}
                model={trackModel}
                time={data.startMs + t}
                playing={playing}
                speed={speed}
                order={board.rows.map((r) => r.num)}
                highlight={expanded}
              />
            </div>
          )}
          <div className="rp-main">
          <div className="rp-board">
            <div className="rp-row rp-head-row">
              <span>#</span>
              <span>{tr('wk.colDriver')}</span>
              <span>{tr('rp.sectors')}</span>
              <span className="rp-num rp-last">{tr('rp.last')}</span>
              <span className="rp-num rp-best">{tr('rp.best')}</span>
              <span className="rp-num rp-gap">{tr('wk.colGap')}</span>
              <span className="rp-num rp-int">{tr('live.interval')}</span>
              <span>{tr('rp.tyre')}</span>
            </div>
            {board.rows.map((r) => {
              const ty = tyre(r.tyreCompound)
              const open = expanded.has(r.num)
              return (
                <div key={r.num}>
                  <button
                    className={`rp-row rp-row-btn${open ? ' open' : ''}${
                      r.posMove ? ` rp-move-${r.posMove}` : ''
                    }`}
                    onClick={() => toggleRow(r.num)}
                    aria-expanded={open}
                  >
                    <span className="rp-pos">
                      {r.position ?? ''}
                      {r.posMove && (
                        <span className={`rp-arrow rp-arrow-${r.posMove}`}>
                          {r.posMove === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                    <span className="rp-drv">
                      <span
                        className="lb-stripe"
                        style={{ background: teamColor(r.colour) }}
                      />
                      <span className="lb-code">{r.code}</span>
                      {r.inPit && <span className="rp-pit">PIT</span>}
                    </span>
                    <span className="rp-sectors">
                      {r.sectors.map((s, i) => (
                        <span
                          key={i}
                          className={`rp-sec${s.shown ? ` sec-${s.color}` : ''}`}
                        />
                      ))}
                    </span>
                    <span className="rp-num rp-last mono">{fmtTime(r.last)}</span>
                    <span className="rp-num rp-best mono">{fmtTime(r.best)}</span>
                    <span className="rp-num rp-gap mono">{r.gl ?? ''}</span>
                    <span className="rp-num rp-int mono">{r.iv ?? ''}</span>
                    <span className="rp-tyre">
                      <span className={`tyre tyre-${ty.cls}`}>{ty.label}</span>
                      {r.tyreAge != null && (
                        <span className="tyre-age">{r.tyreAge}</span>
                      )}
                    </span>
                  </button>
                  {open && <RowDetail data={data} row={r} />}
                </div>
              )
            })}
          </div>
          </div>
          <aside className="rp-side">
            <BestSectors sectors={bestSectors} fastest={fastest} />
            <div className="rp-side-card">
              <h4 className="rp-side-title">{tr('rp.session')}</h4>
              <div className="rp-kv"><span>{tr('rp.circuit')}</span><span>{data.session.location}</span></div>
              {current && (
                <div className="rp-kv"><span>{tr('rp.session')}</span><span>{sessionLabel(current.sessionName, tr)}</span></div>
              )}
              {!timed && (
                <div className="rp-kv"><span>{tr('tel.lap')}</span><span className="mono">{board.lap}</span></div>
              )}
              <div className="rp-kv"><span>{tr('rp.status')}</span><span className={`rp-side-status rp-side-status--${st.cls}`}>{tr(st.label)}</span></div>
            </div>
            <WeatherCard sample={weather} />
          </aside>
          </div>
        </>
      )}
    </div>
  )
}
