import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { CarImage } from '../components/EntityCards'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'

export default function TeamProfile() {
  const { constructorId } = useParams<{ constructorId: string }>()
  const {
    data: profile,
    loading,
    error,
  } = useAsync(() => api.constructorProfile(constructorId ?? ''), [constructorId])

  const color = teamColor(constructorId ?? '')

  return (
    <section>
      {loading && <p className="muted">Loading…</p>}

      {!loading && error && (
        <div>
          <p className="banner">Could not load this team: {error}</p>
          <Link to="/teams" className="back-link">
            ← Back to Teams
          </Link>
        </div>
      )}

      {!loading && profile && (
        <>
          <div className="page-head">
            <Link to="/teams" className="back-link">
              ← Teams
            </Link>
          </div>

          <div
            className="profile-hero profile-hero--team"
            style={{ '--team': color } as CSSProperties}
          >
            <CarImage
              constructorId={profile.constructorId}
              season={String(profile.lastSeason)}
              color={color}
            />
            <div className="profile-heading">
              <h1 className="profile-name">{profile.name}</h1>
              <div className="profile-meta">
                <Flag code={profile.countryCode} nationality={profile.nationality} />
                {profile.nationality}
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
