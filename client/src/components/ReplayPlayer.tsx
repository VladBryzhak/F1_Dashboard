import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { fmtTime, segmentClass, teamColor, tyre } from '../lib/live'
import type { ReplayData, ReplayLap } from '../types/f1'

const SPEEDS = [5, 15, 30, 60]
const TICK_MS = 200

const STATUS: Record<string, { label: string; cls: string }> = {
  green: { label: 'Green flag', cls: 'green' },
  yellow: { label: 'Yellow flag', cls: 'yellow' },
  sc: { label: 'Safety Car', cls: 'sc' },
  vsc: { label: 'Virtual Safety Car', cls: 'vsc' },
  red: { label: 'Red flag', cls: 'red' },
  chequered: { label: 'Chequered flag', cls: 'chequered' },
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
    for (const e of ix.posByDriver.get(drv.num) ?? []) {
      if (e.t <= absT) position = e.p
      else break
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
  const lap = row.lap
  const stints = data.stints.filter((s) => s.num === row.num)
  return (
    <div className="ld-detail">
      {lap && (
        <div className="ld-sectors">
          {[0, 1, 2].map((i) => (
            <div className="ld-sector" key={i}>
              <div className="ld-sector-head">
                <span>Sector {i + 1}</span>
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
        <div className="ld-col">
          <h4>Speeds</h4>
          <div className="ld-kv">
            <span>Speed trap</span>
            <span className="mono">
              {lap?.sp[2] != null ? `${lap.sp[2]} km/h` : '—'}
            </span>
          </div>
        </div>
        <div className="ld-col">
          <h4>Tyres</h4>
          {stints.map((s) => {
            const t = tyre(s.compound)
            return (
              <div className="ld-kv" key={s.start}>
                <span>
                  <span className={`tyre tyre-${t.cls}`}>{t.label}</span> Laps{' '}
                  {s.start}–{s.end}
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
  const [expanded, setExpanded] = useState<number | null>(null)

  const span = data ? data.endMs - data.startMs : 0

  useEffect(() => {
    setT(0)
    setPlaying(false)
    setExpanded(null)
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
  const status = useMemo(
    () => (data ? statusAt(data.flags, data.startMs + t) : 'green'),
    [data, t],
  )
  const st = STATUS[status] ?? STATUS.green

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
          <div className={`rp-status rp-status--${st.cls}`}>
            <span className="rp-status-dot" />
            {st.label}
          </div>

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
              <span>Sectors</span>
              <span className="rp-num">Last</span>
              <span className="rp-num">Best</span>
              <span className="rp-num">Gap</span>
              <span>Tyre</span>
            </div>
            {board.rows.map((r) => {
              const ty = tyre(r.tyreCompound)
              const open = expanded === r.num
              return (
                <div key={r.num}>
                  <button
                    className={`rp-row rp-row-btn${open ? ' open' : ''}`}
                    onClick={() => setExpanded(open ? null : r.num)}
                    aria-expanded={open}
                  >
                    <span className="rp-pos">{r.position ?? '–'}</span>
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
                    <span className="rp-num mono">{fmtTime(r.last)}</span>
                    <span className="rp-num mono">{fmtTime(r.best)}</span>
                    <span className="rp-num mono">{r.gl ?? '—'}</span>
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
        </>
      )}
    </div>
  )
}
