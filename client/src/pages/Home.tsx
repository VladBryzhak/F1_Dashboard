import { useEffect, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import CircuitOutline from '../components/CircuitOutline'
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

// Home page, "timing screen" design: graphite surfaces cut by hairlines,
// readings (points, gaps, dates, car numbers) in a monospace face, team
// colours only as swatches beside the driver they belong to, and F1 red kept
// for the one action on each screen. Data wiring is unchanged: the server
// inlines /api/home into the HTML on a direct visit (see pageHtml.ts).

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

// First screen: the result in words on the left, the timing panel on the
// right (the winner over their car number, then the podium as timing rows).
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
  const second = race.podium.find((p) => p.position === 2)
  const third = race.podium.find((p) => p.position === 3)
  const color = teamColor(winner.constructorId)
  // The server names the same photo in the HTML (preload), so prefer its URL.
  const portrait =
    heroImage ?? driverPortraitUrl(winner.driverId, winner.constructorId, String(race.season))
  const [photoOk, setPhotoOk] = useState(true)

  return (
    <section className="hm-hero" style={{ '--team': color } as CSSProperties}>
      <div className="hm-hero-text">
        <h1 className="hm-display">{t('home.winnerHead', { name: lastName(winner.driverName) })}</h1>
        <p className="hm-lead">
          {t('home.raceLine', {
            gp: gpTitle(race.grandPrixName, lang),
            season: race.season,
            round: race.round,
          })}{' '}
          {second && third
            ? t('home.podiumLine', {
                p2: lastName(second.driverName),
                p3: lastName(third.driverName),
              })
            : null}
        </p>
        <Link to={`/calendar/${race.season}/${race.round}`} className="hm-btn hm-btn--primary">
          {t('home.viewWeekend')}
        </Link>
      </div>

      <figure className="hm-panel hm-timing">
        <div className="hm-portrait">
          {winner.number && (
            <span className="hm-carnum" aria-hidden="true">
              {winner.number}
            </span>
          )}
          {portrait && photoOk && (
            <img
              src={portrait}
              srcSet={heroImage && heroSrcSet ? heroSrcSet : undefined}
              sizes={heroImage && heroSrcSet ? heroSizes : undefined}
              alt={winner.driverName}
              loading="eager"
              ref={(el) => {
                // Set fetchpriority via the DOM so React 18.3 doesn't warn on the prop.
                if (el) el.setAttribute('fetchpriority', 'high')
              }}
              onError={() => setPhotoOk(false)}
            />
          )}
        </div>
        <ol className="hm-podium" aria-label={t('home.podium')}>
          {race.podium.map((p) => (
            <li key={p.position}>
              <span className="hm-pos">P{p.position}</span>
              <span
                className="hm-swatch"
                style={{ background: teamColor(p.constructorId) }}
                aria-hidden="true"
              />
              <span className="hm-code">{p.driverCode ?? lastName(p.driverName)}</span>
              <span className="hm-name">{p.driverName}</span>
              <span className="hm-team">{p.constructorName}</span>
            </li>
          ))}
          {highlights.notableRetirement && (
            <li className="hm-out">
              <span className="hm-pos">{t('home.retired')}</span>
              <span className="hm-name">
                {highlights.notableRetirement.driverName},{' '}
                {retirementReason(highlights.notableRetirement.reason, lang)}
              </span>
            </li>
          )}
        </ol>
      </figure>
    </section>
  )
}

// Drivers' championship, top 5, as a timing table: position, driver, points
// and the gap to the leader, with a bar for each driver's share of the
// leader's points (one series, in the instrument colour).
function Championship({ rows, season }: { rows: DriverStanding[]; season?: number }) {
  const { t, fmtNum } = useI18n()
  if (!rows.length) return null
  const top = Math.max(rows[0].points, 1)
  return (
    <section className="hm-section">
      <div className="hm-head">
        <h2>{t('home.standingsHead', { season: season ?? '' })}</h2>
      </div>
      <div className="hm-panel">
        <table className="hm-table">
          <thead>
            <tr>
              <th scope="col">{t('home.colPos')}</th>
              <th scope="col">{t('home.colDriver')}</th>
              <th scope="col" className="hm-bar-col">
                <span className="visually-hidden">{t('home.colShare')}</span>
              </th>
              <th scope="col" className="num">
                {t('home.colPoints')}
              </th>
              <th scope="col" className="num">
                {t('home.colGap')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const pct = Math.max(1, Math.min(100, (d.points / top) * 100))
              const gap = rows[0].points - d.points
              return (
                <tr key={d.driverId}>
                  <td className="hm-pos">{d.position}</td>
                  <td>
                    <span className="hm-driver">
                      <span
                        className="hm-swatch"
                        style={{ background: teamColor(d.constructorId) }}
                        aria-hidden="true"
                      />
                      <Link to={`/drivers/${d.driverId}`}>
                        {initialName(d.givenName, d.familyName)}
                      </Link>
                      <span className="hm-team">{d.constructorName}</span>
                    </span>
                  </td>
                  <td className="hm-bar-col" aria-hidden="true">
                    <span className="hm-bar">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </td>
                  <td className="num hm-reading">{fmtNum(d.points)}</td>
                  <td className="num hm-reading hm-gap">
                    {gap === 0 ? t('home.leader') : `−${fmtNum(gap)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// The next race as a band on the deepest surface: the date as a reading, the
// Grand Prix and the place, and the circuit drawn large.
function NextRaceBand({ race }: { race: NextRace }) {
  const { t, lang, fmtDate } = useI18n()
  const day = fmtDate(race.date, { day: '2-digit' })
  const month = fmtDate(race.date, { month: 'short' }).replace('.', '')
  return (
    <section className="hm-band">
      <div className="hm-band-inner">
        <div className="hm-next-text">
          <h2>{t('home.nextRace')}</h2>
          <p className="hm-date">
            <span className="hm-date-day">{day}</span>
            <span className="hm-date-month">{month}</span>
          </p>
          <p className="hm-next-gp">{gpTitle(race.grandPrixName, lang)}</p>
          {race.placeName && <p className="hm-next-place">{race.placeName}</p>}
          {/* Opens the calendar with this race's weekend schedule expanded. */}
          <Link to={`/calendar?schedule=${race.round}`} className="hm-btn">
            {t('home.schedule')}
          </Link>
        </div>
        {race.outline && (
          <div className="hm-panel hm-circuit">
            <CircuitOutline
              outline={race.outline}
              label={t('circ.outlineOf', { name: race.placeName || race.grandPrixName })}
            />
          </div>
        )}
      </div>
    </section>
  )
}

// Off-season / no-race fallback: the static title-fight poster.
function TitleFightHero() {
  const { t } = useI18n()
  return (
    <section className="hm-hero">
      <div className="hm-hero-text">
        <h1 className="hm-display">{t('home.titleFight')}</h1>
        <p className="hm-lead">{t('home.titleFightTag')}</p>
        <Link to="/standings" className="hm-btn hm-btn--primary">
          {t('home.allStandings')}
        </Link>
      </div>
      <div className="hm-panel hm-duo">
        <img
          src={ANTONELLI_SRC}
          onError={fallbackTo(ANTONELLI_FALLBACK)}
          alt={t('home.altAntonelli')}
        />
        <img src={HAMILTON_SRC} onError={fallbackTo(HAMILTON_FALLBACK)} alt={t('home.altHamilton')} />
      </div>
    </section>
  )
}

function NewsIndex({ news }: { news: NewsItem[] }) {
  const { t, locale } = useI18n()
  if (!news.length) return null
  return (
    <section className="hm-section">
      <div className="hm-head">
        <h2>{t('home.news')}</h2>
        <p className="hm-note">{t('home.via', { source: news[0].source })}</p>
      </div>
      <ol className="hm-panel hm-news">
        {news.map((n) => (
          <li key={n.link}>
            <a href={n.link} target="_blank" rel="noopener noreferrer">
              <time className="hm-reading" dateTime={n.pubDate}>
                {timeAgo(n.pubDate, locale)}
              </time>
              <span className="hm-news-title">{n.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Placeholders while /api/home loads (only when the HTML came without the
// inlined data): the same frames, so nothing below jumps when data arrives.
function HeroSkeleton() {
  const { t } = useI18n()
  return (
    <section className="hm-hero hm-skeleton" aria-busy="true" aria-label={t('home.loadingRace')}>
      <p className="hm-lead">{t('home.loadingRace')}</p>
      <div className="hm-panel hm-timing" />
    </section>
  )
}

function NewsSkeleton() {
  const { t } = useI18n()
  return (
    <section className="hm-section" aria-hidden="true">
      <div className="hm-head">
        <h2>{t('home.news')}</h2>
      </div>
      <ol className="hm-panel hm-news hm-news--skeleton">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} />
        ))}
      </ol>
    </section>
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
    <div className="home">
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

      <Championship rows={data?.standings ?? []} season={season} />
      {data?.highlights.nextRace && <NextRaceBand race={data.highlights.nextRace} />}
      {data?.news ? <NewsIndex news={data.news} /> : !failed && <NewsSkeleton />}
    </div>
  )
}
