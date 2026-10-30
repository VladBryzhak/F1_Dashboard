import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import Flag from '../components/Flag'
import { Headshot } from '../components/EntityCards'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { countryName } from '../lib/countries'
import { breadcrumbLd, driverLd } from '../lib/jsonld'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import { gpShort } from '../lib/gpNames'
import { driverSummary } from '../lib/summaries'
import type { DriverProfile as Profile } from '../types/f1'
import '../styles/profile.css'
import { seoText } from '../lib/seoText'
import NotFound from './NotFound'

// Whole years between two yyyy-mm-dd dates (to today when `to` is null).
function yearsBetween(from: string, to: string | null): number | null {
  const a = new Date(from)
  const b = to ? new Date(to) : new Date()
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  let y = b.getFullYear() - a.getFullYear()
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y -= 1
  return y
}

// "Born 30 September 1997 (age 29)" and "Hasselt, Belgium", set apart by space
function BioLine({ p }: { p: Profile }) {
  const { t, tn, fmtDate, locale } = useI18n()
  if (!p.dateOfBirth && !p.placeOfBirth) return null
  const long = { day: 'numeric', month: 'long', year: 'numeric' } as const
  const age = p.dateOfBirth ? yearsBetween(p.dateOfBirth, p.dateOfDeath) : null
  const place = [p.placeOfBirth, countryName(p.birthCountryCode, locale)].filter(Boolean).join(', ')
  const parts: string[] = []
  if (p.dateOfBirth) {
    let born = t('drv.born', { date: fmtDate(p.dateOfBirth, long) })
    if (age != null && !p.dateOfDeath) born += ` (${t('drv.age', { n: age, years: tn('plural.years', age) })})`
    parts.push(born)
  }
  if (p.dateOfDeath) {
    let died = t('drv.died', { date: fmtDate(p.dateOfDeath, long) })
    if (age != null) died += ` (${t('drv.age', { n: age, years: tn('plural.years', age) })})`
    parts.push(died)
  }
  if (place) parts.push(place)
  return (
    <p className="profile-bio">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </p>
  )
}

// Finishing position chip: P1 red, podium bright, DNF etc. muted.
function FormChip({
  r,
}: {
  r: Profile['recentRaces'][number]
}) {
  const { lang } = useI18n()
  const n = Number(r.positionText)
  const cls = !Number.isFinite(n) ? 'form-chip out' : n === 1 ? 'form-chip win' : n <= 3 ? 'form-chip podium' : n <= 10 ? 'form-chip points' : 'form-chip'
  return (
    <Link to={`/calendar/${r.season}/${r.round}`} className="form-item">
      <span className={cls}>{Number.isFinite(n) ? `P${n}` : r.positionText}</span>
      <span className="form-gp">{gpShort(r.grandPrixName, lang)}</span>
      <span className="form-year">{r.season}</span>
    </Link>
  )
}

export default function DriverProfile() {
  const { slug: driverId } = useParams<{ slug: string }>()
  const { t, lang } = useI18n()
  const {
    data: profile,
    loading,
    error,
    notFound,
  } = useAsync(() => api.driverProfile(driverId ?? ''), [driverId])

  const seasons = profile?.seasons ?? []
  const lastTeamId = seasons[seasons.length - 1]?.constructorId ?? ''
  const color = teamColor(lastTeamId)

  useSeo({
    skip: notFound,
    ...(profile ? seoText.driver(profile, lang) : {}),
    jsonLd: profile
      ? [
          driverLd(profile),
          breadcrumbLd([
            { name: t('nav.home'), path: '/' },
            { name: t('nav.drivers'), path: '/drivers' },
            {
              name: `${profile.givenName} ${profile.familyName}`,
              path: `/drivers/${profile.driverId}`,
            },
          ]),
        ]
      : undefined,
  })

  // OpenF1 headshot fallback for seasons the formula1.com CDN doesn't cover.
  const headshots = useAsync<Record<string, string>>(
    () =>
      profile
        ? api.driverHeadshots(String(profile.lastSeason)).catch(() => ({}))
        : Promise.resolve({}),
    [profile?.lastSeason],
  )

  if (notFound) return <NotFound kind="driver" />

  return (
    <section>
      {loading && <p className="muted">{t('common.loading')}</p>}

      {!loading && error && (
        <div>
          <p className="banner">{t('drv.loadError', { error })}</p>
          <Link to="/drivers" className="back-link">
            {t('drv.back')}
          </Link>
        </div>
      )}

      {!loading && profile && (
        <>
          <Breadcrumbs
            trail={[
              { name: t('nav.home'), path: '/' },
              { name: t('nav.drivers'), path: '/drivers' },
              {
                name: `${profile.givenName} ${profile.familyName}`,
                path: `/drivers/${profile.driverId}`,
              },
            ]}
          />

          <div
            className="profile-hero"
            style={{ '--team': color } as CSSProperties}
          >
            <Headshot
              portraitUrl={driverPortraitUrl(
                profile.driverId,
                lastTeamId,
                String(profile.lastSeason),
              )}
              fallbackUrl={profile.code ? headshots.data?.[profile.code] : undefined}
              thirdUrl={profile.photoUrl}
              // formula1.com portraits share one tall frame (the size is only
              // applied to that first candidate).
              width={450}
              height={1293}
              color={color}
              alt={`${profile.givenName} ${profile.familyName}`}
              eager
            />
            <div className="profile-heading">
              <h1 className="profile-name">
                {profile.givenName} {profile.familyName}
              </h1>
              <div className="profile-meta">
                <Flag code={profile.countryCode} nationality={profile.nationality} />
                {lang === 'uk' && profile.countryCode
                  ? countryName(profile.countryCode, 'uk-UA')
                  : profile.nationality}
                {profile.permanentNumber && (
                  <span className="profile-num">#{profile.permanentNumber}</span>
                )}
              </div>
              <BioLine p={profile} />
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

          <p className="profile-summary">{driverSummary(profile, lang)}</p>

          <div className="stat-grid profile-extra">
            {(
              [
                ['drv.poles', profile.poles],
                ['drv.fastestLaps', profile.fastestLaps],
                ['drv.sprintWins', profile.sprintWins],
                ['drv.grandSlams', profile.grandSlams],
                ['drv.dotd', profile.driverOfTheDay],
                ['drv.bestFinish', profile.bestResult != null ? `P${profile.bestResult}` : null],
                ['drv.bestGrid', profile.bestGrid != null ? `P${profile.bestGrid}` : null],
                ['drv.bestChamp', profile.bestChampionship != null ? `P${profile.bestChampionship}` : null],
              ] as [TKey, number | string | null][]
            )
              // Hide empty extras (e.g. sprint wins for pre-2021 drivers).
              .filter(([, v]) => v != null && v !== 0)
              .map(([k, v]) => (
                <div className="stat-card" key={k}>
                  <div className="stat-num">{v}</div>
                  <div className="stat-lbl">{t(k)}</div>
                </div>
              ))}
          </div>

          {(profile.recentRaces.length > 0 || profile.family.length > 0) && (
            <div className="profile-cols">
              {profile.recentRaces.length > 0 && (
                <div className="card">
                  <h3 className="wknd-section">
                    {t('drv.form')}
                    <span className="wknd-when">
                      {t('drv.formHint', { n: profile.recentRaces.length })}
                    </span>
                  </h3>
                  <div className="form-row">
                    {profile.recentRaces.map((r) => (
                      <FormChip key={`${r.season}-${r.round}`} r={r} />
                    ))}
                  </div>
                </div>
              )}
              {profile.family.length > 0 && (
                <div className="card">
                  <h3 className="wknd-section">{t('drv.family')}</h3>
                  <ul className="family-list">
                    {profile.family.map((f) => (
                      <li key={f.driverId}>
                        <Link to={`/drivers/${f.driverId}`}>{f.name}</Link>
                        <span className="muted">{t(`rel.${f.relation}` as TKey)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3 className="wknd-section">{t('drv.career')}</h3>
            <table className="standings">
              <thead>
                <tr>
                  <th>{t('drv.colYear')}</th>
                  <th>{t('drv.colTeam')}</th>
                  <th className="num">{t('drv.colPos')}</th>
                  <th className="num">{t('drv.colPoints')}</th>
                  <th className="num">{t('drv.colWins')}</th>
                </tr>
              </thead>
              <tbody>
                {profile.seasons
                  .slice()
                  .reverse()
                  .map((s) => (
                    <tr key={s.season}>
                      <td>{s.season}</td>
                      <td>
                        {s.constructorId ? (
                          <Link
                            to={`/teams/${s.constructorId}`}
                            className="team team-link"
                          >
                            <span
                              className="dot"
                              style={{ background: teamColor(s.constructorId) }}
                            />
                            {s.constructorName || ''}
                          </Link>
                        ) : (
                          <span className="team">{s.constructorName || ''}</span>
                        )}
                      </td>
                      <td className="num">{s.position}</td>
                      <td className="num points">{s.points}</td>
                      <td className="num">{s.wins}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
