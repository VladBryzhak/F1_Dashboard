import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { driverPortraitUrl, teamCarUrl, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'
import Flag from './Flag'
import { useI18n } from '../i18n/core'
import { countryName } from '../lib/countries'
import './EntityCards.css'

// Official car render; hides itself if the image is missing (e.g. older seasons).
// Exported so profile pages can reuse the same season-accurate art + fallback.
export function CarImage({
  constructorId,
  season,
  alt = '',
  eager = false,
}: {
  constructorId: string
  season: string
  // Team colour; the art sits on the deepest surface (team colours stay
  // swatches in the design system), so it is no longer painted behind it.
  color?: string
  alt?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const url = teamCarUrl(constructorId, season)
  if (!url || failed) return null
  return (
    <div className="car-wrap">
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
  alt = '',
  eager = false,
  srcSet,
  sizes,
  width,
  height,
}: {
  portraitUrl?: string | null
  fallbackUrl?: string
  thirdUrl?: string | null
  // Team colour; kept for callers, not painted (see CarImage).
  color?: string
  alt?: string
  eager?: boolean
  // Responsive variants of portraitUrl (only used while it is shown).
  srcSet?: string | null
  sizes?: string
  // Intrinsic size of portraitUrl, so the browser reserves its box early.
  width?: number
  height?: number
}) {
  // portraitUrl/fallbackUrl are transparent driver renders; thirdUrl is a
  // rectangular photo (Wikimedia) that needs a different, bounded layout.
  const candidates = [
    { url: portraitUrl, photo: false },
    { url: fallbackUrl ?? null, photo: false },
    { url: thirdUrl ?? null, photo: true },
  ].filter((c): c is { url: string; photo: boolean } => !!c.url)
  const key = candidates.map((c) => c.url).join('|')
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [key])
  const cur = candidates[idx]
  if (!cur) return null
  return (
    <div
      className={`head-wrap${cur.photo ? ' is-photo' : ''}`}
    >
      <img
        className="head-img"
        src={cur.url}
        srcSet={idx === 0 && cur.url === portraitUrl ? (srcSet ?? undefined) : undefined}
        sizes={idx === 0 && cur.url === portraitUrl && srcSet ? sizes : undefined}
        alt={alt}
        width={idx === 0 && cur.url === portraitUrl ? width : undefined}
        height={idx === 0 && cur.url === portraitUrl ? height : undefined}
        loading={eager ? 'eager' : 'lazy'}
        // Set fetchpriority via the DOM so React 18.3 doesn't warn on the prop.
        ref={(el) => {
          if (el && eager) el.setAttribute('fetchpriority', 'high')
        }}
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
  const { t, tn } = useI18n()
  return (
    <Link to={`/drivers/${d.driverId}`} className="ecard">
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
        <span className="eswatch" style={{ background: color }} aria-hidden="true" />
        {d.constructorName}
      </div>
      <div className="efoot">
        <span className="pts">{d.points}</span>
        <span className="lbl">{t('ec.pts')}</span>
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {tn('plural.winsN', d.wins)}
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
  const { t, tn, lang, locale } = useI18n()
  return (
    <Link to={`/teams/${c.constructorId}`} className="ecard">
      <CarImage
        constructorId={c.constructorId}
        season={season}
        color={color}
        alt={`${c.name} Formula 1 car`}
      />
      <div className="rank">P{c.position}</div>
      <h3 className="ename">
        <span className="eswatch" style={{ background: color }} aria-hidden="true" />
        {c.name}
      </h3>
      <div className="esub">
        <Flag code={c.countryCode} nationality={c.nationality} />
        {lang === 'uk' && c.countryCode ? countryName(c.countryCode, locale) : c.nationality}
      </div>
      <div className="efoot">
        <span className="pts">{c.points}</span>
        <span className="lbl">{t('ec.pts')}</span>
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {tn('plural.winsN', c.wins)}
        </span>
      </div>
    </Link>
  )
}
