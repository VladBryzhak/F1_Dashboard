import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import DriverThumb from '../components/DriverThumb'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import type { DriverProfile, SeasonComparison as SeasonCmp } from '../types/f1'
import { useI18n } from '../i18n/core'
import './Compare.css'

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

// One driver's header: thumbnail, name, flag and team swatch with a line of
// context (career span or that season's team). Side b mirrors side a.
function Head({
  side,
  givenName,
  familyName,
  countryCode,
  nationality,
  color,
  urls,
  sub,
}: {
  side: 'a' | 'b'
  givenName: string
  familyName: string
  countryCode: string | null
  nationality: string
  color: string
  urls: (string | null | undefined)[]
  sub: string
}) {
  return (
    <div className={`cmp-head cmp-head--${side}`}>
      <DriverThumb urls={urls} code={familyName.slice(0, 3).toUpperCase()} />
      <div className="cmp-id">
        <h2>
          <span className="cmp-given">{givenName}</span>
          {familyName}
        </h2>
        <div className="cmp-sub">
          <Flag code={countryCode} nationality={nationality} />
          <span className="cmp-swatch" style={{ background: color }} />
          <span>{sub}</span>
        </div>
      </div>
    </div>
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
  const { t, tn, fmtNum } = useI18n()

  const num = (n: number, d = 0) => fmtNum(n, { maximumFractionDigits: d })

  return (
    <>
      <div className="cmp-heads">
        <Head
          side="a"
          givenName={a.givenName}
          familyName={a.familyName}
          countryCode={a.countryCode}
          nationality={a.nationality}
          color={colorA}
          urls={[driverPortraitUrl(a.driverId, lastConstructor(a), String(a.lastSeason)), photoA]}
          sub={`${a.firstSeason}-${a.lastSeason}`}
        />
        <div className="cmp-vs">VS</div>
        <Head
          side="b"
          givenName={b.givenName}
          familyName={b.familyName}
          countryCode={b.countryCode}
          nationality={b.nationality}
          color={colorB}
          urls={[driverPortraitUrl(b.driverId, lastConstructor(b), String(b.lastSeason)), photoB]}
          sub={`${b.firstSeason}-${b.lastSeason}`}
        />
      </div>

      <div className="card cmp-table">
        <Row label={t('drv.titles')} a={num(a.championships)} b={num(b.championships)} aWins={a.championships > b.championships} bWins={b.championships > a.championships} />
        <Row label={t('drv.wins')} a={num(a.wins)} b={num(b.wins)} aWins={a.wins > b.wins} bWins={b.wins > a.wins} />
        <Row label={t('drv.podiums')} a={num(a.podiums)} b={num(b.podiums)} aWins={a.podiums > b.podiums} bWins={b.podiums > a.podiums} />
        <Row label={t('drv.points')} a={num(a.points, 1)} b={num(b.points, 1)} aWins={a.points > b.points} bWins={b.points > a.points} />
        <Row label={t('drv.races')} a={num(a.races)} b={num(b.races)} aWins={a.races > b.races} bWins={b.races > a.races} />
        <Row label={t('cmp.winRate')} a={`${num(winPct(a), 1)}%`} b={`${num(winPct(b), 1)}%`} aWins={winPct(a) > winPct(b)} bWins={winPct(b) > winPct(a)} />
        <Row label={t('cmp.podiumRate')} a={`${num(podPct(a), 1)}%`} b={`${num(podPct(b), 1)}%`} aWins={podPct(a) > podPct(b)} bWins={podPct(b) > podPct(a)} />
        <Row
          label={t('cmp.bestSeason')}
          a={bestA === Infinity ? '' : `P${bestA}`}
          b={bestB === Infinity ? '' : `P${bestB}`}
          aWins={bestA < bestB}
          bWins={bestB < bestA}
        />
      </div>

      {h2h.racesTogether > 0 && (
        <div className="card cmp-h2h">
          <div className="cmp-h2h-head">
            <h3 className="wknd-section">{t('cmp.h2h')}</h3>
            <span className="muted cmp-h2h-meta">
              <span>{tn('plural.togetherN', h2h.racesTogether)}</span>
              <span className="mono">
                {h2h.sharedSeasons[0]}-{h2h.sharedSeasons[h2h.sharedSeasons.length - 1]}
              </span>
            </span>
          </div>
          <div className="cmp-h2h-tally">
            <span className={h2h.aheadA >= h2h.aheadB ? 'win' : ''}>{h2h.aheadA}</span>
            <span className="muted">{t('cmp.finishedAhead')}</span>
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
  const { t, tn, fmtNum } = useI18n()
  const num = (n: number) => fmtNum(n, { maximumFractionDigits: 1 })
  const pos = (n: number | null) => (n == null ? '' : `P${n}`)
  const sub = (s: typeof a) => (s.raced ? s.constructorName : t('cmp.didNotRace'))
  const thumb = (s: typeof a, photo?: string) => [
    driverPortraitUrl(s.driverId, s.constructorId, String(data.season)),
    photo,
  ]

  return (
    <>
      <div className="cmp-heads">
        <Head
          side="a"
          givenName={a.givenName}
          familyName={a.familyName}
          countryCode={a.countryCode}
          nationality={a.nationality}
          color={colorA}
          urls={thumb(a, photoA)}
          sub={sub(a)}
        />
        <div className="cmp-vs mono">{data.season}</div>
        <Head
          side="b"
          givenName={b.givenName}
          familyName={b.familyName}
          countryCode={b.countryCode}
          nationality={b.nationality}
          color={colorB}
          urls={thumb(b, photoB)}
          sub={sub(b)}
        />
      </div>

      <div className="card cmp-table">
        <Row label={t('cmp.championship')} a={pos(a.championshipPosition)} b={pos(b.championshipPosition)} aWins={(a.championshipPosition ?? Infinity) < (b.championshipPosition ?? Infinity)} bWins={(b.championshipPosition ?? Infinity) < (a.championshipPosition ?? Infinity)} />
        <Row label={t('drv.points')} a={a.raced ? num(a.points) : ''} b={b.raced ? num(b.points) : ''} aWins={a.points > b.points} bWins={b.points > a.points} />
        <Row label={t('drv.wins')} a={a.raced ? num(a.wins) : ''} b={b.raced ? num(b.wins) : ''} aWins={a.wins > b.wins} bWins={b.wins > a.wins} />
        <Row label={t('drv.podiums')} a={a.raced ? num(a.podiums) : ''} b={b.raced ? num(b.podiums) : ''} aWins={a.podiums > b.podiums} bWins={b.podiums > a.podiums} />
        <Row label={t('drv.poles')} a={a.raced ? num(a.poles) : ''} b={b.raced ? num(b.poles) : ''} aWins={a.poles > b.poles} bWins={b.poles > a.poles} />
        <Row label={t('drv.fastestLaps')} a={a.raced ? num(a.fastestLaps) : ''} b={b.raced ? num(b.fastestLaps) : ''} aWins={a.fastestLaps > b.fastestLaps} bWins={b.fastestLaps > a.fastestLaps} />
        <Row label={t('drv.bestFinish')} a={pos(a.bestFinish)} b={pos(b.bestFinish)} aWins={(a.bestFinish ?? Infinity) < (b.bestFinish ?? Infinity)} bWins={(b.bestFinish ?? Infinity) < (a.bestFinish ?? Infinity)} />
        <Row label={t('drv.races')} a={a.raced ? num(a.races) : ''} b={b.raced ? num(b.races) : ''} aWins={false} bWins={false} />
      </div>

      {data.headToHead.racesTogether > 0 ? (
        <div className="card cmp-h2h">
          <div className="cmp-h2h-head">
            <h3 className="wknd-section">
              {t('cmp.h2h')} <span className="mono">{data.season}</span>
            </h3>
            <span className="muted">{tn('plural.togetherN', data.headToHead.racesTogether)}</span>
          </div>
          <div className="cmp-h2h-tally">
            <span className={data.headToHead.aheadA >= data.headToHead.aheadB ? 'win' : ''}>{data.headToHead.aheadA}</span>
            <span className="muted">{t('cmp.finishedAhead')}</span>
            <span className={data.headToHead.aheadB >= data.headToHead.aheadA ? 'win' : ''}>{data.headToHead.aheadB}</span>
          </div>
          <div className="cmp-h2h-bar">
            <span style={{ width: `${(data.headToHead.aheadA / totalH2H) * 100}%`, background: colorA }} />
            <span style={{ width: `${(data.headToHead.aheadB / totalH2H) * 100}%`, background: colorB }} />
          </div>
        </div>
      ) : (
        <p className="muted">{t('cmp.notTogether', { season: data.season })}</p>
      )}
    </>
  )
}

export default function Compare() {
  useSeo({
    title: 'F1 Driver Comparison: Head to Head',
    description:
      'Compare any two Formula 1 drivers head-to-head: championships, wins, podiums, points and their race-by-race record, over a career or a single season.',
  })
  const drivers = useAsync(() => api.drivers(), [])
  // Wikimedia driver photos (shared map, cached server-side). Optional: a
  // driver with no photo simply shows none.
  const photos = useAsync(() => api.driverPhotos(), [])
  const [idA, setIdA] = useState(DEFAULT_A)
  const [idB, setIdB] = useState(DEFAULT_B)
  const [view, setView] = useState<View>('career')
  const [season, setSeason] = useState<number | null>(null)
  const { t } = useI18n()

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
        <h1>{t('cmp.title')}</h1>
      </div>

      <div className="cmp-pickers">
        <input
          className="cmp-input"
          list="driver-list"
          defaultValue={nameOf(idA)}
          key={`a-${nameOf(idA)}`}
          placeholder={t('cmp.driverA')}
          onChange={(e) => pick(setIdA)(e.target.value)}
        />
        <input
          className="cmp-input"
          list="driver-list"
          defaultValue={nameOf(idB)}
          key={`b-${nameOf(idB)}`}
          placeholder={t('cmp.driverB')}
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
          {t('cmp.tabCareer')}
        </button>
        <button
          className={view === 'season' ? 'tab active' : 'tab'}
          onClick={() => setView('season')}
        >
          {t('common.season')}
        </button>
        {view === 'season' && seasonOptions.length > 0 && (
          <select
            className="cmp-season"
            value={season ?? ''}
            onChange={(e) => setSeason(Number(e.target.value))}
            aria-label={t('common.season')}
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
          {cmp.loading && <p className="muted">{t('common.loading')}</p>}
          {!cmp.loading && cmp.error && (
            <p className="banner">{t('cmp.loadError', { error: cmp.error })}</p>
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
          {seasonCmp.loading && <p className="muted">{t('common.loading')}</p>}
          {!seasonCmp.loading && seasonCmp.error && (
            <p className="banner">{t('cmp.loadError', { error: seasonCmp.error })}</p>
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
