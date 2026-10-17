import type { ReplayData, TrackLine } from '../types/f1'

// Where every car is on the track map at a given moment of a replay.
//
// We don't have continuous car positions (too heavy to load), but we do have
// precise timing: when each lap and sector started and ended, when a car left
// and rejoined the racing line for a pit stop, and when race positions changed.
// Each car's "progress" (in seconds of a reference lap, counted across laps) is
// pinned to those moments; between them it follows the reference lap's own
// speed profile, so cars brake into corners and accelerate out of them.

const STEP = 0.25 // seconds of reference lap between line points
const GARAGE_GAP = 30_000 // ms without a lap running → the car is in the garage

type Knot = [number, number] // [epoch ms, progress in reference-lap seconds]

export interface CarState {
  num: number
  x: number
  y: number
  inPit: boolean // on the pit-lane path
  inGarage: boolean // between runs (practice / qualifying) or before the start
}

export interface TrackModel {
  track: TrackLine
  linePath: string
  pitPath: string | null
  finish: [number, number]
  stateAt(time: number): CarState[]
}

function pointOnLine(track: TrackLine, tau: number): [number, number] {
  const T = track.lapTime
  const t = ((tau % T) + T) % T
  const i = t / STEP
  const a = track.line[Math.min(Math.floor(i), track.line.length - 1)]
  const b = track.line[Math.min(Math.floor(i) + 1, track.line.length - 1)]
  const f = i - Math.floor(i)
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

function pointOnPit(track: TrackLine, s: number): [number, number] {
  const path = track.pit!.path
  if (s <= path[0][2]) return [path[0][0], path[0][1]]
  for (let i = 1; i < path.length; i++) {
    if (path[i][2] >= s) {
      const a = path[i - 1], b = path[i]
      const f = (s - a[2]) / (b[2] - a[2] || 1)
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
  }
  const last = path[path.length - 1]
  return [last[0], last[1]]
}

// Progress at `time` by linear interpolation between knots (sorted by time).
function progressAt(knots: Knot[], time: number): number | null {
  if (!knots.length || time < knots[0][0] || time > knots[knots.length - 1][0]) return null
  let lo = 0
  let hi = knots.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (knots[mid][0] <= time) lo = mid
    else hi = mid
  }
  const [t0, p0] = knots[lo]
  const [t1, p1] = knots[hi]
  return t1 === t0 ? p1 : p0 + ((p1 - p0) * (time - t0)) / (t1 - t0)
}

// Keep knots strictly increasing in time and never going backwards in progress.
function tidy(knots: Knot[]): Knot[] {
  knots.sort((a, b) => a[0] - b[0])
  const out: Knot[] = []
  for (const k of knots) {
    const prev = out[out.length - 1]
    if (prev && (k[0] <= prev[0] || k[1] < prev[1])) continue
    out.push(k)
  }
  return out
}

export function buildTrackModel(d: ReplayData, isRace: boolean): TrackModel | null {
  const track = d.track
  if (!track) return null
  const T = track.lapTime
  const [s1, s2] = track.sectors
  const pit = track.pit
  const pitDetourRef = pit ? pit.path[pit.path.length - 1][2] : 0

  const linePath = 'M' + track.line.map(([x, y]) => `${x} ${y}`).join('L') + 'Z'
  const pitPath = pit ? 'M' + pit.path.map(([x, y]) => `${x} ${y}`).join('L') : null

  // Per-driver knots and pit windows.
  const knotsBy = new Map<number, Knot[]>()
  const runsBy = new Map<number, [number, number][]>() // continuous on-track runs
  // `toGarage`: the car ends its run in the pits (practice / qualifying)
  // instead of rejoining — no new lap starts right after the pit lane.
  const pitsBy = new Map<number, { from: number; to: number; lane: number | null; toGarage: boolean }[]>()
  for (const p of d.pits) {
    const rejoins = d.laps.some((l) => l.num === p.num && l.t >= p.from && l.t <= p.to + 20_000)
    const arr = pitsBy.get(p.num) ?? []
    arr.push({ ...p, toGarage: !rejoins })
    pitsBy.set(p.num, arr)
  }

  for (const drv of d.drivers) {
    const laps = d.laps.filter((l) => l.num === drv.num).sort((a, b) => a.t - b.t)
    let knots: Knot[] = []
    for (let i = 0; i < laps.length; i++) {
      const l = laps[i]
      const base = (l.lap - 1) * T
      knots.push([l.t, base])
      if (l.s[0] != null) knots.push([l.t + l.s[0] * 1000, base + s1])
      if (l.s[0] != null && l.s[1] != null) knots.push([l.t + (l.s[0] + l.s[1]) * 1000, base + s2])
      const next = laps[i + 1]
      const end =
        l.d != null
          ? l.t + l.d * 1000
          : next && next.lap === l.lap + 1 && next.t - l.t < T * 1600
            ? next.t
            : null
      if (end != null) knots.push([end, base + T])
    }
    knots = tidy(knots)

    // Pit stops: the car leaves the line at the pit entry and rejoins at the
    // exit; timing knots inside that window belong to the pit lane.
    for (const w of pitsBy.get(drv.num) ?? []) {
      if (!pit) break
      if (w.toGarage) continue
      const entry = progressAt(knots, w.from)
      const before = knots.filter((k) => k[0] <= w.from)
      const lastBefore = before[before.length - 1]
      if (!lastBefore) continue
      // The lap under way when it pits: snap to that lap's pit entry point.
      const lapBase = Math.floor((entry ?? lastBefore[1]) / T) * T
      let entryProg = lapBase + pit.entry
      // Never jump a whole lap, never move backwards.
      if (entryProg < lastBefore[1] - T / 2) entryProg += T
      entryProg = Math.max(entryProg, lastBefore[1] + 0.01)
      const exitProg = entryProg + ((pit.exit - pit.entry + T) % T)
      knots = knots.filter((k) => k[0] < w.from || k[0] > w.to)
      knots.push([w.from, entryProg], [w.to, exitProg])
      knots = tidy(knots)
    }
    knotsBy.set(drv.num, knots)

    // On track while one of its laps is under way (an untimed lap runs until
    // the next one starts, capped); otherwise it is in the garage.
    const runs: [number, number][] = []
    for (let i = 0; i < laps.length; i++) {
      const l = laps[i]
      const next = laps[i + 1]
      const cap = l.t + T * 1600 // an untimed lap is at most a slow lap
      const end = l.d != null ? l.t + l.d * 1000 : next && next.lap === l.lap + 1 ? Math.min(next.t, cap) : cap
      const r = runs[runs.length - 1]
      if (r && l.t - r[1] <= GARAGE_GAP) r[1] = Math.max(r[1], end)
      else runs.push([l.t, end])
    }
    // A run that ends in the garage leaves the track at the pit entry.
    for (const w of pitsBy.get(drv.num) ?? []) {
      if (!w.toGarage) continue
      for (const r of runs) if (w.from >= r[0] && w.from <= r[1]) r[1] = w.from
    }
    runsBy.set(drv.num, runs)
  }

  // Overtakes (races): when X takes Y's place, pin X level with Y at that
  // moment so the dots swap where and when it happened.
  if (isRace) {
    const series = new Map<number, { p: number; t: number }[]>()
    for (const p of [...d.pos].sort((a, b) => a.t - b.t)) {
      const arr = series.get(p.num) ?? []
      arr.push(p)
      series.set(p.num, arr)
    }
    const posAt = (num: number, time: number) => {
      let p: number | null = null
      for (const e of series.get(num) ?? []) {
        if (e.t <= time) p = e.p
        else break
      }
      return p
    }
    const inPitAt = (num: number, time: number) =>
      (pitsBy.get(num) ?? []).some((w) => time >= w.from - 5000 && time <= w.to + 5000)
    for (const [num, list] of series) {
      for (let i = 1; i < list.length; i++) {
        const c = list[i]
        if (c.p >= list[i - 1].p) continue // only gains
        // The car that held this place a moment before.
        const other = d.drivers.find((o) => o.num !== num && posAt(o.num, c.t - 1) === c.p)?.num
        if (other == null || inPitAt(num, c.t) || inPitAt(other, c.t)) continue
        const kx = knotsBy.get(num)
        const ky = knotsBy.get(other)
        if (!kx || !ky) continue
        const py = progressAt(ky, c.t)
        const px = progressAt(kx, c.t)
        if (py == null || px == null || Math.abs(py - px) > T * 0.1) continue // not an on-track pass
        const target = py + 0.02
        const prev = kx.filter((k) => k[0] < c.t).pop()
        const next = kx.find((k) => k[0] > c.t)
        if (prev && next && target > prev[1] && target < next[1]) {
          kx.push([c.t, target])
          knotsBy.set(num, tidy(kx))
        }
      }
    }
  }

  // Grid slots before the start (races): a little behind the line, in order.
  const gridPos = new Map<number, number>()
  for (const p of [...d.pos].sort((a, b) => a.t - b.t)) if (!gridPos.has(p.num)) gridPos.set(p.num, p.p)

  function stateAt(time: number): CarState[] {
    const out: CarState[] = []
    for (const drv of d.drivers) {
      const knots = knotsBy.get(drv.num) ?? []
      const w = pit ? (pitsBy.get(drv.num) ?? []).find((x) => time >= x.from && time <= x.to) : null
      if (w && pit) {
        // Same path as the reference stop; a longer (or shorter) stop is
        // absorbed by waiting longer (or less) in the box.
        const extra = w.lane != null ? w.lane - pit.lane : 0
        let s = (time - w.from) / 1000
        if (w.toGarage) {
          // Drive in and stop at the box; after that the car is in the garage.
          const boxAt = pit.box ? pit.box[0] : pitDetourRef / 2
          if (s > boxAt) {
            const [x, y] = pointOnPit(track!, boxAt)
            out.push({ num: drv.num, x, y, inPit: false, inGarage: true })
            continue
          }
        } else if (pit.box && extra >= 0) {
          const b1 = pit.box[1]
          if (s > b1 + extra) s -= extra
          else if (s > b1) s = b1
        } else if (extra < 0) {
          s *= pitDetourRef / (pitDetourRef + extra)
        }
        const [x, y] = pointOnPit(track!, s)
        out.push({ num: drv.num, x, y, inPit: true, inGarage: false })
        continue
      }
      const runs = runsBy.get(drv.num) ?? []
      const onTrack = runs.some(([a, b]) => time >= a && time <= b)
      let prog = onTrack ? progressAt(knots, time) : null
      if (prog == null && isRace && knots.length && time < knots[0][0]) {
        prog = -0.1 * (gridPos.get(drv.num) ?? 20) // waiting on the grid
      }
      if (prog == null) {
        // Garage (practice, qualifying) or out of the race: park in the box.
        if (pit?.box) {
          const [x, y] = pointOnPit(track!, pit.box[0])
          out.push({ num: drv.num, x, y, inPit: false, inGarage: true })
        }
        continue
      }
      const [x, y] = pointOnLine(track!, prog)
      out.push({ num: drv.num, x, y, inPit: false, inGarage: false })
    }
    return out
  }

  return { track, linePath, pitPath, finish: track.line[0], stateAt }
}
