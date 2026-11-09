import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { ageText } from '../lib/age'
import { breadcrumbLd } from '../lib/jsonld'
import { teamColor } from '../lib/f1meta'
import { gpTitle } from '../lib/gpNames'
import { seoText } from '../lib/seoText'
import { UK_DRIVER_NAMES } from '../lib/ukNames'
import type { RecordEntry, RecordsResponse } from '../types/f1'
import './Records.css'

// All-time records, read as a hall of fame: the four headline records large,
// then each list with its holder up front and the rest of the top ten under
// it. The same numbers as the profiles (titles from completed seasons only);
// the crawler text mirrors this page (server/src/services/snapshot.ts,
// recordsPage).

type Kind = 'driver' | 'team'
type Tab = 'drivers' | 'teams'

interface ListSpec {
  key: string
  rows: RecordEntry[]
  kind: Kind
  value: (e: RecordEntry) => string
  detail?: (e: RecordEntry) => string
  bars?: boolean // off where less is the record (youngest winners)
}

const hrefOf = (kind: Kind, e: RecordEntry) => `/${kind === 'driver' ? 'drivers' : 'teams'}/${e.id}`

function useNames() {
  const { lang } = useI18n()
  return (kind: Kind, e: RecordEntry) => (kind === 'driver' && lang === 'uk' && UK_DRIVER_NAMES[e.id]?.join(' ')) || e.name
}

// One list: the holder large, ranks 2 to 10 below.
function RecordList({ spec }: { spec: ListSpec }) {
  const { t } = useI18n()
  const name = useNames()
  const { rows, kind, value, detail, bars = true } = spec
  if (!rows.length) return null
  const [lead, ...rest] = rows
  const top = lead.value || 1
  return (
    <article className="rec-card">
      <h2 className="rec-card-title">{t(`rec.${spec.key}` as TKey)}</h2>
      <div className="rec-lead" style={{ '--team': teamColor(lead.constructorId ?? '') } as CSSProperties}>
        <div className="rec-lead-who">
          <Link to={hrefOf(kind, lead)} className="rec-lead-name">
            {name(kind, lead)}
          </Link>
          {detail && <span className="rec-detail">{detail(lead)}</span>}
        </div>
        <span className="rec-lead-val">{value(lead)}</span>
      </div>
      <ol className="rec-rest">
        {rest.map((e) => (
          <li key={`${e.id}-${e.season ?? ''}`} style={{ '--team': teamColor(e.constructorId ?? '') } as CSSProperties}>
            <span className="rec-rank">{e.rank}</span>
            <span className="rec-who">
              <Link to={hrefOf(kind, e)}>{name(kind, e)}</Link>
              {detail && <span className="rec-detail">{detail(e)}</span>}
            </span>
            <span className="rec-val">{value(e)}</span>
            {bars && (
              <span className="rec-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, (e.value / top) * 100)}%` }} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </article>
  )
}

// The four records people ask about first, large.
function Headline({ data }: { data: RecordsResponse }) {
  const { t, lang } = useI18n()
  const name = useNames()
  const holders = (rows: RecordEntry[]) => rows.filter((e) => e.rank === 1)
  const young = data.drivers.youngestWinners[0]
  const tiles: { key: string; value: string; who: RecordEntry[]; sub?: string; reading?: boolean }[] = [
    { key: 'titles', value: String(data.drivers.titles[0]?.value ?? ''), who: holders(data.drivers.titles) },
    { key: 'wins', value: String(data.drivers.wins[0]?.value ?? ''), who: holders(data.drivers.wins) },
    { key: 'poles', value: String(data.drivers.poles[0]?.value ?? ''), who: holders(data.drivers.poles) },
    ...(young?.born && young.date
      ? [{ key: 'youngest', value: ageText(young.born, young.date, lang === 'uk'), who: [young], sub: `${gpTitle(young.grandPrixName ?? '', lang)} ${young.season}`, reading: true }]
      : []),
  ]
  return (
    <div className="rec-hero">
      {tiles.map((tile) => (
        <div className="rec-tile" key={tile.key}>
          <span className="rec-tile-label">{t(`rec.hero.${tile.key}` as TKey)}</span>
          <span className={tile.reading ? 'rec-tile-val rec-tile-val--reading' : 'rec-tile-val'}>{tile.value}</span>
          <span className="rec-tile-who">
            {tile.who.map((e, i) => (
              <span key={e.id}>
                {i > 0 && (lang === 'uk' ? ' і ' : ' and ')}
                <Link to={hrefOf('driver', e)}>{name('driver', e)}</Link>
              </span>
            ))}
          </span>
          {tile.sub && <span className="rec-detail">{tile.sub}</span>}
        </div>
      ))}
    </div>
  )
}

export default function Records() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'teams' ? 'teams' : 'drivers'
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
  const lists: ListSpec[] = data
    ? tab === 'drivers'
      ? [
          { key: 'titles', rows: data.drivers.titles, kind: 'driver', value: num },
          { key: 'wins', rows: data.drivers.wins, kind: 'driver', value: num },
          { key: 'poles', rows: data.drivers.poles, kind: 'driver', value: num },
          { key: 'podiums', rows: data.drivers.podiums, kind: 'driver', value: num },
          {
            key: 'seasonWins',
            rows: data.drivers.seasonWins,
            kind: 'driver',
            value: (e) => t('rec.ofRaces', { n: e.value, of: e.races ?? 0 }),
            detail: (e) => String(e.season),
          },
          {
            key: 'youngest',
            rows: data.drivers.youngestWinners,
            kind: 'driver',
            value: (e) => (e.born && e.date ? ageText(e.born, e.date, uk) : ''),
            detail: (e) => `${gpTitle(e.grandPrixName ?? '', lang)} ${e.season}`,
            bars: false,
          },
          { key: 'starts', rows: data.drivers.starts, kind: 'driver', value: num },
          { key: 'fastestLaps', rows: data.drivers.fastestLaps, kind: 'driver', value: num },
        ]
      : [
          { key: 'teamTitles', rows: data.teams.titles, kind: 'team', value: num },
          { key: 'teamWins', rows: data.teams.wins, kind: 'team', value: num },
          { key: 'teamPoles', rows: data.teams.poles, kind: 'team', value: num },
        ]
    : []

  return (
    <section className="rec">
      <Breadcrumbs
        trail={[
          { name: t('nav.home'), path: '/' },
          { name: t('rec.title'), path: '/records' },
        ]}
      />
      <div className="page-head">
        <h1>{t('rec.title')}</h1>
      </div>
      <p className="profile-summary rec-intro">{t('rec.lead')}</p>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {error && <p className="banner">{t('rec.loadError', { error })}</p>}
      {data && (
        <>
          <Headline data={data} />
          <div className="tabs" role="tablist">
            {(['drivers', 'teams'] as Tab[]).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'tab active' : 'tab'}
                onClick={() => setParams(id === 'teams' ? { tab: 'teams' } : {}, { replace: true })}
              >
                {t(id === 'drivers' ? 'rec.drivers' : 'rec.teams')}
              </button>
            ))}
          </div>
          <div className="rec-grid">
            {lists.map((spec) => (
              <RecordList key={spec.key} spec={spec} />
            ))}
          </div>
          <p className="muted rec-note">{t('rec.note')}</p>
        </>
      )}
    </section>
  )
}
