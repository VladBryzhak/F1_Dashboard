import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { fmtTime, teamColor, tyre } from '../lib/live'
import type { ReplayData, ReplayLap } from '../types/f1'

const SPEEDS = [5, 15, 30, 60]
const TICK_MS = 200

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
  iv: string | null
  tyreCompound: string | null
  tyreAge: number | null
  sectors: Sector[]
  lap: ReplayLap | null
}

// Per-driver indexes, built once per session.
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

// Board state at absolute time `absT`.
function buildBoard(
  d: ReplayData,
  ix: Indexed,
  absT: number,
): { rows: Row[]; lap: number } {
  const rows: Row[] = d.drivers.map((drv) => {
    const laps = ix.lapsByDriver.get(drv.num) ?? []
    let current: ReplayLap | null = null
    let lastDone: ReplayLap | null = null
    let best: number | null = null
    for (const lap of laps) {
      if (lap.t <= absT) current = lap
      if (lap.d != null && lap.t + lap.d * 1000 <= absT) {
        lastDone = lap
        if (best == null || lap.d < best) best = lap.d
      }
    }

    let position: number | null = null
    for (const e of ix.posByDriver.get(drv.num) ?? []) {
      if (e.t <= absT) position = e.p
      else break
    }

    const sectors: Sector[] = [0, 1, 2].map((i) => {
      if (!current) return { shown: false, time: null, color: '' }
      let acc = 0
      for (let k = 0; k <= i; k++) acc += current.s[k] ?? 0
      const completion = current.t + acc * 1000
      const shown = current.s[i] != null && absT >= completion
      return { shown, time: current.s[i], color: current.sc[i] ?? '' }
    })

    const lapNum = current?.lap ?? 0
    const stints = d.stints.filter((s) => s.num === drv.num)
    const st =
      stints.find((s) => lapNum >= s.start && lapNum <= s.end) ??
      stints[stints.length - 1]
    const age =
      st && lapNum
        ? (st.age ?? 0) + (Math.min(lapNum, st.end) - st.start)
        : null

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
      lap: current,
    }
  })

  rows.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  const lap = rows.reduce((m, r) => Math.max(m, r.lap?.lap ?? 0), 0)
  return { rows, lap }
}

function hhmmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function ReplayPlayer() {
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

  const [t, setT] = useState(0) // ms offset from startMs
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(15)

  const span = data ? data.endMs - data.startMs : 0

  useEffect(() => {
    setT(0)
    setPlaying(false)
  }, [sessionKey])

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
  const board = useMemo(
    () => (data && ix ? buildBoard(data, ix, data.startMs + t) : null),
    [data, ix, t],
  )

  return (
    <div className="replay">
      <div className="rp-head">
        <select
          className="rp-select"
          value={sessionKey ?? ''}
          onChange={(e) => setSessionKey(Number(e.target.value))}
          aria-label="Race"
        >
          {races.data?.map((r) => (
            <option key={r.sessionKey} value={r.sessionKey}>
              {r.year} · {r.location}
            </option>
          ))}
        </select>
      </div>

      {replay.loading && <p className="muted">Loading race…</p>}
      {replay.error && (
        <p className="banner">Could not load the replay: {replay.error}</p>
      )}

      {data && board && (
        <>
          <div className="rp-controls">
            <button
              className="rp-play"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause' : 'Play'}
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
              aria-label="Timeline"
            />
            <span className="rp-lap mono">
              Lap {board.lap} · {hhmmss(t)} / {hhmmss(span)}
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

          <div className="rp-board">
            <div className="rp-row rp-head-row">
              <span>#</span>
              <span>Driver</span>
              <span className="rp-sectors-h">Sectors</span>
              <span className="rp-num">Last</span>
              <span className="rp-num">Best</span>
              <span className="rp-num">Gap</span>
              <span>Tyre</span>
            </div>
            {board.rows.map((r) => {
              const ty = tyre(r.tyreCompound)
              return (
                <div className="rp-row" key={r.num}>
                  <span className="rp-pos">{r.position ?? '–'}</span>
                  <span className="rp-drv">
                    <span
                      className="lb-stripe"
                      style={{ background: teamColor(r.colour) }}
                    />
                    <span className="lb-code">{r.code}</span>
                  </span>
                  <span className="rp-sectors">
                    {r.sectors.map((s, i) => (
                      <span
                        key={i}
                        className={`rp-sec${s.shown ? ` sec-${s.color}` : ''}`}
                        title={s.shown && s.time != null ? fmtTime(s.time) : ''}
                      />
                    ))}
                  </span>
                  <span className="rp-num mono">{fmtTime(r.last)}</span>
                  <span className="rp-num mono">{fmtTime(r.best)}</span>
                  <span className="rp-num mono">{r.gl ?? '—'}</span>
                  <span className="rp-tyre">
                    <span className={`tyre tyre-${ty.cls}`}>{ty.label}</span>
                    {r.tyreAge != null && (
                      <span className="tyre-age">{r.tyreAge}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
