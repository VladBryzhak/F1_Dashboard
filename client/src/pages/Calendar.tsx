import { useState } from 'react'
import { api } from '../api/client'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { flagFor, teamColor } from '../lib/f1meta'
import { CURRENT_SEASON } from '../lib/seasons'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function Calendar() {
  const [season, setSeason] = useState(String(CURRENT_SEASON))
  const { data, loading, error } = useAsync(() => api.calendar(season), [season])

  return (
    <section>
      <div className="page-head">
        <h1>{season} Race Results</h1>
        <SeasonSelect value={season} onChange={setSeason} />
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && error && (
        <p className="banner">Could not load the calendar: {error}</p>
      )}

      {!loading && data && (
        <div className="card">
          <table className="standings">
            <thead>
              <tr>
                <th>Grand Prix</th>
                <th>Date</th>
                <th>Winner</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {data.races.map((r) => (
                <tr key={r.round}>
                  <td>
                    <span className="entity">
                      <span className="badge">{flagFor(r.nationality)}</span>
                      <span className="name">{r.name}</span>
                    </span>
                  </td>
                  <td className="muted">{formatDate(r.date)}</td>
                  <td>
                    {r.winnerName ? (
                      <span className="name">{r.winnerName}</span>
                    ) : (
                      <span className="muted">Upcoming</span>
                    )}
                  </td>
                  <td>
                    {r.winnerConstructorName ? (
                      <span className="team">
                        <span
                          className="dot"
                          style={{
                            background: teamColor(r.winnerConstructorId ?? ''),
                          }}
                        />
                        {r.winnerConstructorName}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
