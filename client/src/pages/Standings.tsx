import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import SeasonSelect from '../components/SeasonSelect'
import {
  ConstructorStandingsTable,
  DriverStandingsTable,
} from '../components/StandingsTable'
import TitleRaceChart from '../components/TitleRaceChart'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { CURRENT_SEASON } from '../lib/seasons'
import { seasonSummary } from '../lib/summaries'
import {
  SAMPLE_CONSTRUCTOR_STANDINGS,
  SAMPLE_DRIVER_STANDINGS,
} from '../lib/sampleData'

type Tab = 'drivers' | 'constructors' | 'progression'

// A valid F1 season is a four-digit year from the first championship to now.
function isValidSeason(s: string | undefined): s is string {
  if (!s || !/^\d{4}$/.test(s)) return false
  const n = Number(s)
  return n >= 1950 && n <= CURRENT_SEASON
}

export default function Standings() {
  const { season: seasonParam } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('drivers')

  // Season comes from the URL (/standings/:season); bare /standings is the
  // current season. A malformed season in the path redirects to /standings
  // rather than rendering a junk page Google might index.
  const badSeason = seasonParam !== undefined && !isValidSeason(seasonParam)
  const season = isValidSeason(seasonParam) ? seasonParam : String(CURRENT_SEASON)

  // /standings and /standings/<currentSeason> show the same thing, so both
  // declare /standings as canonical to avoid duplicate-content splitting.
  const canonicalPath =
    season === String(CURRENT_SEASON) ? '/standings' : `/standings/${season}`

  function goToSeason(s: string) {
    navigate(s === String(CURRENT_SEASON) ? '/standings' : `/standings/${s}`)
  }

  useSeo({
    title: `${season} F1 Championship Standings`,
    description: `Formula 1 drivers' and constructors' championship standings for the ${season} season — points, wins and gaps to the leader.`,
    canonicalPath,
  })

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

  if (badSeason) return <Navigate to="/standings" replace />

  const intro = seasonSummary(
    season,
    drivers.data?.standings?.[0],
    constructors.data?.standings?.[0],
  )

  return (
    <section>
      <div className="page-head">
        <h1>{season} Championship Standings</h1>
        <SeasonSelect value={season} onChange={goToSeason} />
      </div>

      {intro && <p className="profile-summary">{intro}</p>}

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
