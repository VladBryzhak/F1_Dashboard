import { useState } from 'react'
import { api } from '../api/client'
import Flag from '../components/Flag'
import RaceResultModal from '../components/RaceResultModal'
import SeasonSelect from '../components/SeasonSelect'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'
import { CURRENT_SEASON } from '../lib/seasons'
import type { CalendarRace } from '../types/f1'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function Calendar() {
  const [season, setSeason] = useState(String(CURRENT_SEASON))
  const [selected, setSelected] = useState<CalendarRace | null>(null)
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.races.map((r) => (
                <tr
                  key={r.round}
                  className="row-clickable"
                  onClick={() => setSelected(r)}
                  title={`View ${r.name} results`}
                >
                  <td>
                    <span className="entity">
                      <Flag code={r.countryCode} nationality={r.nationality} />
                      <span className="name" style={{ marginLeft: '0.65rem' }}>
                        {r.name}
                      </span>
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
                  <td className="muted chevron">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <RaceResultModal
          season={season}
          round={selected.round}
          title={`${selected.name} ${season}`}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}
