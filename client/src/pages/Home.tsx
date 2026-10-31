import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import CircuitOutline from '../components/CircuitOutline'
import { Headshot } from '../components/EntityCards'
import { useSeo } from '../hooks/useSeo'
import { siteLd } from '../lib/jsonld'
import { api } from '../api/client'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import { useI18n } from '../i18n/core'
import type {
  DriverStanding,
  HomeHighlights,
  HomeResponse,
  NewsItem,
  NextRace,
  RaceHighlight,
} from '../types/f1'
import { gpTitle } from '../lib/gpNames'
import { retirementReason } from '../lib/retirementReasons'
import './Home.css'

function lastName(full: string): string {
  const parts = full.trim().split(' ')
  return parts.length > 1 ? parts.slice(1).join(' ') : full
}

function initialName(given: string, family: string): string {
  return given ? `${given[0]}. ${family}` : family
}

// "5 min ago" / "5 хв тому", in the interface language.
function timeAgo(iso: string, locale: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return rtf.format(-hrs, 'hour')
  return rtf.format(-Math.round(hrs / 24), 'day')
}

// True once the Saira Condensed 800 face itself has loaded. (fonts.check()
// is no help here: it also says yes before fonts.css has declared the face.)
function numFontLoaded(): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true
  for (const f of document.fonts) {
    if (f.family.replace(/["']/g, '') === 'Saira Condensed' && f.weight === '800' && f.status === 'loaded')
      return true
  }
  return false
}

// Dynamic hero focused on the latest race winner.
function WinnerHero({
  highlights,
  heroImage,
  heroSrcSet,
  heroSizes,
}: {
  highlights: HomeHighlights
  heroImage: string | null
  heroSrcSet: string | null
  heroSizes: string
}) {
  const { t, lang } = useI18n()
  const race = highlights.latestRace as RaceHighlight
  const winner = race.podium.find((p) => p.position === 1) ?? race.podium[0]
  const color = teamColor(winner.constructorId)
  // The car number is drawn in Saira Condensed, which arrives after the first
  // paint; shown in the fallback face it would change size when the font
  // swaps in (a layout shift), so it appears once the face is ready.
  const [numReady, setNumReady] = useState(numFontLoaded)
  useEffect(() => {
    if (numReady) return
    const check = () => numFontLoaded() && setNumReady(true)
    document.fonts.addEventListener('loadingdone', check)
    // Never leave it hidden for long (font blocked or slow network).
    const id = setTimeout(() => setNumReady(true), 3000)
    check()
    return () => {
      document.fonts.removeEventListener('loadingdone', check)
      clearTimeout(id)
    }
  }, [numReady])
  // The server names the same photo in the HTML (preload), so prefer its URL.
  const portrait =
    heroImage ?? driverPortraitUrl(winner.driverId, winner.constructorId, String(race.season))

  return (
    <div className="hero hero-winner hero-num" style={{ '--team': color } as CSSProperties}>
      {/* Race-number backdrop: the winner's car number, huge, behind the
          portrait, with a team-colour stripe. */}
      {winner.number && (
        <span className={`hero-bignum${numReady ? ' is-ready' : ''}`} aria-hidden="true">
          {winner.number}
        </span>
      )}
      <span className="hero-stripe" aria-hidden="true" />
      <Headshot
        portraitUrl={portrait}
        srcSet={heroImage ? heroSrcSet : null}
        sizes={heroSizes}
        // formula1.com portraits are all cut to the same tall frame.
        width={450}
        height={1293}
        color={color}
        eager
      />
      <div className="hero-content hero-content--winner">
        <p className="hero-kicker">
          <span className="mono">{race.season}</span>
          <span>
            {t('common.round')} <span className="mono">{race.round}</span>
          </span>
          <span>{gpTitle(race.grandPrixName, lang)}</span>
        </p>
        <h1 className="hero-title">
          {lastName(winner.driverName)} <span>{t('home.wins')}</span>
        </h1>

        {/* The podium as a small timing board: position, team swatch, name
            and team, then the winner's race time or the gap to the winner. */}
        <ol className="podium-board" aria-label={t('home.podium')}>
          {race.podium.map((p) => (
            <li className={`pb-row pb-row--p${p.position}`} key={p.position}>
              <span className="pb-pos">{p.position}</span>
              <span className="pb-swatch" style={{ background: teamColor(p.constructorId) }} />
              <Link to={`/drivers/${p.driverId}`} className="pb-name">
                <b>{lastName(p.driverName)}</b>
                <span className="pb-team">{p.constructorName}</span>
              </Link>
              <span className="pb-time">{p.time ?? ''}</span>
            </li>
          ))}
        </ol>

        {highlights.notableRetirement && (
          <p className="hero-note">
            <span className="hero-note-tag">{t('home.incident')}</span>
            <span>
              {highlights.notableRetirement.driverName}:{' '}
              {retirementReason(highlights.notableRetirement.reason, lang)}
            </span>
          </p>
        )}

        <Link
          to={`/calendar/${race.season}/${race.round}`}
          className="hero-cta"
        >
          {t('home.viewWeekend')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

// Championship top 5: sits beside the hero on desktop, under it on mobile.
function ChampionshipCard({
  rows,
  season,
  final = false,
}: {
  rows: DriverStanding[]
  season?: number
  // Every round of the season run: the standings are final.
  final?: boolean
}) {
  const { t } = useI18n()
  if (!rows.length) return null
  // Bars are scaled to the leader's points.
  const top = Math.max(rows[0].points, 1)
  return (
    <div className="champ-card">
      <div className="champ-head">
        <span>{t(final ? 'home.finalStandings' : 'home.championship')}</span>
        <span className="champ-season">{season}</span>
      </div>
      <ol className="champ-list">
        {rows.map((d) => {
          const color = teamColor(d.constructorId)
          const pct = Math.max(2, Math.min(100, (d.points / top) * 100))
          return (
            <li key={d.driverId}>
              <span className="champ-pos">{d.position}</span>
              <div className="champ-main">
                <div className="champ-line">
                  <span className="champ-dot" style={{ background: color }} />
                  <Link to={`/drivers/${d.driverId}`} className="champ-name">
                    {initialName(d.givenName, d.familyName)}
                  </Link>
                </div>
                <span className="champ-bar" aria-hidden="true">
                  <span style={{ width: `${pct}%`, background: color }} />
                </span>
              </div>
              <span className="champ-pts">{d.points}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function NextRaceCard({ race }: { race: NextRace }) {
  const { t, lang, fmtDate } = useI18n()
  const day = fmtDate(race.date, { day: '2-digit' })
  const month = fmtDate(race.date, { month: 'short' }).replace('.', '').toUpperCase()
  // Opens the calendar with this race's weekend schedule expanded.
  return (
    <Link
      to={`/calendar?schedule=${race.round}`}
      className={`home-next${race.outline ? ' has-map' : ''}`}
    >
      <span className="home-next-row">
        <span className="home-next-date">
          <b>{day}</b>
          <em>{month}</em>
        </span>
        <span className="home-next-info">
          <span className="home-next-label">{t('home.nextRace')}</span>
          <span className="home-next-gp">{gpTitle(race.grandPrixName, lang)}</span>
          {race.placeName && <span className="home-next-place">{race.placeName}</span>}
        </span>
      </span>
      {race.outline && (
        <span className="home-next-map co-frame">
          <CircuitOutline
            outline={race.outline}
            label={t('circ.outlineOf', { name: race.placeName || race.grandPrixName })}
          />
        </span>
      )}
    </Link>
  )
}

// When the home data can't be loaded: the site's name and the way in. (Between
// seasons the hero keeps the last race run, see getHomeHighlights.)
function FallbackHero() {
  const { t } = useI18n()
  return (
    <div className="hero">
      <div className="hero-content">
        <h1 className="hero-title">
          PADDOCK <span>TIMES</span>
        </h1>
        <p className="hero-tag">{t('home.fallbackTag')}</p>
        <Link to="/standings" className="hero-cta hero-cta--center">
          {t('home.fallbackCta')}
        </Link>
      </div>
    </div>
  )
}

// Reserves the news-strip's space while /api/home loads, so the links below
// don't jump down when the real headlines arrive (keeps CLS low).
function NewsStripSkeleton() {
  const { t } = useI18n()
  return (
    <section className="news-strip" aria-hidden="true">
      <div className="news-head">
        <h2>{t('home.news')}</h2>
      </div>
      <div className="news-list">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="news-item news-item--skeleton" />
        ))}
      </div>
    </section>
  )
}

function NewsStrip({ news }: { news: NewsItem[] }) {
  const { t, locale } = useI18n()
  if (!news.length) return null
  return (
    <section className="news-strip">
      <div className="news-head">
        <h2>{t('home.news')}</h2>
        <span className="news-src">{t('home.via', { source: news[0].source })}</span>
      </div>
      <div className="news-list">
        {news.map((n) => (
          <a
            key={n.link}
            className="news-item"
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="news-title">{n.title}</span>
            <span className="news-meta">
              <span>{n.source}</span>
              <span className="news-ago">{timeAgo(n.pubDate, locale)}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

// Placeholder shown while /api/home is loading. Reuses the .hero frame (same
// 420px height, team-colour wash) so there's no layout jump, and, crucially,
// we no longer flash the static off-season poster during a cold start.
function HeroSkeleton() {
  const { t } = useI18n()
  return (
    <div className="hero hero-skeleton" aria-busy="true" aria-label={t('home.loadingRace')}>
      <span className="hero-kicker">{t('home.loadingRace')}</span>
    </div>
  )
}

declare global {
  interface Window {
    __HOME__?: HomeResponse
  }
}

// The server inlines this page's data into the HTML on a direct visit to "/"
// (see server/src/services/pageHtml.ts). Used once; later visits fetch fresh.
let boot: HomeResponse | null = typeof window !== 'undefined' ? (window.__HOME__ ?? null) : null

export default function Home() {
  useSeo({ jsonLd: siteLd() })
  const [data, setData] = useState<HomeResponse | null>(() => boot)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const fromBoot = boot
    boot = null
    // Inlined data may come without headlines (feed not cached yet).
    if (fromBoot?.news) return
    let active = true
    api
      .home()
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [])

  const loading = !data && !failed
  const season = data?.highlights.season
  const hasRace = !!data?.highlights.latestRace

  return (
    <section>
      <div className="home-top">
        {loading ? (
          <HeroSkeleton />
        ) : hasRace ? (
          <WinnerHero
            highlights={data!.highlights}
            heroImage={data!.heroImage}
            heroSrcSet={data!.heroSrcSet}
            heroSizes={data!.heroSizes}
          />
        ) : (
          <FallbackHero />
        )}

        <aside className="home-aside">
          <ChampionshipCard rows={data?.standings ?? []} season={season} final={data?.highlights.seasonOver} />
          {data?.highlights.nextRace && <NextRaceCard race={data.highlights.nextRace} />}
        </aside>
      </div>

      {data?.news ? <NewsStrip news={data.news} /> : !failed && <NewsStripSkeleton />}
    </section>
  )
}
