import { useState } from 'react'
import { api } from '../api/client'
import {
  ConstructorStandingsTable,
  DriverStandingsTable,
} from '../components/StandingsTable'
import { useAsync } from '../hooks/useAsync'

const CURRENT_SEASON = 2026
const SEASONS = Array.from({ length: CURRENT_SEASON - 2015 }, (_, i) =>
  String(CURRENT_SEASON - i),
)

type Tab = 'drivers' | 'constructors'

export default function Standings() {
  const [season, setSeason] = useState(String(CURRENT_SEASON))
  const [tab, setTab] = useState<Tab>('drivers')

  const drivers = useAsync(() => api.driverStandings(season), [season])
  const constructors = useAsync(
    () => api.constructorStandings(season),
    [season],
  )

  const active = tab === 'drivers' ? drivers : constructors

  return (
    <section>
      <div className="page-head">
        <h1>Championship Standings</h1>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          aria-label="Season"
        >
          {SEASONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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
      {active.error && (
        <p className="error">Could not load standings: {active.error}</p>
      )}
      {!active.loading && !active.error && active.data && (
        tab === 'drivers' ? (
          <DriverStandingsTable rows={drivers.data?.standings ?? []} />
        ) : (
          <ConstructorStandingsTable rows={constructors.data?.standings ?? []} />
        )
      )}
    </section>
  )
}
