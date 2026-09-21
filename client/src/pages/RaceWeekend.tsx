import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'
import type { WeekendHighlight } from '../types/f1'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Highlight({
  label,
  name,
  constructorId,
  detail,
}: {
  label: string
  name: string
  constructorId: string
  detail: string
}) {
  return (
    <div className="wknd-hl">
      <span className="stripe" style={{ background: teamColor(constructorId) }} />
      <div className="wknd-hl-label">{label}</div>
      <div className="wknd-hl-name">{name}</div>
      <div className="wknd-hl-detail muted">{detail}</div>
    </div>
  )
}

// A colored ± delta for grid → finish.
function Delta({ n }: { n: number | null }) {
  if (n == null || n === 0) return <span className="muted">—</span>
  const up = n > 0
  return (
    <span className={up ? 'delta up' : 'delta down'}>
      {up ? '▲' : '▼'} {Math.abs(n)}
    </span>
  )
}

export default function RaceWeekend() {
  const { season = '', round = '' } = useParams()
  const { data, loading, error } = useAsync(
    () => api.raceWeekend(season, Number(round)),
    [season, round],
  )

  const pole =
    data?.qualifying.find((q) => q.position === 1) ?? data?.qualifying[0]

  const highlights: { label: string; h: WeekendHighlight | null; detail?: string }[] =
    data
      ? [
          {
            label: 'Pole position',
            h: pole
              ? {
                  driverId: pole.driverId,
                  driverName: pole.driverName,
                  constructorId: pole.constructorId,
                  constructorName: pole.constructorName,
                  detail: pole.q3 ?? pole.q2 ?? pole.q1 ?? '',
                }
              : null,
          },
          { label: 'Fastest lap', h: data.fastestLap },
          { label: 'Driver of the Day', h: data.driverOfTheDay },
        ]
      : []

  return (
    <section>
      <div className="page-head">
        <Link to="/calendar" className="back-link">
          ← Calendar
        </Link>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && error && (
        <p className="banner">Could not load the race weekend: {error}</p>
      )}

      {!loading && data && (
        <>
          <div className="wknd-title">
            <Flag code={data.countryCode} nationality="" />
            <div>
              <h1>{data.grandPrixName} GP</h1>
              <p className="muted">
                {data.season} · Round {data.round} · {formatDate(data.date)}
              </p>
            </div>
          </div>

          <div className="wknd-highlights">
            {highlights.map(
              ({ label, h }) =>
                h && (
                  <Highlight
                    key={label}
                    label={label}
                    name={h.driverName}
                    constructorId={h.constructorId}
                    detail={h.detail}
                  />
                ),
            )}
          </div>

          {data.results.length > 0 && (
            <div className="card">
              <h3 className="wknd-section">Race result</h3>
              <div className="table-scroll">
                <table className="standings">
                  <thead>
                    <tr>
                      <th className="pos">Pos</th>
                      <th>Driver</th>
                      <th>Team</th>
                      <th className="num">Grid</th>
                      <th className="num">+/−</th>
                      <th>Time / Gap</th>
                      <th className="num">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => (
                      <tr key={r.driverId}>
                        <td className="pos">{r.positionText}</td>
                        <td>
                          <span className="country">
                            <Flag code={r.countryCode} nationality={r.nationality} />
                            <span className="name">{r.driverName}</span>
                            {r.driverCode && <span className="code">{r.driverCode}</span>}
                          </span>
                        </td>
                        <td>
                          <span className="team">
                            <span
                              className="dot"
                              style={{ background: teamColor(r.constructorId) }}
                            />
                            {r.constructorName}
                          </span>
                        </td>
                        <td className="num muted">{r.gridPosition ?? '—'}</td>
                        <td className="num">
                          <Delta n={r.positionsGained} />
                        </td>
                        <td className="muted">{r.timeDisplay}</td>
                        <td className="num points">{r.points || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.qualifying.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h3 className="wknd-section">Qualifying</h3>
              <div className="table-scroll">
                <table className="standings">
                  <thead>
                    <tr>
                      <th className="pos">Pos</th>
                      <th>Driver</th>
                      <th>Team</th>
                      <th>Q1</th>
                      <th>Q2</th>
                      <th>Q3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.qualifying.map((q) => (
                      <tr key={q.driverId}>
                        <td className="pos">{q.position ?? '—'}</td>
                        <td>
                          <span className="name">{q.driverName}</span>
                          {q.driverCode && <span className="code">{q.driverCode}</span>}
                        </td>
                        <td>
                          <span className="team">
                            <span
                              className="dot"
                              style={{ background: teamColor(q.constructorId) }}
                            />
                            {q.constructorName}
                          </span>
                        </td>
                        <td className="muted">{q.q1 ?? '—'}</td>
                        <td className="muted">{q.q2 ?? '—'}</td>
                        <td className="muted">{q.q3 ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
