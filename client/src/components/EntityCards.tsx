import { useEffect, useState } from 'react'
import { driverPortraitUrl, teamCarUrl, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'
import Flag from './Flag'

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

// Season/team-accurate portrait first, OpenF1 headshot as fallback; hides
// itself once both candidates have failed.
function Headshot({
  portraitUrl,
  fallbackUrl,
  color,
}: {
  portraitUrl?: string | null
  fallbackUrl?: string
  color: string
}) {
  const candidates = [portraitUrl, fallbackUrl].filter((u): u is string => !!u)
  const key = candidates.join('|')
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [key])
  const src = candidates[idx]
  if (!src) return null
  return (
    <div className="head-wrap" style={{ background: `${color}22` }}>
      <img
        className="head-img"
        src={src}
        alt=""
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  )
}

export function DriverCard({
  d,
  season,
  headshot,
}: {
  d: DriverStanding
  season: string
  headshot?: string
}) {
  const color = teamColor(d.constructorId)
  return (
    <article className="ecard">
      <span className="stripe" style={{ background: color }} />
      <Headshot
        portraitUrl={driverPortraitUrl(d.driverId, d.constructorId, season)}
        fallbackUrl={headshot}
        color={color}
      />
      {d.permanentNumber ? <span className="big-num">{d.permanentNumber}</span> : null}
      <div className="rank">P{d.position}</div>
      <h3 className="ename">
        {d.givenName} {d.familyName}
      </h3>
      <div className="esub">
        <Flag code={d.countryCode} nationality={d.nationality} />
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
        <Flag code={c.countryCode} nationality={c.nationality} />
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
