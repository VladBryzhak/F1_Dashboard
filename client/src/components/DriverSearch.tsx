import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import Flag from './Flag'
import { useI18n } from '../i18n/core'
import { countryName } from '../lib/countries'
import './EntitySearch.css'

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950]

// Search across every F1 driver since 1950 by name, with nationality and era
// filters. The full list (~860 drivers) is small enough to filter in the browser.
export default function DriverSearch() {
  const { data, loading, error } = useAsync(() => api.drivers(), [])
  // Photos load separately so the list renders instantly; they pop in after.
  const photos = useAsync(() => api.driverPhotos(), [])
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
            {tn('plural.driversN', results.length)}
            {results.length > shown.length && `, ${t('ds.showingFirst', { n: shown.length })}`}
          </p>
          {results.length === 0 ? (
            <p className="muted">{t('ds.noMatch')}</p>
          ) : (
            <div className="ds-results">
              {shown.map((d) => {
                const photo = photos.data?.[d.driverId]
                return (
                  <Link
                    key={d.driverId}
                    to={`/drivers/${d.driverId}`}
                    className="ds-card"
                  >
                    {photo ? (
                      <img
                        className="ds-photo"
                        src={photo}
                        alt={d.name}
                        loading="lazy"
                      />
                    ) : (
                      <span className="ds-photo ds-photo--none" aria-hidden="true">
                        {d.name.charAt(0)}
                      </span>
                    )}
                    <span className="ds-info">
                      <span className="ds-name">{d.name}</span>
                      <span className="ds-sub">
                        <Flag code={d.countryCode} nationality={d.nationality} />
                        {lang === 'uk' && d.countryCode ? countryName(d.countryCode, locale) : d.nationality},{' '}
                        {d.firstSeason}-{d.lastSeason}
                      </span>
                      <span className="ds-stats muted">
                        {tn('plural.racesN', d.races)}, {tn('plural.podiumsN', d.podiums)}
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
