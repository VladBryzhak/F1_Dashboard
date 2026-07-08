import type { SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'

const F1 = 'https://media.formula1.com/image/upload/c_lfill,w_600/q_auto/v1740000001/common/f1'

// Podium photos live in /public; if one is missing we fall back to the official
// transparent driver render from formula1.com.
const ANTONELLI_SRC = '/home-antonelli.webp'
const ANTONELLI_FALLBACK = `${F1}/2026/mercedes/andant01/2026mercedesandant01right.webp`
const HAMILTON_SRC = '/home-hamilton.jpg'
const HAMILTON_FALLBACK = `${F1}/2026/ferrari/lewham01/2026ferrarilewham01left.webp`

// Swap to the official render once, without looping if that also fails.
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
  { to: '/telemetry', label: 'Telemetry', desc: 'Speed & lap traces' },
]

export default function Home() {
  return (
    <section>
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
