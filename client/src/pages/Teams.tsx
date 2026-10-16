import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { TeamCard } from '../components/EntityCards'
import TeamSearch from '../components/TeamSearch'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { useSeasonRoute } from '../hooks/useSeasonRoute'
import { useSeo } from '../hooks/useSeo'
import { SAMPLE_CONSTRUCTOR_STANDINGS } from '../lib/sampleData'
import { useI18n } from '../i18n/core'

type View = 'grid' | 'search'

export default function Teams() {
  const { slug } = useParams()
  const { season, canonicalPath, goToSeason, badSeason } = useSeasonRoute(
    '/teams',
    slug,
  )
  const [view, setView] = useState<View>('grid')
  const { t } = useI18n()

  useSeo({
    title: `${season} F1 Teams & Constructors`,
    description: `Formula 1 constructors on the ${season} grid, plus a searchable index of every constructor since 1950 — with links to full team histories.`,
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
        <h1>{view === 'search' ? t('teams.findTitle') : t('teams.title', { season })}</h1>
        {view === 'grid' && <SeasonSelect value={season} onChange={goToSeason} />}
      </div>

      <div className="tabs">
        <button
          className={view === 'grid' ? 'tab active' : 'tab'}
          onClick={() => setView('grid')}
        >
          {t('drvs.tabGrid')}
        </button>
        <button
          className={view === 'search' ? 'tab active' : 'tab'}
          onClick={() => setView('search')}
        >
          {t('teams.tabSearch')}
        </button>
      </div>

      {view === 'search' ? (
        <TeamSearch />
      ) : (
        <>
          {loading && <p className="muted">{t('common.loading')}</p>}

          {!loading && error && (
            <p className="banner">{t('drvs.sampleBanner', { error, season })}</p>
          )}

          {!loading && (
            <div className="grid">
              {teams.map((c) => (
                <TeamCard key={c.constructorId} c={c} season={season} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
