import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { teamColor } from '../lib/f1meta'
import type { DriverProfile, SeasonComparison as SeasonCmp } from '../types/f1'

type View = 'career' | 'season'

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

function Comparison({ a, b, h2h, photoA, photoB }: { a: DriverProfile; b: DriverProfile; h2h: { racesTogether: number; aheadA: number; aheadB: number; sharedSeasons: number[] }; photoA?: string; photoB?: string }) {
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
          {photoA && <img className="cmp-photo" src={photoA} alt="" loading="lazy" />}
          <h2>{a.givenName} {a.familyName}</h2>
          <div className="cmp-sub">
            <Flag code={a.countryCode} nationality={a.nationality} />
            {a.firstSeason}–{a.lastSeason}
          </div>
        </div>
        <div className="cmp-vs">VS</div>
        <div className="cmp-head" style={{ borderColor: colorB }}>
          <span className="stripe" style={{ background: colorB }} />
          {photoB && <img className="cmp-photo" src={photoB} alt="" loading="lazy" />}
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

// Side-by-side stats for one season, plus that season's head-to-head.
function SeasonComparison({ data, photoA, photoB }: { data: SeasonCmp; photoA?: string; photoB?: string }) {
  const { a, b } = data
  const colorA = teamColor(a.constructorId)
  const colorB = teamColor(b.constructorId)
  const totalH2H = data.headToHead.aheadA + data.headToHead.aheadB || 1
  const num = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 })
  const pos = (n: number | null) => (n == null ? '—' : `P${n}`)
  const sub = (s: typeof a) =>
    s.raced ? s.constructorName || '—' : 'Did not race this season'

  return (
    <>
      <div className="cmp-heads">
        <div className="cmp-head" style={{ borderColor: colorA }}>
          <span className="stripe" style={{ background: colorA }} />
          {photoA && <img className="cmp-photo" src={photoA} alt="" loading="lazy" />}
          <h2>{a.givenName} {a.familyName}</h2>
          <div className="cmp-sub">
            <Flag code={a.countryCode} nationality={a.nationality} />
            {sub(a)}
          </div>
        </div>
        <div className="cmp-vs">{data.season}</div>
        <div className="cmp-head" style={{ borderColor: colorB }}>
          <span className="stripe" style={{ background: colorB }} />
          {photoB && <img className="cmp-photo" src={photoB} alt="" loading="lazy" />}
          <h2>{b.givenName} {b.familyName}</h2>
          <div className="cmp-sub">
            <Flag code={b.countryCode} nationality={b.nationality} />
            {sub(b)}
          </div>
        </div>
      </div>

      <div className="card cmp-table">
        <Row label="Championship" a={pos(a.championshipPosition)} b={pos(b.championshipPosition)} aWins={(a.championshipPosition ?? Infinity) < (b.championshipPosition ?? Infinity)} bWins={(b.championshipPosition ?? Infinity) < (a.championshipPosition ?? Infinity)} />
        <Row label="Points" a={a.raced ? num(a.points) : '—'} b={b.raced ? num(b.points) : '—'} aWins={a.points > b.points} bWins={b.points > a.points} />
        <Row label="Wins" a={a.raced ? num(a.wins) : '—'} b={b.raced ? num(b.wins) : '—'} aWins={a.wins > b.wins} bWins={b.wins > a.wins} />
        <Row label="Podiums" a={a.raced ? num(a.podiums) : '—'} b={b.raced ? num(b.podiums) : '—'} aWins={a.podiums > b.podiums} bWins={b.podiums > a.podiums} />
        <Row label="Poles" a={a.raced ? num(a.poles) : '—'} b={b.raced ? num(b.poles) : '—'} aWins={a.poles > b.poles} bWins={b.poles > a.poles} />
        <Row label="Fastest laps" a={a.raced ? num(a.fastestLaps) : '—'} b={b.raced ? num(b.fastestLaps) : '—'} aWins={a.fastestLaps > b.fastestLaps} bWins={b.fastestLaps > a.fastestLaps} />
        <Row label="Best finish" a={pos(a.bestFinish)} b={pos(b.bestFinish)} aWins={(a.bestFinish ?? Infinity) < (b.bestFinish ?? Infinity)} bWins={(b.bestFinish ?? Infinity) < (a.bestFinish ?? Infinity)} />
        <Row label="Races" a={a.raced ? num(a.races) : '—'} b={b.raced ? num(b.races) : '—'} aWins={false} bWins={false} />
      </div>

      {data.headToHead.racesTogether > 0 ? (
        <div className="card cmp-h2h">
          <div className="cmp-h2h-head">
            <h3>Head-to-head · {data.season}</h3>
            <span className="muted">{data.headToHead.racesTogether} races together</span>
          </div>
          <div className="cmp-h2h-tally">
            <span className={data.headToHead.aheadA >= data.headToHead.aheadB ? 'win' : ''}>{data.headToHead.aheadA}</span>
            <span className="muted">finished ahead</span>
            <span className={data.headToHead.aheadB >= data.headToHead.aheadA ? 'win' : ''}>{data.headToHead.aheadB}</span>
          </div>
          <div className="cmp-h2h-bar">
            <span style={{ width: `${(data.headToHead.aheadA / totalH2H) * 100}%`, background: colorA }} />
            <span style={{ width: `${(data.headToHead.aheadB / totalH2H) * 100}%`, background: colorB }} />
          </div>
        </div>
      ) : (
        <p className="muted">These drivers didn't race together in {data.season}.</p>
      )}
    </>
  )
}

export default function Compare() {
  useSeo({
    title: 'F1 Driver Comparison — Head to Head',
    description:
      'Compare any two Formula 1 drivers head-to-head: championships, wins, podiums, points and their race-by-race record — overall or in a single season.',
  })
  const drivers = useAsync(() => api.drivers(), [])
  // Wikimedia driver photos (shared map, cached server-side). Optional — a
  // driver with no photo simply shows none.
  const photos = useAsync(() => api.driverPhotos(), [])
  const [idA, setIdA] = useState(DEFAULT_A)
  const [idB, setIdB] = useState(DEFAULT_B)
  const [view, setView] = useState<View>('career')
  const [season, setSeason] = useState<number | null>(null)

  const cmp = useAsync(
    () => api.compareDrivers(idA, idB),
    [idA, idB],
  )

  // Seasons offered in the Season tab: those either driver contested, newest
  // first. Default to the most recent season they shared (else the newest).
  const seasonOptions = useMemo(() => {
    const set = new Set<number>()
    for (const s of cmp.data?.a.seasons ?? []) set.add(s.season)
    for (const s of cmp.data?.b.seasons ?? []) set.add(s.season)
    return [...set].sort((x, y) => y - x)
  }, [cmp.data])

  useEffect(() => {
    if (!cmp.data) return
    const aYears = new Set((cmp.data.a.seasons ?? []).map((s) => s.season))
    const shared = (cmp.data.b.seasons ?? [])
      .map((s) => s.season)
      .filter((y) => aYears.has(y))
      .sort((x, y) => y - x)
    setSeason(shared[0] ?? seasonOptions[0] ?? null)
  }, [cmp.data, seasonOptions])

  const seasonCmp = useAsync(
    () =>
      view === 'season' && season != null
        ? api.compareDriversSeason(idA, idB, season)
        : Promise.resolve(null),
    [view, idA, idB, season],
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

      <div className="tabs">
        <button
          className={view === 'career' ? 'tab active' : 'tab'}
          onClick={() => setView('career')}
        >
          Career
        </button>
        <button
          className={view === 'season' ? 'tab active' : 'tab'}
          onClick={() => setView('season')}
        >
          Season
        </button>
        {view === 'season' && seasonOptions.length > 0 && (
          <select
            className="cmp-season"
            value={season ?? ''}
            onChange={(e) => setSeason(Number(e.target.value))}
            aria-label="Season"
          >
            {seasonOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === 'career' ? (
        <>
          {cmp.loading && <p className="muted">Loading…</p>}
          {!cmp.loading && cmp.error && (
            <p className="banner">Could not load comparison: {cmp.error}</p>
          )}
          {!cmp.loading && cmp.data && (
            <Comparison
              a={cmp.data.a}
              b={cmp.data.b}
              h2h={cmp.data.headToHead}
              photoA={photos.data?.[idA]}
              photoB={photos.data?.[idB]}
            />
          )}
        </>
      ) : (
        <>
          {seasonCmp.loading && <p className="muted">Loading…</p>}
          {!seasonCmp.loading && seasonCmp.error && (
            <p className="banner">Could not load comparison: {seasonCmp.error}</p>
          )}
          {!seasonCmp.loading && seasonCmp.data && (
            <SeasonComparison
              data={seasonCmp.data}
              photoA={photos.data?.[idA]}
              photoB={photos.data?.[idB]}
            />
          )}
        </>
      )}
    </section>
  )
}
