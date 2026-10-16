import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Flag from '../components/Flag'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { countryName } from '../lib/countries'
import type { CircuitSummary } from '../types/f1'

function CircuitTile({ c }: { c: CircuitSummary }) {
  const { t, tn, locale } = useI18n()
  const years =
    c.firstYear == null
      ? ''
      : c.onCurrentCalendar
        ? t('circ.since', { year: c.firstYear })
        : t('circ.years', { from: c.firstYear, to: c.lastYear ?? c.firstYear })
  return (
    <Link to={`/circuits/${c.circuitId}`} className="circuit-tile">
      <span className="circuit-tile-top">
        <Flag code={c.countryCode} nationality={c.nationality} />
        <span className="circuit-tile-place">
          {c.placeName}
          {c.countryCode ? ` · ${countryName(c.countryCode, locale)}` : ''}
        </span>
      </span>
      <span className="circuit-tile-name">{c.name}</span>
      <span className="circuit-tile-meta">
        <span>{t(`circ.type.${c.type}` as TKey)}</span>
        <span>{tn('plural.races', c.racesHeld)}</span>
        {years && <span>{years}</span>}
      </span>
    </Link>
  )
}

export default function Circuits() {
  const { t, locale } = useI18n()
  useSeo({
    title: 'F1 Circuits — Every Formula 1 Track',
    description:
      'Every Formula 1 circuit since 1950: track length, turns, race lap records, layouts and the full list of winners at each venue.',
  })
  const { data, loading, error } = useAsync(() => api.circuits(), [])
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const list = data ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter((c) =>
      [c.name, c.placeName, countryName(c.countryCode, locale), countryName(c.countryCode, 'en')]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [data, q, locale])

  const current = filtered.filter((c) => c.onCurrentCalendar)
  const historic = filtered.filter((c) => !c.onCurrentCalendar)
  const season = data?.reduce((m, c) => Math.max(m, c.lastYear ?? 0), 0) ?? ''

  return (
    <section>
      <div className="page-head">
        <h1>{t('circ.listTitle')}</h1>
      </div>

      <input
        type="search"
        className="search-input circuit-search"
        placeholder={t('circ.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t('circ.search')}
      />

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && error && <p className="banner">{t('circ.loadError', { error })}</p>}

      {data && filtered.length === 0 && <p className="muted">{t('circ.noMatch', { q })}</p>}

      {current.length > 0 && (
        <>
          <h2 className="section-title">{t('circ.current', { season })}</h2>
          <div className="circuit-grid">
            {current.map((c) => (
              <CircuitTile key={c.circuitId} c={c} />
            ))}
          </div>
        </>
      )}

      {historic.length > 0 && (
        <>
          <h2 className="section-title">{t('circ.historic')}</h2>
          <div className="circuit-grid">
            {historic.map((c) => (
              <CircuitTile key={c.circuitId} c={c} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
