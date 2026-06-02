import { flagFor, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'

export function DriverCard({ d }: { d: DriverStanding }) {
  const color = teamColor(d.constructorId)
  return (
    <article className="ecard">
      <span className="stripe" style={{ background: color }} />
      {d.permanentNumber ? <span className="big-num">{d.permanentNumber}</span> : null}
      <div className="rank">P{d.position}</div>
      <h3 className="ename">
        {d.givenName} {d.familyName}
      </h3>
      <div className="esub">
        <span className="badge">{flagFor(d.nationality)}</span>
        {d.constructorName}
      </div>
      <div className="efoot">
        <span className="pts">{d.points}</span>
        <span className="lbl">pts</span>
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {d.wins} {d.wins === 1 ? 'win' : 'wins'}
        </span>
      </div>
    </article>
  )
}

export function TeamCard({ c }: { c: ConstructorStanding }) {
  const color = teamColor(c.constructorId)
  return (
    <article className="ecard">
      <span className="stripe" style={{ background: color }} />
      <div className="rank">P{c.position}</div>
      <h3 className="ename">{c.name}</h3>
      <div className="esub">
        <span className="badge">{flagFor(c.nationality)}</span>
        {c.nationality}
      </div>
      <div className="efoot">
        <span className="pts">{c.points}</span>
        <span className="lbl">pts</span>
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {c.wins} {c.wins === 1 ? 'win' : 'wins'}
        </span>
      </div>
    </article>
  )
}
