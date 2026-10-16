import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { fmtTime, segmentClass, teamColor, tyre } from '../lib/live'
import type { ReplayData, ReplayLap } from '../types/f1'
import WeatherCard, { weatherAt } from './WeatherCard'
import { useI18n, type TKey } from '../i18n/core'
import './ReplayPlayer.css'

const SPEEDS = [5, 15, 30, 60]
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
  gl: string | null
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

function buildBoard(
  d: ReplayData,
  ix: Indexed,
  absT: number,
  moveWindow: number,
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
      tyreCompound: st?.compound ?? null,
      tyreAge: age,
      sectors,
      inPit,
      lap: show,
      posMove,
    }
  })

  rows.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
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
                  {row.sectors[i].shown ? fmtTime(lap.s[i]) : '—'}
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
              {lap?.sp[2] != null ? `${lap.sp[2]} ${tr('tel.kmh')}` : '—'}
            </span>
          </div>
        </div>
        <div className="ld-col">
          <h4>{tr('rp.tyres')}</h4>
          {stints.map((s) => {
            const t = tyre(s.compound)
            return (
              <div className="ld-kv" key={s.start}>
                <span>
                  <span className={`tyre tyre-${t.cls}`}>{t.label}</span>{' '}
                  {tr('strat.laps', { from: s.start, to: s.end })}
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
  const races = useAsync(() => api.replayRaces(), [])
  const [sessionKey, setSessionKey] = useState<number | null>(null)
  useEffect(() => {
    if (sessionKey == null && races.data?.length) {
      setSessionKey(races.data[0].sessionKey)
    }
  }, [races.data, sessionKey])

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
      data && ix ? buildBoard(data, ix, data.startMs + t, moveWindow) : null,
    [data, ix, t, moveWindow],
  )
  const status = useMemo(
    () => (data ? statusAt(data.flags, data.startMs + t) : 'green'),
    [data, t],
  )
  const st = STATUS[status] ?? STATUS.green
  const weather = useMemo(
    () => (data?.weather ? weatherAt(data.weather, data.startMs + t) : null),
    [data, t],
  )
  // Session-fastest lap so far, for the side panel.
  const fastest = useMemo(() => {
    let m: number | null = null
    for (const r of board?.rows ?? []) {
      if (r.best != null && (m == null || r.best < m)) m = r.best
    }
    return m
  }, [board])

  return (
    <div className="replay">
      <div className="rp-head">
        <select
          className="rp-select"
          value={sessionKey ?? ''}
          onChange={(e) => setSessionKey(Number(e.target.value))}
          aria-label={tr('session.race')}
        >
          {races.data?.map((r) => (
            <option key={r.sessionKey} value={r.sessionKey}>
              {r.year} · {r.location}
              {r.isSprint ? ` (${tr('session.sprint')})` : ''}
            </option>
          ))}
        </select>
      </div>

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
              {playing ? '❚❚' : '►'}
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
              {tr('tel.lapN', { n: board.lap })} · {hhmmss(t)} / {hhmmss(span)}
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

          <div className="rp-layout">
          <div className="rp-main">
          <div className="rp-board">
            <div className="rp-row rp-head-row">
              <span>#</span>
              <span>{tr('wk.colDriver')}</span>
              <span>{tr('rp.sectors')}</span>
              <span className="rp-num rp-last">{tr('rp.last')}</span>
              <span className="rp-num rp-best">{tr('rp.best')}</span>
              <span className="rp-num rp-gap">{tr('wk.colGap')}</span>
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
                      {r.position ?? '–'}
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
                    <span className="rp-num rp-gap mono">{r.gl ?? '—'}</span>
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
            <div className="rp-side-card">
              <h4 className="rp-side-title">{tr('rp.session')}</h4>
              <div className="rp-kv"><span>{tr('rp.circuit')}</span><span>{data.session.location}</span></div>
              <div className="rp-kv"><span>{tr('tel.lap')}</span><span className="mono">{board.lap}</span></div>
              <div className="rp-kv"><span>{tr('wk.fastestLap')}</span><span className="mono">{fmtTime(fastest)}</span></div>
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
