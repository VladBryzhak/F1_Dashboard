import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { breadcrumbLd } from '../lib/jsonld'
import { teamColor } from '../lib/f1meta'
import { ageText } from '../lib/age'
import { gpTitle } from '../lib/gpNames'
import { seoText } from '../lib/seoText'
import { UK_DRIVER_NAMES } from '../lib/ukNames'
import type { RecordEntry } from '../types/f1'
import './Records.css'

// All-time records: the top ten of each, from the same numbers the profiles
// show (titles from completed seasons only). The crawler text mirrors this
// page (server/src/services/snapshot.ts, recordsPage).

function List({
  title,
  rows,
  kind,
  value,
  detail,
  bars = true,
}: {
  title: string
  rows: RecordEntry[]
  kind: 'driver' | 'team'
  value: (e: RecordEntry) => string
  detail?: (e: RecordEntry) => string
  bars?: boolean // off where less is the record (youngest winners)
}) {
  const { lang } = useI18n()
  const top = rows[0]?.value || 1
  return (
    <div className="card rec-card">
      <h2 className="wknd-section">{title}</h2>
      <ol className="rec-list">
        {rows.map((e) => (
          <li key={`${e.id}-${e.season ?? ''}`}>
            <span className="rec-rank">{e.rank}</span>
            <span className="rec-who">
              <Link to={`/${kind === 'driver' ? 'drivers' : 'teams'}/${e.id}`}>
                {(kind === 'driver' && lang === 'uk' && UK_DRIVER_NAMES[e.id]?.join(' ')) || e.name}
              </Link>
              {detail && <span className="rec-detail">{detail(e)}</span>}
            </span>
            <span className="rec-val">{value(e)}</span>
            {/* a bar to the leader, in a neutral tone (teams in their colour) */}
            {bars && <span
              className="rec-bar"
              style={{
                width: `calc((100% - 2.5rem) * ${Math.max(0.06, e.value / top).toFixed(3)})`,
                ...(kind === 'team' ? { background: teamColor(e.id) } : {}),
              }}
              aria-hidden="true"
            />}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function Records() {
  const { t, lang } = useI18n()
  const { data, loading, error } = useAsync(() => api.records(), [])
  const uk = lang === 'uk'
  useSeo({
    ...seoText.records(lang),
    jsonLd: [
      breadcrumbLd([
        { name: t('nav.home'), path: '/' },
        { name: t('rec.title'), path: '/records' },
      ]),
    ],
  })
  const num = (e: RecordEntry) => String(e.value)
  const L = (k: string) => t(`rec.${k}` as TKey)

  return (
    <section>
      <Breadcrumbs
        trail={[
          { name: t('nav.home'), path: '/' },
          { name: t('rec.title'), path: '/records' },
        ]}
      />
      <div className="page-head">
        <h1>{t('rec.title')}</h1>
      </div>
      <p className="profile-summary">{t('rec.lead')}</p>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {error && <p className="banner">{t('rec.loadError', { error })}</p>}
      {data && (
        <>
          <div className="rec-grid">
            <List title={L('titles')} rows={data.drivers.titles} kind="driver" value={num} />
            <List title={L('wins')} rows={data.drivers.wins} kind="driver" value={num} />
            <List title={L('poles')} rows={data.drivers.poles} kind="driver" value={num} />
            <List title={L('podiums')} rows={data.drivers.podiums} kind="driver" value={num} />
            <List
              title={L('seasonWins')}
              rows={data.drivers.seasonWins}
              kind="driver"
              value={(e) => t('rec.ofRaces', { n: e.value, of: e.races ?? 0 })}
              detail={(e) => String(e.season)}
            />
            <List
              title={L('youngest')}
              rows={data.drivers.youngestWinners}
              kind="driver"
              value={(e) => (e.born && e.date ? ageText(e.born, e.date, uk) : '')}
              bars={false}
              detail={(e) => `${gpTitle(e.grandPrixName ?? '', lang)} ${e.season}`}
            />
            <List title={L('starts')} rows={data.drivers.starts} kind="driver" value={num} />
            <List title={L('fastestLaps')} rows={data.drivers.fastestLaps} kind="driver" value={num} />
          </div>
          <h2 className="rec-group">{t('rec.teams')}</h2>
          <div className="rec-grid">
            <List title={L('teamTitles')} rows={data.teams.titles} kind="team" value={num} />
            <List title={L('teamWins')} rows={data.teams.wins} kind="team" value={num} />
            <List title={L('teamPoles')} rows={data.teams.poles} kind="team" value={num} />
          </div>
          <p className="muted rec-note">{t('rec.note')}</p>
        </>
      )}
    </section>
  )
}
