import { useEffect, useState, type CSSProperties, type SyntheticEvent } from 'react'
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

const F1 = 'https://media.formula1.com/image/upload/c_lfill,w_600/q_auto/v1740000001/common/f1'

// Fallback podium photos for the off-season poster.
const ANTONELLI_SRC = '/home-antonelli.webp'
const ANTONELLI_FALLBACK = `${F1}/2026/mercedes/andant01/2026mercedesandant01right.webp`
const HAMILTON_SRC = '/home-hamilton.jpg'
const HAMILTON_FALLBACK = `${F1}/2026/ferrari/lewham01/2026ferrarilewham01left.webp`

function fallbackTo(url: string) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (!img.src.includes('media.formula1.com')) img.src = url
  }
}

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
  // The server names the same photo in the HTML (preload), so prefer its URL.
  const portrait =
    heroImage ?? driverPortraitUrl(winner.driverId, winner.constructorId, String(race.season))

  return (
    <div className="hero hero-winner hero-num" style={{ '--team': color } as CSSProperties}>
      {/* Race-number backdrop: the winner's car number, huge, behind the
          portrait, with a team-colour stripe. */}
      {winner.number && (
        <span className="hero-bignum" aria-hidden="true">
          {winner.number}
        </span>
      )}
      <span className="hero-stripe" aria-hidden="true" />
      <Headshot
        portraitUrl={portrait}
        srcSet={heroImage ? heroSrcSet : null}
        sizes={heroSizes}
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
}: {
  rows: DriverStanding[]
  season?: number
}) {
  const { t } = useI18n()
  if (!rows.length) return null
  // Bars are scaled to the leader's points.
  const top = Math.max(rows[0].points, 1)
  return (
    <div className="champ-card">
      <div className="champ-head">
        <span>{t('home.championship')}</span>
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
        <span className="home-next-map">
          <CircuitOutline
            outline={race.outline}
            label={t('circ.outlineOf', { name: race.placeName || race.grandPrixName })}
          />
        </span>
      )}
    </Link>
  )
}

// Off-season / no-race fallback: the static title-fight poster.
function TitleFightHero() {
  const { t } = useI18n()
  return (
    <div
      className="hero hero-fight"
      style={{ '--merc': teamColor('mercedes'), '--fer': teamColor('ferrari') } as CSSProperties}
    >
      <div className="hero-side hero-left">
        <img
          className="hero-photo"
          src={ANTONELLI_SRC}
          onError={fallbackTo(ANTONELLI_FALLBACK)}
          alt={t('home.altAntonelli')}
        />
      </div>
      <div className="hero-side hero-right">
        <img
          className="hero-photo"
          src={HAMILTON_SRC}
          onError={fallbackTo(HAMILTON_FALLBACK)}
          alt={t('home.altHamilton')}
        />
      </div>

      <div className="hero-veil" />

      <div className="hero-content">
        <p className="hero-kicker">{t('home.titleFight')}</p>
        <h1 className="hero-title">
          F1 <span>DASHBOARD</span>
        </h1>
        <div className="hero-battle">
          <div className="battle-side battle-merc">
            <span className="battle-team">Mercedes</span>
            <span className="battle-driver">Antonelli</span>
          </div>
          <span className="battle-vs">VS</span>
          <div className="battle-side battle-fer">
            <span className="battle-team">Ferrari</span>
            <span className="battle-driver">Hamilton</span>
          </div>
        </div>
        <p className="hero-tag">{t('home.titleFightTag')}</p>
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
          <TitleFightHero />
        )}

        <aside className="home-aside">
          <ChampionshipCard rows={data?.standings ?? []} season={season} />
          {data?.highlights.nextRace && <NextRaceCard race={data.highlights.nextRace} />}
        </aside>
      </div>

      {data?.news ? <NewsStrip news={data.news} /> : !failed && <NewsStripSkeleton />}
    </section>
  )
}
