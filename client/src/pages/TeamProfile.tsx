import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import { CarImage } from '../components/EntityCards'
import Flag from '../components/Flag'
import TeammateDuels from '../components/TeammateDuels'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { countryName } from '../lib/countries'
import { breadcrumbLd, teamLd } from '../lib/jsonld'
import { teamColor } from '../lib/f1meta'
import { teamSummary } from '../lib/summaries'
import '../styles/profile.css'
import { seoText } from '../lib/seoText'
import NotFound from './NotFound'

export default function TeamProfile() {
  const { slug: constructorId } = useParams<{ slug: string }>()
  const { t, lang } = useI18n()
  const {
    data: profile,
    loading,
    error,
    notFound,
  } = useAsync(() => api.constructorProfile(constructorId ?? ''), [constructorId])

  const color = teamColor(constructorId ?? '')

  useSeo({
    skip: notFound,
    ...(profile ? seoText.team(profile, lang) : {}),
    jsonLd: profile
      ? [
          teamLd(profile),
          breadcrumbLd([
            { name: t('nav.home'), path: '/' },
            { name: t('nav.teams'), path: '/teams' },
            {
              name: profile.name,
              path: `/teams/${profile.constructorId}`,
            },
          ]),
        ]
      : undefined,
  })

  if (notFound) return <NotFound kind="team" />

  return (
    <section>
      {loading && <p className="muted">{t('common.loading')}</p>}

      {!loading && error && (
        <div>
          <p className="banner">{t('team.loadError', { error })}</p>
          <Link to="/teams" className="back-link">
            {t('team.back')}
          </Link>
        </div>
      )}

      {!loading && profile && (
        <>
          <Breadcrumbs
            trail={[
              { name: t('nav.home'), path: '/' },
              { name: t('nav.teams'), path: '/teams' },
              { name: profile.name, path: `/teams/${profile.constructorId}` },
            ]}
          />

          <div
            className="profile-hero profile-hero--team"
            style={{ '--team': color } as CSSProperties}
          >
            <CarImage
              constructorId={profile.constructorId}
              season={String(profile.lastSeason)}
              color={color}
              alt={`${profile.name} Formula 1 car`}
              sizes="(max-width: 768px) 300px, 380px"
              eager
            />
            <div className="profile-heading">
              <h1 className="profile-name">{profile.name}</h1>
              <div className="profile-meta">
                <Flag code={profile.countryCode} nationality={profile.nationality} />
                {lang === 'uk' && profile.countryCode
                  ? countryName(profile.countryCode, 'uk-UA')
                  : profile.nationality}
              </div>
              {profile.fullName && profile.fullName !== profile.name && (
                <p className="profile-bio">{profile.fullName}</p>
              )}
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-num">
                  {profile.firstSeason}-{profile.lastSeason}
                </div>
                <div className="stat-lbl">{t('drv.seasons')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.championships}</div>
                <div className="stat-lbl">{t('drv.titles')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.wins}</div>
                <div className="stat-lbl">{t('drv.wins')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.podiums}</div>
                <div className="stat-lbl">{t('drv.podiums')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.points}</div>
                <div className="stat-lbl">{t('drv.points')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.races}</div>
                <div className="stat-lbl">{t('drv.races')}</div>
              </div>
            </div>
          </div>

          <p className="profile-summary">{teamSummary(profile, lang)}</p>

          <div className="stat-grid profile-extra">
            {(
              [
                ['team.poles', profile.poles],
                ['team.fastestLaps', profile.fastestLaps],
                ['team.oneTwos', profile.oneTwos],
                ['team.sprintWins', profile.sprintWins],
              ] as [TKey, number][]
            )
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <div className="stat-card" key={k}>
                  <div className="stat-num">{v}</div>
                  <div className="stat-lbl">{t(k)}</div>
                </div>
              ))}
          </div>

          {(profile.lineage.length > 1 || profile.engines.length > 0) && (
            <div className="profile-cols">
              {profile.lineage.length > 1 && (
                <div className="card">
                  <h2 className="wknd-section">
                    {t('team.lineage')}
                    <span className="wknd-when">{t('team.lineageHint')}</span>
                  </h2>
                  <ol className="lineage">
                    {profile.lineage.map((l) => {
                      const here = l.constructorId === profile.constructorId
                      const years = `${l.yearFrom}-${l.yearTo ?? t('team.present')}`
                      return (
                        <li key={l.constructorId} className={here ? 'here' : undefined}>
                          <span className="lineage-dot" style={{ background: teamColor(l.constructorId) }} />
                          {here ? (
                            <span className="lineage-name">{l.name}</span>
                          ) : (
                            <Link to={`/teams/${l.constructorId}`} className="lineage-name">
                              {l.name}
                            </Link>
                          )}
                          <span className="lineage-years">{years}</span>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}
              {profile.engines.length > 0 && (
                <div className="card">
                  <h2 className="wknd-section">{t('team.engines')}</h2>
                  <ul className="family-list">
                    {profile.engines
                      .slice()
                      .reverse()
                      .map((e) => (
                        <li key={`${e.name}-${e.yearFrom}`}>
                          <span>{e.name}</span>
                          <span className="muted">
                            {e.yearFrom === e.yearTo ? e.yearFrom : `${e.yearFrom}-${e.yearTo}`}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <TeammateDuels
            key={profile.constructorId}
            constructorId={profile.constructorId}
            teamName={profile.name}
            initialSeason={profile.lastSeason}
            color={color}
          />

          <div className="card">
            <h2 className="wknd-section">{t('drv.career')}</h2>
            <div className="table-scroll">
            <table className="standings">
              <thead>
                <tr>
                  <th>{t('drv.colYear')}</th>
                  <th className="num">{t('drv.colPos')}</th>
                  <th className="num">{t('drv.colPoints')}</th>
                  <th className="num">{t('drv.colWins')}</th>
                  <th>{t('team.colDrivers')}</th>
                  <th>{t('team.colEngine')}</th>
                </tr>
              </thead>
              <tbody>
                {profile.seasons
                  .slice()
                  .reverse()
                  .map((s) => (
                    <tr key={s.season}>
                      <td>{s.season}</td>
                      <td className="num">{s.position}</td>
                      <td className="num points">{s.points}</td>
                      <td className="num">{s.wins}</td>
                      <td className="team-drivers">
                        {s.drivers.map((d, i) => (
                          <span key={d.driverId}>
                            {i > 0 && ', '}
                            <Link to={`/drivers/${d.driverId}`}>{d.name}</Link>
                          </span>
                        ))}
                      </td>
                      <td className="muted">{s.engine ?? ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
