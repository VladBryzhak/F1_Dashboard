import type { ConstructorStanding, DriverStanding } from '../types/f1'

export function DriverStandingsTable({ rows }: { rows: DriverStanding[] }) {
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Team</th>
          <th>Nationality</th>
          <th className="num">Wins</th>
          <th className="num">Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.driverId}>
            <td>{r.position}</td>
            <td>
              {r.givenName} {r.familyName}
              {r.code ? <span className="code"> {r.code}</span> : null}
            </td>
            <td>{r.constructorName}</td>
            <td>{r.nationality}</td>
            <td className="num">{r.wins}</td>
            <td className="num points">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ConstructorStandingsTable({
  rows,
}: {
  rows: ConstructorStanding[]
}) {
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Team</th>
          <th>Nationality</th>
          <th className="num">Wins</th>
          <th className="num">Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.constructorId}>
            <td>{r.position}</td>
            <td>{r.name}</td>
            <td>{r.nationality}</td>
            <td className="num">{r.wins}</td>
            <td className="num points">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
