import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import Flag from './Flag'

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950]

// Search across every F1 driver since 1950 by name, with nationality and era
// filters. The full list (~860 drivers) is small enough to filter in the browser.
export default function DriverSearch() {
  const { data, loading, error } = useAsync(() => api.drivers(), [])
  const [q, setQ] = useState('')
  const [nat, setNat] = useState('')
  const [decade, setDecade] = useState('')

  const nationalities = useMemo(
    () =>
      [...new Set((data ?? []).map((d) => d.nationality).filter(Boolean))].sort(),
    [data],
  )

  const results = useMemo(() => {
    let list = data ?? []
    const ql = q.trim().toLowerCase()
    if (ql) list = list.filter((d) => d.name.toLowerCase().includes(ql))
    if (nat) list = list.filter((d) => d.nationality === nat)
    if (decade) {
      const start = Number(decade)
      const end = start + 9
      // Active at any point in that decade.
      list = list.filter((d) => d.firstSeason <= end && d.lastSeason >= start)
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
          aria-label="Search drivers by name"
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

      {loading && <p className="muted">Loading drivers…</p>}
      {error && <p className="banner">Could not load drivers: {error}</p>}

      {!loading && !error && (
        <>
          <p className="ds-count muted">
            {results.length} driver{results.length === 1 ? '' : 's'}
            {results.length > shown.length && ` · showing first ${shown.length}`}
          </p>
          {results.length === 0 ? (
            <p className="muted">No drivers match those filters.</p>
          ) : (
            <div className="ds-results">
              {shown.map((d) => (
                <Link
                  key={d.driverId}
                  to={`/drivers/${d.driverId}`}
                  className="ds-card"
                >
                  <span className="ds-name">{d.name}</span>
                  <span className="ds-sub">
                    <Flag code={d.countryCode} nationality={d.nationality} />
                    {d.nationality} · {d.firstSeason}–{d.lastSeason}
                  </span>
                  <span className="ds-stats muted">
                    {d.races} races · {d.podiums} podiums
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
