import { useState } from 'react'
import { api } from '../api/client'
import { TeamCard } from '../components/EntityCards'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { CURRENT_SEASON } from '../lib/seasons'
import { SAMPLE_CONSTRUCTOR_STANDINGS } from '../lib/sampleData'

export default function Teams() {
  const [season, setSeason] = useState(String(CURRENT_SEASON))
  const { data, loading, error } = useAsync(
    () => api.constructorStandings(season),
    [season],
  )

  const teams = data?.standings ?? SAMPLE_CONSTRUCTOR_STANDINGS

  return (
    <section>
      <div className="page-head">
        <h1>Teams</h1>
        <SeasonSelect value={season} onChange={setSeason} />
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && error && (
        <p className="banner">
          Live API unavailable ({error}). Showing sample teams — real {season}{' '}
          data appears automatically once the API is reachable.
        </p>
      )}

      {!loading && (
        <div className="grid">
          {teams.map((c) => (
            <TeamCard key={c.constructorId} c={c} season={season} />
          ))}
        </div>
      )}
    </section>
  )
}
