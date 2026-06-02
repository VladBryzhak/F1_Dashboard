import { useState } from 'react'
import { teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'
import Flag from './Flag'

// Circular driver photo for a standings row; falls back to a colour chip with
// the driver's code when no headshot is available.
function DriverAvatar({
  url,
  code,
  color,
}: {
  url?: string
  code: string | null
  color: string
}) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img
        className="avatar"
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span className="avatar avatar-fallback" style={{ background: `${color}33`, color }}>
      {code ?? '–'}
    </span>
  )
}

export function DriverStandingsTable({
  rows,
  headshots,
}: {
  rows: DriverStanding[]
  headshots?: Record<string, string>
}) {
  return (
    <div className="card">
      <table className="standings">
        <thead>
          <tr>
            <th className="pos">Pos</th>
            <th>Driver</th>
            <th>Team</th>
            <th>Country</th>
            <th className="num">Wins</th>
            <th className="num">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.driverId}>
              <td className="pos">{r.position}</td>
              <td>
                <span className="entity">
                  <DriverAvatar
                    url={r.code ? headshots?.[r.code] : undefined}
                    code={r.code}
                    color={teamColor(r.constructorId)}
                  />
                  <span className="name">
                    {r.givenName} {r.familyName}
                  </span>
                  {r.code ? <span className="code">{r.code}</span> : null}
                </span>
              </td>
              <td>
                <span className="team">
                  <span
                    className="dot"
                    style={{ background: teamColor(r.constructorId) }}
                  />
                  {r.constructorName}
                </span>
              </td>
              <td>
                <span className="country">
                  <Flag code={r.countryCode} nationality={r.nationality} />
                  {r.nationality}
                </span>
              </td>
              <td className="num">{r.wins}</td>
              <td className="num points">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ConstructorStandingsTable({
  rows,
}: {
  rows: ConstructorStanding[]
}) {
  return (
    <div className="card">
      <table className="standings">
        <thead>
          <tr>
            <th className="pos">Pos</th>
            <th>Team</th>
            <th>Country</th>
            <th className="num">Wins</th>
            <th className="num">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.constructorId}>
              <td className="pos">{r.position}</td>
              <td>
                <span className="team">
                  <span
                    className="dot"
                    style={{ background: teamColor(r.constructorId) }}
                  />
                  <span className="name">{r.name}</span>
                </span>
              </td>
              <td>
                <span className="country">
                  <Flag code={r.countryCode} nationality={r.nationality} />
                  {r.nationality}
                </span>
              </td>
              <td className="num">{r.wins}</td>
              <td className="num points">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
