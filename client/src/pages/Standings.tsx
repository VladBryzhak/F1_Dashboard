import { useState } from 'react'
import { api } from '../api/client'
import SeasonSelect from '../components/SeasonSelect'
import {
  ConstructorStandingsTable,
  DriverStandingsTable,
} from '../components/StandingsTable'
import TitleRaceChart from '../components/TitleRaceChart'
import { useAsync } from '../hooks/useAsync'
import { CURRENT_SEASON } from '../lib/seasons'
import {
  SAMPLE_CONSTRUCTOR_STANDINGS,
  SAMPLE_DRIVER_STANDINGS,
} from '../lib/sampleData'

type Tab = 'drivers' | 'constructors' | 'progression'

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
  const progression = useAsync(() => api.seasonProgression(season), [season])

  const active =
    tab === 'drivers'
      ? drivers
      : tab === 'constructors'
        ? constructors
        : progression

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
        <button
          className={tab === 'progression' ? 'tab active' : 'tab'}
          onClick={() => setTab('progression')}
        >
          Title Race
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

      {!active.loading && tab === 'drivers' && (
        <DriverStandingsTable
          rows={drivers.data?.standings ?? SAMPLE_DRIVER_STANDINGS}
          season={season}
          headshots={headshots.data ?? undefined}
        />
      )}
      {!active.loading && tab === 'constructors' && (
        <ConstructorStandingsTable
          rows={constructors.data?.standings ?? SAMPLE_CONSTRUCTOR_STANDINGS}
        />
      )}
      {!active.loading && tab === 'progression' && progression.data && (
        <TitleRaceChart data={progression.data} />
      )}
    </section>
  )
}
