import type { CSSProperties } from 'react'
import { useI18n, type TKey } from '../i18n/core'
import { gpTitle } from '../lib/gpNames'
import { Headshot } from './EntityCards'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import type { ArticleCover as Cover, ArticleSummary } from '../types/f1'
import './ArticleCover.css'

// An article's cover, drawn rather than photographed: the driver over their
// car number in team colour (as the home hero), or, for an article without a
// driver, its key reading large in the team's colour. `caption` adds the
// reading as a broadcast-style caption over the photo (the article's own
// header; cards leave it out).
export default function ArticleCover({
  cover,
  season,
  eager = false,
  caption = false,
  className = '',
}: {
  cover: Cover
  season: number
  eager?: boolean
  caption?: boolean
  className?: string
}) {
  const color = cover.constructorId ? teamColor(cover.constructorId) : 'var(--color-accent)'
  const style = { '--team': color } as CSSProperties
  if (cover.driverId && cover.constructorId) {
    return (
      <div className={`ac ac--photo ${className}`} style={style}>
        {cover.number && (
          <span className="ac-num" aria-hidden="true">
            {cover.number}
          </span>
        )}
        <span className="ac-stripe" aria-hidden="true" />
        <Headshot
          portraitUrl={driverPortraitUrl(cover.driverId, cover.constructorId, String(season))}
          width={450}
          height={1293}
          eager={eager}
        />
        {caption && cover.reading && <Reading cover={cover} />}
      </div>
    )
  }
  const big = cover.reading ?? ''
  return (
    <div className={`ac ac--type ${className}`} style={style}>
      <span className="ac-stripe" aria-hidden="true" />
      {big && (
        <span
          className="ac-big mono"
          // As large as the frame allows for the text's length.
          style={{ fontSize: `${Math.min(34, 140 / big.length)}cqi` }}
          aria-hidden="true"
        >
          {big}
        </span>
      )}
    </div>
  )
}

// The article's key number with its label, like a caption on a broadcast.
export function Reading({ cover }: { cover: Pick<Cover, 'reading' | 'readingLabel'> }) {
  return (
    <p className="ac-reading">
      {cover.readingLabel && <span className="ac-reading-label">{cover.readingLabel}</span>}
      <span className="ac-reading-value mono">{cover.reading}</span>
    </p>
  )
}

// The meta line: day of the weekend, date, Grand Prix, reading time.
export function ArticleMeta({ a, gp = true }: { a: ArticleSummary; gp?: boolean }) {
  const { t, lang, fmtDate } = useI18n()
  return (
    <p className="art-meta">
      <span className="art-day">{t(`art.day.${a.day}` as TKey)}</span>
      <time className="mono" dateTime={a.date}>
        {fmtDate(a.date, { day: '2-digit', month: '2-digit' })}
      </time>
      {gp && a.grandPrixName && <span>{gpTitle(a.grandPrixName, lang)}</span>}
      <span>{t('art.minutes', { n: a.minutes })}</span>
    </p>
  )
}

export function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
