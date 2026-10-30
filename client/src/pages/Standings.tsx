import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import SeasonSelect from '../components/SeasonSelect'
import {
  ConstructorStandingsTable,
  DriverStandingsTable,
} from '../components/StandingsTable'
import TitleRaceChart from '../components/TitleRaceChart'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { seasonPath, useSeasonRoute } from '../hooks/useSeasonRoute'
import { useI18n } from '../i18n/core'
import { seasonSummary } from '../lib/summaries'
import {
  SAMPLE_CONSTRUCTOR_STANDINGS,
  SAMPLE_DRIVER_STANDINGS,
} from '../lib/sampleData'
import { seoText } from '../lib/seoText'

type Tab = 'drivers' | 'constructors' | 'progression'

export default function Standings() {
  const { season: seasonParam } = useParams()
  const { season, canonicalPath, goToSeason, redirect } = useSeasonRoute(
    '/standings',
    seasonParam,
  )
  const [tab, setTab] = useState<Tab>('drivers')
  const { t, lang } = useI18n()

  useSeo({
    ...seoText.standings(season, lang),
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

  if (redirect) return <Navigate to="/standings" replace />

  // A season whose calendar is out but no race run yet (between seasons):
  // no standings to show, so point to last season's final ones.
  const notStarted =
    !drivers.loading && !drivers.error && drivers.data != null && drivers.data.standings.length === 0
  const previous = String(Number(season) - 1)

  const intro = seasonSummary(
    season,
    drivers.data?.standings?.[0],
    constructors.data?.standings?.[0],
    lang,
  )

  return (
    <section>
      <div className="page-head">
        <h1>{t('st.title', { season })}</h1>
        <SeasonSelect value={season} onChange={goToSeason} />
      </div>

      {intro && <p className="profile-summary">{intro}</p>}

      <div className="tabs">
        <button
          className={tab === 'drivers' ? 'tab active' : 'tab'}
          onClick={() => setTab('drivers')}
        >
          {t('st.tabDrivers')}
        </button>
        <button
          className={tab === 'constructors' ? 'tab active' : 'tab'}
          onClick={() => setTab('constructors')}
        >
          {t('st.tabConstructors')}
        </button>
        <button
          className={tab === 'progression' ? 'tab active' : 'tab'}
          onClick={() => setTab('progression')}
        >
          {t('st.tabTitleRace')}
        </button>
      </div>

      {active.loading && <p className="muted">{t('common.loading')}</p>}

      {!active.loading && active.error && (
        <p className="banner">{t('st.sampleBanner', { error: active.error, season })}</p>
      )}

      {notStarted && tab !== 'progression' && (
        <p className="profile-summary">
          {t('st.notStarted', { season })}{' '}
          <Link to={seasonPath('/standings', previous)}>{t('st.previousFinal', { season: previous })}</Link>
        </p>
      )}

      {!active.loading && !notStarted && tab === 'drivers' && (
        <DriverStandingsTable
          rows={drivers.data?.standings ?? SAMPLE_DRIVER_STANDINGS}
          season={season}
          headshots={headshots.data ?? undefined}
        />
      )}
      {!active.loading && !notStarted && tab === 'constructors' && (
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
