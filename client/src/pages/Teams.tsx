import { Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { TeamCard } from '../components/EntityCards'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { useSeasonRoute } from '../hooks/useSeasonRoute'
import { useSeo } from '../hooks/useSeo'
import { SAMPLE_CONSTRUCTOR_STANDINGS } from '../lib/sampleData'

export default function Teams() {
  const { slug } = useParams()
  const { season, canonicalPath, goToSeason, badSeason } = useSeasonRoute(
    '/teams',
    slug,
  )

  useSeo({
    title: `${season} F1 Teams & Constructors`,
    description: `Formula 1 constructors on the ${season} grid — points, wins and championship position, with full team histories.`,
    canonicalPath,
  })
  const { data, loading, error } = useAsync(
    () => api.constructorStandings(season),
    [season],
  )

  const teams = data?.standings ?? SAMPLE_CONSTRUCTOR_STANDINGS

  if (badSeason) return <Navigate to="/teams" replace />

  return (
    <section>
      <div className="page-head">
        <h1>{season} F1 Teams</h1>
        <SeasonSelect value={season} onChange={goToSeason} />
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
