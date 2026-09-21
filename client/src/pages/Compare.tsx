import { useMemo, useState } from 'react'
import { api } from '../api/client'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'
import type { DriverProfile } from '../types/f1'

const DEFAULT_A = 'lewis-hamilton'
const DEFAULT_B = 'max-verstappen'

function lastConstructor(p: DriverProfile): string {
  return p.seasons.length ? p.seasons[p.seasons.length - 1].constructorId : ''
}

function bestFinish(p: DriverProfile): number {
  return p.seasons.reduce(
    (best, s) => (s.position > 0 ? Math.min(best, s.position) : best),
    Infinity,
  )
}

// One comparison row; highlights whichever side is better.
function Row({
  label,
  a,
  b,
  aWins,
  bWins,
}: {
  label: string
  a: string
  b: string
  aWins: boolean
  bWins: boolean
}) {
  return (
    <div className="cmp-row">
      <span className={aWins ? 'cmp-val win' : 'cmp-val'}>{a}</span>
      <span className="cmp-label">{label}</span>
      <span className={bWins ? 'cmp-val win' : 'cmp-val'}>{b}</span>
    </div>
  )
}

function Comparison({ a, b, h2h }: { a: DriverProfile; b: DriverProfile; h2h: { racesTogether: number; aheadA: number; aheadB: number; sharedSeasons: number[] } }) {
  const colorA = teamColor(lastConstructor(a))
  const colorB = teamColor(lastConstructor(b))
  const winPct = (p: DriverProfile) => (p.races ? (p.wins / p.races) * 100 : 0)
  const podPct = (p: DriverProfile) => (p.races ? (p.podiums / p.races) * 100 : 0)
  const bestA = bestFinish(a)
  const bestB = bestFinish(b)
  const totalH2H = h2h.aheadA + h2h.aheadB || 1

  const num = (n: number, d = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: d })

  return (
    <>
      <div className="cmp-heads">
        <div className="cmp-head" style={{ borderColor: colorA }}>
          <span className="stripe" style={{ background: colorA }} />
          <h2>{a.givenName} {a.familyName}</h2>
          <div className="cmp-sub">
            <Flag code={a.countryCode} nationality={a.nationality} />
            {a.firstSeason}–{a.lastSeason}
          </div>
        </div>
        <div className="cmp-vs">VS</div>
        <div className="cmp-head" style={{ borderColor: colorB }}>
          <span className="stripe" style={{ background: colorB }} />
          <h2>{b.givenName} {b.familyName}</h2>
          <div className="cmp-sub">
            <Flag code={b.countryCode} nationality={b.nationality} />
            {b.firstSeason}–{b.lastSeason}
          </div>
        </div>
      </div>

      <div className="card cmp-table">
        <Row label="Championships" a={num(a.championships)} b={num(b.championships)} aWins={a.championships > b.championships} bWins={b.championships > a.championships} />
        <Row label="Wins" a={num(a.wins)} b={num(b.wins)} aWins={a.wins > b.wins} bWins={b.wins > a.wins} />
        <Row label="Podiums" a={num(a.podiums)} b={num(b.podiums)} aWins={a.podiums > b.podiums} bWins={b.podiums > a.podiums} />
        <Row label="Points" a={num(a.points, 1)} b={num(b.points, 1)} aWins={a.points > b.points} bWins={b.points > a.points} />
        <Row label="Races" a={num(a.races)} b={num(b.races)} aWins={a.races > b.races} bWins={b.races > a.races} />
        <Row label="Win rate" a={`${num(winPct(a), 1)}%`} b={`${num(winPct(b), 1)}%`} aWins={winPct(a) > winPct(b)} bWins={winPct(b) > winPct(a)} />
        <Row label="Podium rate" a={`${num(podPct(a), 1)}%`} b={`${num(podPct(b), 1)}%`} aWins={podPct(a) > podPct(b)} bWins={podPct(b) > podPct(a)} />
        <Row
          label="Best season"
          a={bestA === Infinity ? '—' : `P${bestA}`}
          b={bestB === Infinity ? '—' : `P${bestB}`}
          aWins={bestA < bestB}
          bWins={bestB < bestA}
        />
      </div>

      {h2h.racesTogether > 0 && (
        <div className="card cmp-h2h">
          <div className="cmp-h2h-head">
            <h3>Head-to-head</h3>
            <span className="muted">
              {h2h.racesTogether} races together · {h2h.sharedSeasons[0]}–
              {h2h.sharedSeasons[h2h.sharedSeasons.length - 1]}
            </span>
          </div>
          <div className="cmp-h2h-tally">
            <span className={h2h.aheadA >= h2h.aheadB ? 'win' : ''}>{h2h.aheadA}</span>
            <span className="muted">finished ahead</span>
            <span className={h2h.aheadB >= h2h.aheadA ? 'win' : ''}>{h2h.aheadB}</span>
          </div>
          <div className="cmp-h2h-bar">
            <span style={{ width: `${(h2h.aheadA / totalH2H) * 100}%`, background: colorA }} />
            <span style={{ width: `${(h2h.aheadB / totalH2H) * 100}%`, background: colorB }} />
          </div>
        </div>
      )}
    </>
  )
}

export default function Compare() {
  const drivers = useAsync(() => api.drivers(), [])
  const [idA, setIdA] = useState(DEFAULT_A)
  const [idB, setIdB] = useState(DEFAULT_B)

  const cmp = useAsync(
    () => api.compareDrivers(idA, idB),
    [idA, idB],
  )

  // name → id for the datalist inputs
  const byName = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of drivers.data ?? []) m.set(d.name.toLowerCase(), d.driverId)
    return m
  }, [drivers.data])

  const nameOf = (id: string) =>
    drivers.data?.find((d) => d.driverId === id)?.name ?? id

  const pick = (setId: (id: string) => void) => (value: string) => {
    const id = byName.get(value.toLowerCase())
    if (id) setId(id)
  }

  return (
    <section>
      <div className="page-head">
        <h1>Head to Head</h1>
      </div>

      <div className="cmp-pickers">
        <input
          className="cmp-input"
          list="driver-list"
          defaultValue={nameOf(idA)}
          key={`a-${nameOf(idA)}`}
          placeholder="Driver A"
          onChange={(e) => pick(setIdA)(e.target.value)}
        />
        <input
          className="cmp-input"
          list="driver-list"
          defaultValue={nameOf(idB)}
          key={`b-${nameOf(idB)}`}
          placeholder="Driver B"
          onChange={(e) => pick(setIdB)(e.target.value)}
        />
        <datalist id="driver-list">
          {(drivers.data ?? []).map((d) => (
            <option key={d.driverId} value={d.name} />
          ))}
        </datalist>
      </div>

      {cmp.loading && <p className="muted">Loading…</p>}
      {!cmp.loading && cmp.error && (
        <p className="banner">Could not load comparison: {cmp.error}</p>
      )}
      {!cmp.loading && cmp.data && (
        <Comparison a={cmp.data.a} b={cmp.data.b} h2h={cmp.data.headToHead} />
      )}
    </section>
  )
}
