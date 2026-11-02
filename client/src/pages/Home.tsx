import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CircuitOutline from '../components/CircuitOutline'
import { Headshot } from '../components/EntityCards'
import HeroSlider from '../components/HeroSlider'
import { useSeo } from '../hooks/useSeo'
import { siteLd } from '../lib/jsonld'
import { api } from '../api/client'
import { driverPortraitUrl, f1SrcSet, teamColor } from '../lib/f1meta'
import { sessionLabel } from '../lib/live'
import { useI18n } from '../i18n/core'
import type {
  ChampionHighlight,
  DriverStanding,
  HomeHighlights,
  HomeResponse,
  NewsItem,
  NextRace,
  RaceHighlight,
  SessionHero,
  SessionRow,
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

// The car number is drawn in Saira Condensed, which arrives after the first
// paint; shown in the fallback face it would change size when the font swaps
// in (a layout shift), so it appears once the face is ready.
function useNumReady(): boolean {
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
  return numReady
}

interface HeroImage {
  heroImage: string | null
  heroSrcSet: string | null
  heroSizes: string
}

// Season, round and grand prix over the headline; a session hero adds the
// session's name on a tag above.
function HeroKicker({
  season,
  round,
  grandPrixName,
  session,
}: {
  season: number
  round: number
  grandPrixName: string
  session?: string
}) {
  const { t, lang } = useI18n()
  return (
    <>
      {session && <span className="hero-chip">{session}</span>}
      <p className="hero-kicker">
        <span className="mono">{season}</span>
        <span>
          {t('common.round')} <span className="mono">{round}</span>
        </span>
        <span>{gpTitle(grandPrixName, lang)}</span>
      </p>
    </>
  )
}

interface BoardRow {
  position: number
  driverId: string | null
  driverName: string
  constructorId: string | null
  constructorName: string
  time: string | null
  laps?: number | null
}

// A top three as a small timing board: position, team swatch, name and team,
// then P1's time or the gap to P1.
function PodiumBoard({ rows, label, laps = false }: { rows: BoardRow[]; label: string; laps?: boolean }) {
  const { tn } = useI18n()
  return (
    <ol className="podium-board" aria-label={label}>
      {rows.map((p) => {
        const name = (
          <>
            <b>{lastName(p.driverName)}</b>
            <span className="pb-team">
              {p.constructorName}
              {laps && p.laps ? ` · ${tn('plural.lapsN', p.laps)}` : ''}
            </span>
          </>
        )
        return (
          <li className={`pb-row pb-row--p${p.position}`} key={p.position}>
            <span className="pb-pos">{p.position}</span>
            <span className="pb-swatch" style={{ background: teamColor(p.constructorId ?? '') }} />
            {p.driverId ? (
              <Link to={`/drivers/${p.driverId}`} className="pb-name">
                {name}
              </Link>
            ) : (
              <span className="pb-name">{name}</span>
            )}
            <span className="pb-time">{p.time ?? ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

// The weekend's page once f1db has its results; until then (a session hero)
// the calendar with the weekend's schedule open, as the page is still empty.
function WeekendLink({ season, round, schedule = false }: { season: number; round: number; schedule?: boolean }) {
  const { t } = useI18n()
  return (
    <Link to={schedule ? `/calendar?schedule=${round}` : `/calendar/${season}/${round}`} className="hero-cta">
      {t(schedule ? 'home.weekendSchedule' : 'home.viewWeekend')}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

// One driver in front of their car number and a team-colour stripe: the race
// winner (or a sprint's) and the pole-sitter. The text column is `children`.
function NumberHero({
  driverId,
  constructorId,
  number,
  season,
  headshot,
  image,
  children,
  className = '',
  eager = true,
}: {
  driverId: string
  constructorId: string
  number: string | null
  season: number
  headshot?: string | null
  image: HeroImage
  children: ReactNode
  className?: string
  eager?: boolean
}) {
  const color = teamColor(constructorId)
  const numReady = useNumReady()
  // The server names the same photo in the HTML (preload), so prefer its URL.
  const portrait = image.heroImage ?? driverPortraitUrl(driverId, constructorId, String(season))
  return (
    <div className={`hero hero-winner hero-num ${className}`} style={{ '--team': color } as CSSProperties}>
      {/* Race-number backdrop: the car number, huge, behind the portrait,
          with a team-colour stripe. */}
      {number && (
        <span className={`hero-bignum${numReady ? ' is-ready' : ''}`} aria-hidden="true">
          {number}
        </span>
      )}
      <span className="hero-stripe" aria-hidden="true" />
      <Headshot
        portraitUrl={portrait}
        fallbackUrl={headshot ?? undefined}
        // Without the server's URL, the formula1.com widths (f1SrcSet).
        srcSet={image.heroImage ? image.heroSrcSet : undefined}
        sizes={image.heroSizes}
        // formula1.com portraits are all cut to the same tall frame.
        width={450}
        height={1293}
        color={color}
        eager={eager}
      />
      <div className="hero-content hero-content--winner">{children}</div>
    </div>
  )
}

// After a race: the winner, the podium and an incident worth a line. A sprint
// (and a race f1db hasn't published yet) comes from the session result.
function WinnerHero({
  race,
  retirement,
  sprint = false,
  fromSession = false,
  headshot,
  image,
}: {
  race: RaceHighlight
  retirement?: HomeHighlights['notableRetirement']
  sprint?: boolean
  fromSession?: boolean
  headshot?: string | null
  image: HeroImage
}) {
  const { t, lang } = useI18n()
  const winner = race.podium.find((p) => p.position === 1) ?? race.podium[0]
  return (
    <NumberHero
      driverId={winner.driverId}
      constructorId={winner.constructorId}
      number={winner.number}
      season={race.season}
      headshot={headshot}
      image={image}
    >
      <HeroKicker
        season={race.season}
        round={race.round}
        grandPrixName={race.grandPrixName}
        session={sprint ? t('session.sprint') : undefined}
      />
      <h1 className="hero-title">
        {lastName(winner.driverName)} <span>{t(sprint ? 'home.winsSprint' : 'home.wins')}</span>
      </h1>
      <PodiumBoard rows={race.podium} label={t('home.podium')} />
      {retirement && (
        <p className="hero-note">
          <span className="hero-note-tag">{t('home.incident')}</span>
          <span>
            {retirement.driverName}: {retirementReason(retirement.reason, lang)}
          </span>
        </p>
      )}
      <WeekendLink season={race.season} round={race.round} schedule={fromSession} />
    </NumberHero>
  )
}

// After qualifying: the pole-sitter, the pole lap and the top three.
function PoleHero({ session, image }: { session: SessionHero; image: HeroImage }) {
  const { t } = useI18n()
  const pole = session.top[0]
  const label = sessionLabel(session.sessionName, t)
  return (
    <NumberHero
      driverId={pole.driverId ?? ''}
      constructorId={pole.constructorId ?? ''}
      number={pole.number}
      season={session.season}
      headshot={pole.headshot}
      image={image}
      className="hero-pole"
    >
      <HeroKicker
        season={session.season}
        round={session.round}
        grandPrixName={session.grandPrixName}
        session={label}
      />
      <h1 className="hero-title">
        {lastName(pole.driverName)} <span>{t('home.onPole')}</span>
      </h1>
      {pole.time && (
        <p className="hero-poletime">
          <span>
            {t('home.poleTime')}
            {session.segment ? ` · ${session.segment}` : ''}
          </span>
          <b>{pole.time}</b>
        </p>
      )}
      <PodiumBoard rows={session.top} label={t('home.top3', { session: label })} />
      <WeekendLink season={session.season} round={session.round} schedule />
    </NumberHero>
  )
}

// The trio's side portraits are shown about 240 px wide (160 px on phones).
const TRIO_SIZES = '(max-width: 768px) 160px, 240px'

// After a practice: the top three, the fastest in front with the other two
// behind on either side, and the times as a timing board.
function PracticeHero({ session, image }: { session: SessionHero; image: HeroImage }) {
  const { t } = useI18n()
  const [p1, p2, p3] = session.top
  const label = sessionLabel(session.sessionName, t)
  const photo = (r: SessionRow) => {
    // P1's photo is the one the server preloads.
    if (r === p1 && image.heroImage) return { src: image.heroImage, srcSet: image.heroSrcSet ?? undefined, sizes: image.heroSizes }
    const url = r.driverId && r.constructorId ? driverPortraitUrl(r.driverId, r.constructorId, String(session.season)) : null
    if (url) return { src: url, srcSet: f1SrcSet(url), sizes: TRIO_SIZES }
    return r.headshot ? { src: r.headshot } : null
  }
  return (
    <div
      className="hero hero-winner hero-trio"
      style={{ '--team': teamColor(p1.constructorId ?? '') } as CSSProperties}
    >
      <div className="trio" aria-hidden="true">
        {[p2, p1, p3].map((r) => {
          const img = photo(r)
          return (
            <div className={`trio-p trio-p--p${r.position}`} key={r.position}>
              {img && (
                <img
                  {...img}
                  alt=""
                  width={450}
                  height={1293}
                  ref={(el) => {
                    if (el && r === p1) el.setAttribute('fetchpriority', 'high')
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="hero-content hero-content--winner">
        <HeroKicker
          season={session.season}
          round={session.round}
          grandPrixName={session.grandPrixName}
          session={label}
        />
        <h1 className="hero-title">
          {lastName(p1.driverName)} <span>{t('home.fastest')}</span>
        </h1>
        <PodiumBoard rows={session.top} label={t('home.top3', { session: label })} laps />
        <WeekendLink season={session.season} round={session.round} schedule />
      </div>
    </div>
  )
}

// The season's champion, from the round the title was decided until a new
// season's first race: the second slide of the home hero.
function ChampionHero({ champion, heroSizes }: { champion: ChampionHighlight; heroSizes: string }) {
  const { t, lang } = useI18n()
  const stats: [string, string][] = [
    [t('drv.points'), String(champion.points)],
    [t('drv.wins'), String(champion.wins)],
    [t('drv.podiums'), String(champion.podiums)],
  ]
  if (champion.lead != null) stats.push([t('home.lead'), `+${champion.lead}`])
  return (
    <NumberHero
      driverId={champion.driverId}
      constructorId={champion.constructorId}
      number={champion.number}
      season={champion.season}
      image={{ heroImage: null, heroSrcSet: null, heroSizes }}
      eager={false}
      className="hero-champion"
    >
      <span className="hero-chip">{t('home.worldChampionship')}</span>
      <p className="hero-kicker">
        <span className="mono">{champion.season}</span>
        <span>{t('home.decidedAt', { gp: gpTitle(champion.decidedGrandPrixName, lang) })}</span>
      </p>
      {/* The page's h1 is the first slide's headline. */}
      <h2 className="hero-title">
        {lastName(champion.driverName)} <span>{t('home.champion')}</span>
      </h2>
      <dl className="champ-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Link to={`/drivers/${champion.driverId}`} className="hero-cta">
        {t('home.driverProfile')}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </NumberHero>
  )
}

// The latest finished session of the weekend, until the race is in f1db.
function SessionHeroView({ session, image }: { session: SessionHero; image: HeroImage }) {
  if (session.kind === 'practice') return <PracticeHero session={session} image={image} />
  if (session.kind === 'qualifying') return <PoleHero session={session} image={image} />
  const race: RaceHighlight = {
    season: session.season,
    round: session.round,
    grandPrixName: session.grandPrixName,
    date: '',
    countryCode: null,
    podium: session.top.map((r) => ({
      ...r,
      driverId: r.driverId ?? '',
      constructorId: r.constructorId ?? '',
      countryCode: null,
      points: null,
    })),
  }
  return <WinnerHero race={race} sprint={session.sprint} fromSession headshot={session.top[0].headshot} image={image} />
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
  const { t } = useI18n()
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
  const mainHero = data?.session ? (
    <SessionHeroView session={data.session} image={data} />
  ) : data?.highlights.latestRace ? (
    <WinnerHero race={data.highlights.latestRace} retirement={data.highlights.notableRetirement} image={data} />
  ) : (
    <FallbackHero />
  )

  return (
    <section>
      <div className="home-top">
        {loading ? (
          <HeroSkeleton />
        ) : data?.highlights.champion ? (
          <HeroSlider
            label={t('home.highlights')}
            slides={[
              {
                key: 'main',
                label: data.session ? sessionLabel(data.session.sessionName, t) : t('session.race'),
                node: mainHero,
              },
              {
                key: 'champion',
                label: t('home.worldChampionship'),
                node: <ChampionHero champion={data.highlights.champion} heroSizes={data.heroSizes} />,
              },
            ]}
          />
        ) : (
          mainHero
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
