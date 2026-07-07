import { useState } from 'react'
import { api } from '../api/client'
import { DriverCard } from '../components/EntityCards'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { CURRENT_SEASON } from '../lib/seasons'
import { SAMPLE_DRIVER_STANDINGS } from '../lib/sampleData'

export default function Drivers() {
  const [season, setSeason] = useState(String(CURRENT_SEASON))
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

  return (
    <section>
      <div className="page-head">
        <h1>Drivers</h1>
        <SeasonSelect value={season} onChange={setSeason} />
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && error && (
        <p className="banner">
          Live API unavailable ({error}). Showing sample drivers — real {season}{' '}
          data appears automatically once the API is reachable.
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
    </section>
  )
}
