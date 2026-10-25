import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/f1meta'
import Flag from './Flag'
import { useI18n } from '../i18n/core'
import { countryName } from '../lib/countries'
import './EntitySearch.css'

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
  const { t, tn, lang, locale } = useI18n()

  // Filter values stay the f1db demonym; labels follow the interface language
  // (country names in Ukrainian).
  const nationalities = useMemo(() => {
    const byNat = new Map<string, string | null>()
    for (const x of data ?? []) if (x.nationality) byNat.set(x.nationality, x.countryCode)
    return [...byNat.entries()]
      .map(([value, code]) => ({
        value,
        label: lang === 'uk' && code ? countryName(code, locale) : value,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [data, lang, locale])

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
          placeholder={t('ds.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('ds.placeholder')}
        />
        <select
          value={nat}
          onChange={(e) => setNat(e.target.value)}
          aria-label={t('ds.nationality')}
        >
          <option value="">{t('ds.allNationalities')}</option>
          {nationalities.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
        <select
          value={decade}
          onChange={(e) => setDecade(e.target.value)}
          aria-label={t('ds.era')}
        >
          <option value="">{t('ds.allEras')}</option>
          {DECADES.map((d) => (
            <option key={d} value={d}>
              {t('ds.decade', { d })}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {error && <p className="banner">{t('ds.loadError', { error })}</p>}

      {!loading && !error && (
        <>
          <p className="ds-count muted">
            {tn('plural.teamsN', results.length)}
            {results.length > shown.length && `, ${t('ds.showingFirst', { n: shown.length })}`}
          </p>
          {results.length === 0 ? (
            <p className="muted">{t('ds.noMatch')}</p>
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
                      {lang === 'uk' && c.countryCode ? countryName(c.countryCode, locale) : c.nationality},{' '}
                      {c.firstSeason}-{c.lastSeason}
                    </span>
                    <span className="ds-stats muted">
                      {tn('plural.racesN', c.races)}, {tn('plural.podiumsN', c.podiums)}
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
