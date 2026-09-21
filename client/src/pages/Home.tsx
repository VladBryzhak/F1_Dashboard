import type { CSSProperties, SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import { Headshot } from '../components/EntityCards'
import { useAsync } from '../hooks/useAsync'
import { api } from '../api/client'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import type { HomeHighlights, NewsItem, RaceHighlight } from '../types/f1'

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

const SECTIONS = [
  { to: '/standings', label: 'Standings', desc: 'Drivers & constructors' },
  { to: '/calendar', label: 'Calendar', desc: 'Races & results' },
  { to: '/drivers', label: 'Drivers', desc: 'Grid profiles' },
  { to: '/teams', label: 'Teams', desc: 'Constructor line-up' },
  { to: '/compare', label: 'Compare', desc: 'Driver head-to-head' },
  { to: '/telemetry', label: 'Telemetry', desc: 'Speed & lap traces' },
]

function lastName(full: string): string {
  const parts = full.trim().split(' ')
  return parts.length > 1 ? parts.slice(1).join(' ') : full
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// Dynamic hero focused on the latest race winner.
function WinnerHero({ highlights }: { highlights: HomeHighlights }) {
  const race = highlights.latestRace as RaceHighlight
  const winner = race.podium.find((p) => p.position === 1) ?? race.podium[0]
  const color = teamColor(winner.constructorId)
  const portrait = driverPortraitUrl(
    winner.driverId,
    winner.constructorId,
    String(race.season),
  )

  return (
    <div className="hero hero-winner" style={{ '--team': color } as CSSProperties}>
      <Headshot portraitUrl={portrait} color={color} />
      <div className="hero-content hero-content--winner">
        <p className="hero-kicker">
          {race.season} · Round {race.round} · {race.grandPrixName} GP
        </p>
        <h1 className="hero-title">
          {lastName(winner.driverName)} <span>wins</span>
        </h1>

        <div className="podium-row">
          {race.podium.map((p) => (
            <span className="podium-chip" key={p.position}>
              <span className="podium-pos">P{p.position}</span>
              <span
                className="dot"
                style={{ background: teamColor(p.constructorId) }}
              />
              {p.driverCode ?? lastName(p.driverName)}
            </span>
          ))}
        </div>

        {highlights.notableRetirement && (
          <p className="hero-note">
            <span className="hero-note-tag">Incident</span>
            {highlights.notableRetirement.driverName} —{' '}
            {highlights.notableRetirement.reason}
          </p>
        )}

        {highlights.nextRace && (
          <p className="hero-next">
            Next up · {highlights.nextRace.grandPrixName} GP ·{' '}
            {formatDate(highlights.nextRace.date)}
          </p>
        )}
      </div>
    </div>
  )
}

// Off-season / no-race fallback: the static title-fight poster.
function TitleFightHero() {
  return (
    <div className="hero">
      <div className="hero-side hero-left">
        <img
          className="hero-photo"
          src={ANTONELLI_SRC}
          onError={fallbackTo(ANTONELLI_FALLBACK)}
          alt="Kimi Antonelli on the podium"
        />
      </div>
      <div className="hero-side hero-right">
        <img
          className="hero-photo"
          src={HAMILTON_SRC}
          onError={fallbackTo(HAMILTON_FALLBACK)}
          alt="Lewis Hamilton celebrating with a trophy"
        />
      </div>

      <div className="hero-veil" />

      <div className="hero-content">
        <p className="hero-kicker">2026 Title Fight</p>
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
        <p className="hero-tag">
          Silver Arrows meet the Scuderia — Antonelli and Hamilton trade blows
          for the 2026 crown.
        </p>
      </div>
    </div>
  )
}

function NewsStrip({ news }: { news: NewsItem[] }) {
  if (!news.length) return null
  return (
    <section className="news-strip">
      <div className="news-head">
        <h2>Latest F1 news</h2>
        <span className="news-src">via {news[0].source}</span>
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
              {n.source} · {timeAgo(n.pubDate)}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const { data } = useAsync(() => api.home(), [])
  const hasRace = !!data?.highlights.latestRace

  return (
    <section>
      {hasRace ? <WinnerHero highlights={data!.highlights} /> : <TitleFightHero />}

      {data && <NewsStrip news={data.news} />}

      <div className="home-links">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="home-link">
            <span className="hl-label">{s.label}</span>
            <span className="hl-desc">{s.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
