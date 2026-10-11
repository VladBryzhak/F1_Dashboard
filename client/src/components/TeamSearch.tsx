import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'
import Flag from './Flag'

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950]

// Search across every F1 constructor since 1950 by name, with nationality and
// era filters. The full list is small enough to filter in the browser.
export default function TeamSearch() {
  const { data, loading, error } = useAsync(() => api.constructors(), [])
  // Logos/photos load separately so the list renders instantly; they pop in
  // after. Only teams with a free (PD/CC) image appear here; the rest keep the
  // colour tile.
  const images = useAsync(() => api.teamImages(), [])
  const [q, setQ] = useState('')
  const [nat, setNat] = useState('')
  const [decade, setDecade] = useState('')

  const nationalities = useMemo(
    () =>
      [...new Set((data ?? []).map((c) => c.nationality).filter(Boolean))].sort(),
    [data],
  )

  const results = useMemo(() => {
    let list = data ?? []
    const ql = q.trim().toLowerCase()
    if (ql) list = list.filter((c) => c.name.toLowerCase().includes(ql))
    if (nat) list = list.filter((c) => c.nationality === nat)
    if (decade) {
      const start = Number(decade)
      const end = start + 9
      // Active at any point in that decade.
      list = list.filter((c) => c.firstSeason <= end && c.lastSeason >= start)
    }
    return list
  }, [data, q, nat, decade])

  const shown = results.slice(0, 120)

  return (
    <div className="driver-search">
      <div className="ds-controls">
        <input
          className="ds-input"
          type="search"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search teams by name"
        />
        <select
          value={nat}
          onChange={(e) => setNat(e.target.value)}
          aria-label="Nationality"
        >
          <option value="">All nationalities</option>
          {nationalities.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={decade}
          onChange={(e) => setDecade(e.target.value)}
          aria-label="Era"
        >
          <option value="">All eras</option>
          {DECADES.map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">Loading teams…</p>}
      {error && <p className="banner">Could not load teams: {error}</p>}

      {!loading && !error && (
        <>
          <p className="ds-count muted">
            {results.length} team{results.length === 1 ? '' : 's'}
            {results.length > shown.length && ` · showing first ${shown.length}`}
          </p>
          {results.length === 0 ? (
            <p className="muted">No teams match those filters.</p>
          ) : (
            <div className="ds-results">
              {shown.map((c) => {
                const img = images.data?.[c.constructorId]
                return (
                <Link
                  key={c.constructorId}
                  to={`/teams/${c.constructorId}`}
                  className="ds-card"
                >
                  {img ? (
                    <img
                      className={`ds-photo ds-photo--${img.type}`}
                      src={img.url}
                      alt={`${c.name} ${img.type === 'logo' ? 'logo' : 'car'}`}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="ds-photo ds-photo--team"
                      style={{ background: teamColor(c.constructorId) }}
                      aria-hidden="true"
                    >
                      {c.name.charAt(0)}
                    </span>
                  )}
                  <span className="ds-info">
                    <span className="ds-name">{c.name}</span>
                    <span className="ds-sub">
                      <Flag code={c.countryCode} nationality={c.nationality} />
                      {c.nationality} · {c.firstSeason}–{c.lastSeason}
                    </span>
                    <span className="ds-stats muted">
                      {c.races} races · {c.podiums} podiums
                    </span>
                  </span>
                </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
