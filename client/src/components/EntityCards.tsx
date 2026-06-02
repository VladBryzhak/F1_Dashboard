import { useState } from 'react'
import { flagFor, teamCarUrl, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'

// Official car render; hides itself if the image is missing (e.g. older seasons).
function CarImage({
  constructorId,
  season,
  color,
}: {
  constructorId: string
  season: string
  color: string
}) {
  const [failed, setFailed] = useState(false)
  const url = teamCarUrl(constructorId, season)
  if (!url || failed) return null
  return (
    <div className="car-wrap" style={{ background: `${color}22` }}>
      <img
        className="car-img"
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function Headshot({ url, color }: { url: string; color: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="head-wrap" style={{ background: `${color}22` }}>
      <img
        className="head-img"
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function DriverCard({
  d,
  headshot,
}: {
  d: DriverStanding
  headshot?: string
}) {
  const color = teamColor(d.constructorId)
  return (
    <article className="ecard">
      <span className="stripe" style={{ background: color }} />
      {headshot ? <Headshot url={headshot} color={color} /> : null}
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

export function TeamCard({
  c,
  season,
}: {
  c: ConstructorStanding
  season: string
}) {
  const color = teamColor(c.constructorId)
  return (
    <article className="ecard">
      <span className="stripe" style={{ background: color }} />
      <CarImage constructorId={c.constructorId} season={season} color={color} />
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
