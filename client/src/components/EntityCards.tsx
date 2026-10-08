import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { driverPortraitUrl, teamCarUrl, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'
import Flag from './Flag'

// Official car render; hides itself if the image is missing (e.g. older seasons).
// Exported so profile pages can reuse the same season-accurate art + fallback.
export function CarImage({
  constructorId,
  season,
  color,
  alt = '',
  eager = false,
}: {
  constructorId: string
  season: string
  color: string
  alt?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const url = teamCarUrl(constructorId, season)
  if (!url || failed) return null
  return (
    <div className="car-wrap" style={{ background: `${color}22` }}>
      <img
        className="car-img"
        src={url}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

// Season/team-accurate portrait first, OpenF1 headshot as fallback; hides
// itself once both candidates have failed.
// Exported so profile pages can reuse the same season-accurate art + fallback.
export function Headshot({
  portraitUrl,
  fallbackUrl,
  thirdUrl,
  color,
  alt = '',
  eager = false,
}: {
  portraitUrl?: string | null
  fallbackUrl?: string
  thirdUrl?: string | null
  color: string
  alt?: string
  eager?: boolean
}) {
  const candidates = [portraitUrl, fallbackUrl, thirdUrl].filter(
    (u): u is string => !!u,
  )
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
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
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
    <Link to={`/drivers/${d.driverId}`} className="ecard">
      <span className="stripe" style={{ background: color }} />
      <Headshot
        portraitUrl={driverPortraitUrl(d.driverId, d.constructorId, season)}
        fallbackUrl={headshot}
        color={color}
        alt={`${d.givenName} ${d.familyName}`}
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
    </Link>
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
    <Link to={`/teams/${c.constructorId}`} className="ecard">
      <span className="stripe" style={{ background: color }} />
      <CarImage
        constructorId={c.constructorId}
        season={season}
        color={color}
        alt={`${c.name} Formula 1 car`}
      />
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
    </Link>
  )
}
