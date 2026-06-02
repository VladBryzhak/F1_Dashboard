import { Link } from 'react-router-dom'

const F1 = 'https://media.formula1.com/image/upload/c_lfill,w_600/q_auto/v1740000001/common/f1'
const HAMILTON = `${F1}/2026/ferrari/lewham01/2026ferrarilewham01right.webp`
const VERSTAPPEN = `${F1}/2026/redbullracing/maxver01/2026redbullracingmaxver01left.webp`

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
        <img className="hero-driver hero-left" src={HAMILTON} alt="Lewis Hamilton" />
        <img className="hero-driver hero-right" src={VERSTAPPEN} alt="Max Verstappen" />
        <div className="hero-content">
          <p className="hero-kicker">2026 Season</p>
          <h1 className="hero-title">
            F1 <span>DASHBOARD</span>
          </h1>
          <p className="hero-tag">
            Standings, races, profiles and live telemetry — all in one place.
          </p>
          <div className="hero-vs">
            <span className="vs-name vs-ham">Hamilton</span>
            <span className="vs-dot">vs</span>
            <span className="vs-name vs-ver">Verstappen</span>
          </div>
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
