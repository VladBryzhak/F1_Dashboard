import { flagFor, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'

export function DriverStandingsTable({ rows }: { rows: DriverStanding[] }) {
  return (
    <div className="card">
      <button className="card-arrow" aria-label="More">
        ›
      </button>
      <table className="standings">
        <thead>
          <tr>
            <th className="pos">Pos</th>
            <th>Driver</th>
            <th>Team</th>
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
                  <span className="badge">{flagFor(r.nationality)}</span>
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
      <button className="card-arrow" aria-label="More">
        ›
      </button>
      <table className="standings">
        <thead>
          <tr>
            <th className="pos">Pos</th>
            <th>Team</th>
            <th>Nationality</th>
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
                <span className="entity">
                  <span className="badge">{flagFor(r.nationality)}</span>
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
