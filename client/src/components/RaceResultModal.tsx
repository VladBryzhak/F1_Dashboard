import { useEffect } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'
import Flag from './Flag'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function RaceResultModal({
  season,
  round,
  title,
  onClose,
}: {
  season: string
  round: number
  title: string
  onClose: () => void
}) {
  const { data, loading, error } = useAsync(
    () => api.raceResults(season, round),
    [season, round],
  )

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {data && (
              <p className="modal-sub">
                Round {round} · {formatDate(data.date)}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="muted">Loading results…</p>}
          {!loading && error && (
            <p className="banner">Could not load results: {error}</p>
          )}
          {!loading && data && data.results.length === 0 && (
            <p className="muted">No results yet — this race hasn’t run.</p>
          )}
          {!loading && data && data.results.length > 0 && (
            <table className="standings">
              <thead>
                <tr>
                  <th className="pos">Pos</th>
                  <th>Driver</th>
                  <th>Team</th>
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
                        {r.driverCode ? (
                          <span className="code">{r.driverCode}</span>
                        ) : null}
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
                    <td className="muted">{r.timeDisplay}</td>
                    <td className="num points">{r.points || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
