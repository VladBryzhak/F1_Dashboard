import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import DriverSearch from '../components/DriverSearch'
import { DriverCard } from '../components/EntityCards'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { useSeasonRoute } from '../hooks/useSeasonRoute'
import { useSeo } from '../hooks/useSeo'
import { SAMPLE_DRIVER_STANDINGS } from '../lib/sampleData'

type View = 'grid' | 'search'

export default function Drivers() {
  const { slug } = useParams()
  const { season, canonicalPath, goToSeason, badSeason } = useSeasonRoute(
    '/drivers',
    slug,
  )
  const [view, setView] = useState<View>('grid')

  useSeo({
    title: `${season} F1 Drivers`,
    description: `Every Formula 1 driver on the ${season} grid, plus a searchable index of every driver since 1950 — with links to full career profiles.`,
    canonicalPath,
  })
  const { data, loading, error } = useAsync(
    () => api.driverStandings(season),
    [season],
  )
  // Official headshots (OpenF1, 2023+). Optional — failures are non-fatal.
  const headshots = useAsync<Record<string, string>>(
    () => api.driverHeadshots(season).catch(() => ({})),
    [season],
  )

  const drivers = data?.standings ?? SAMPLE_DRIVER_STANDINGS

  if (badSeason) return <Navigate to="/drivers" replace />

  return (
    <section>
      <div className="page-head">
        <h1>{view === 'search' ? 'Find a Driver' : `${season} F1 Drivers`}</h1>
        {view === 'grid' && <SeasonSelect value={season} onChange={goToSeason} />}
      </div>

      <div className="tabs">
        <button
          className={view === 'grid' ? 'tab active' : 'tab'}
          onClick={() => setView('grid')}
        >
          Current grid
        </button>
        <button
          className={view === 'search' ? 'tab active' : 'tab'}
          onClick={() => setView('search')}
        >
          Search drivers
        </button>
      </div>

      {view === 'search' ? (
        <DriverSearch />
      ) : (
        <>
          {loading && <p className="muted">Loading…</p>}

          {!loading && error && (
            <p className="banner">
              Live API unavailable ({error}). Showing sample drivers — real{' '}
              {season} data appears automatically once the API is reachable.
            </p>
          )}

          {!loading && (
            <div className="grid">
              {drivers.map((d) => (
                <DriverCard
                  key={d.driverId}
                  d={d}
                  season={season}
                  headshot={d.code ? headshots.data?.[d.code] : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
