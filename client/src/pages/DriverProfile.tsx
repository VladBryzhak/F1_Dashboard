import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Flag from '../components/Flag'
import { Headshot } from '../components/EntityCards'
import { useAsync } from '../hooks/useAsync'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'

export default function DriverProfile() {
  const { driverId } = useParams<{ driverId: string }>()
  const {
    data: profile,
    loading,
    error,
  } = useAsync(() => api.driverProfile(driverId ?? ''), [driverId])

  const seasons = profile?.seasons ?? []
  const lastTeamId = seasons[seasons.length - 1]?.constructorId ?? ''
  const color = teamColor(lastTeamId)

  // OpenF1 headshot fallback for seasons the formula1.com CDN doesn't cover.
  const headshots = useAsync<Record<string, string>>(
    () =>
      profile
        ? api.driverHeadshots(String(profile.lastSeason)).catch(() => ({}))
        : Promise.resolve({}),
    [profile?.lastSeason],
  )

  return (
    <section>
      {loading && <p className="muted">Loading…</p>}

      {!loading && error && (
        <div>
          <p className="banner">Could not load this driver: {error}</p>
          <Link to="/drivers" className="back-link">
            ← Back to Drivers
          </Link>
        </div>
      )}

      {!loading && profile && (
        <>
          <div className="page-head">
            <Link to="/drivers" className="back-link">
              ← Drivers
            </Link>
          </div>

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
              color={color}
            />
            <div className="profile-heading">
              <h1 className="profile-name">
                {profile.givenName} {profile.familyName}
              </h1>
              <div className="profile-meta">
                <Flag code={profile.countryCode} nationality={profile.nationality} />
                {profile.nationality}
                {profile.permanentNumber && (
                  <span className="profile-num">#{profile.permanentNumber}</span>
                )}
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-num">
                  {profile.firstSeason}–{profile.lastSeason}
                </div>
                <div className="stat-lbl">Seasons</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.championships}</div>
                <div className="stat-lbl">Championships</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.wins}</div>
                <div className="stat-lbl">Wins</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.podiums}</div>
                <div className="stat-lbl">Podiums</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.points}</div>
                <div className="stat-lbl">Points</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{profile.races}</div>
                <div className="stat-lbl">Races</div>
              </div>
            </div>
          </div>

          <div className="card">
            <table className="standings">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Team</th>
                  <th className="num">Pos</th>
                  <th className="num">Points</th>
                  <th className="num">Wins</th>
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
                        <span className="team">
                          <span
                            className="dot"
                            style={{ background: teamColor(s.constructorId) }}
                          />
                          {s.constructorName || '—'}
                        </span>
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
