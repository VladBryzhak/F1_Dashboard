import { useState } from 'react'
import { api } from '../api/client'
import SeasonSelect from '../components/SeasonSelect'
import {
  ConstructorStandingsTable,
  DriverStandingsTable,
} from '../components/StandingsTable'
import { useAsync } from '../hooks/useAsync'
import { CURRENT_SEASON } from '../lib/seasons'
import {
  SAMPLE_CONSTRUCTOR_STANDINGS,
  SAMPLE_DRIVER_STANDINGS,
} from '../lib/sampleData'

type Tab = 'drivers' | 'constructors'

export default function Standings() {
  const [season, setSeason] = useState(String(CURRENT_SEASON))
  const [tab, setTab] = useState<Tab>('drivers')

  const drivers = useAsync(() => api.driverStandings(season), [season])
  const constructors = useAsync(
    () => api.constructorStandings(season),
    [season],
  )
  const headshots = useAsync<Record<string, string>>(
    () => api.driverHeadshots(season).catch(() => ({})),
    [season],
  )

  const active = tab === 'drivers' ? drivers : constructors

  return (
    <section>
      <div className="page-head">
        <h1>Championship Standings</h1>
        <SeasonSelect value={season} onChange={setSeason} />
      </div>

      <div className="tabs">
        <button
          className={tab === 'drivers' ? 'tab active' : 'tab'}
          onClick={() => setTab('drivers')}
        >
          Drivers
        </button>
        <button
          className={tab === 'constructors' ? 'tab active' : 'tab'}
          onClick={() => setTab('constructors')}
        >
          Constructors
        </button>
      </div>

      {active.loading && <p className="muted">Loading…</p>}

      {!active.loading && active.error && (
        <p className="banner">
          Live standings API unavailable ({active.error}). Showing sample data so
          the layout is visible — real {season} standings appear automatically
          once the API is reachable.
        </p>
      )}

      {!active.loading &&
        (tab === 'drivers' ? (
          <DriverStandingsTable
            rows={drivers.data?.standings ?? SAMPLE_DRIVER_STANDINGS}
            season={season}
            headshots={headshots.data ?? undefined}
          />
        ) : (
          <ConstructorStandingsTable
            rows={constructors.data?.standings ?? SAMPLE_CONSTRUCTOR_STANDINGS}
          />
        ))}
    </section>
  )
}
