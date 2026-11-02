import { Link } from 'react-router-dom'
import ArticleCover, { ArrowIcon, ArticleMeta } from '../components/ArticleCover'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n, type TKey } from '../i18n/core'
import { breadcrumbLd } from '../lib/jsonld'
import { gpTitle } from '../lib/gpNames'
import { seoText } from '../lib/seoText'
import type { ArticleSummary } from '../types/f1'
import './Articles.css'

// The newest article: a wide cover with the headline beside it.
function Lead({ a }: { a: ArticleSummary }) {
  const { t } = useI18n()
  return (
    <article className="art-lead">
      <ArticleCover cover={a.cover} season={a.season} eager className="art-lead-cover" />
      <div className="art-lead-body">
        <span className="hero-chip">{t('art.latest')}</span>
        <ArticleMeta a={a} />
        <h2 className="art-lead-title">{a.title}</h2>
        <p className="art-dek art-dek--lead">{a.description}</p>
        <Link to={`/articles/${a.slug}`} className="hero-cta">
          {t('art.read')} <ArrowIcon />
        </Link>
      </div>
    </article>
  )
}

interface Weekend {
  key: string
  round: number | null
  gp: string | null
  raceDate: string | null
  items: ArticleSummary[]
}

interface Season {
  season: number
  weekends: Weekend[]
}

// Seasons, newest first, each split into its race weekends (articles with no
// round last); the list comes newest first, so the order holds within each.
function group(list: ArticleSummary[]): Season[] {
  const seasons: Season[] = []
  for (const a of list) {
    let s = seasons.find((x) => x.season === a.season)
    if (!s) seasons.push((s = { season: a.season, weekends: [] }))
    const key = a.round == null ? 'other' : String(a.round)
    let w = s.weekends.find((x) => x.key === key)
    if (!w) s.weekends.push((w = { key, round: a.round, gp: a.grandPrixName, raceDate: a.raceDate, items: [] }))
    w.items.push(a)
  }
  for (const s of seasons) s.weekends.sort((x, y) => (y.round ?? -1) - (x.round ?? -1))
  return seasons
}

function WeekendBlock({ w }: { w: Weekend }) {
  const { t, lang, fmtDate } = useI18n()
  return (
    <section className="art-wk" aria-label={w.gp ? gpTitle(w.gp, lang) : t('art.other')}>
      <div className="art-wk-side">
        {w.round != null ? (
          <>
            <span className="art-wk-round">
              <span className="art-wk-round-label">{t('art.round')}</span>
              <span className="mono">{w.round}</span>
            </span>
            {w.gp && <h3 className="art-wk-gp">{gpTitle(w.gp, lang)}</h3>}
            {w.raceDate && (
              <time className="art-wk-date mono" dateTime={w.raceDate}>
                {fmtDate(w.raceDate, { day: 'numeric', month: 'long' })}
              </time>
            )}
          </>
        ) : (
          <h3 className="art-wk-gp">{t('art.other')}</h3>
        )}
      </div>
      <ol className="art-wk-list">
        {w.items.map((a) => (
          <li key={a.slug}>
            <Link to={`/articles/${a.slug}`} className="art-wk-item">
              <span className="art-wk-day">{t(`art.day.${a.day}` as TKey)}</span>
              <span className="art-wk-text">
                <span className="art-wk-title">{a.title}</span>
                <span className="art-dek">{a.description}</span>
              </span>
              <ArticleCover cover={a.cover} season={a.season} className="ac-thumb" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

// /articles: the newest article on top, then every article by season and
// race weekend (Friday, Saturday, Sunday and between rounds).
export default function Articles() {
  const { t, lang } = useI18n()
  const { data, loading, error } = useAsync(() => api.articles(lang), [lang])
  useSeo({
    ...seoText.articles(lang),
    jsonLd: breadcrumbLd([
      { name: t('nav.home'), path: '/' },
      { name: t('art.title'), path: '/articles' },
    ]),
  })

  return (
    <section className="arts">
      <header className="arts-head">
        <h1 className="arts-h1">{t('art.title')}</h1>
        <p className="arts-intro">{t('art.intro')}</p>
      </header>
      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : error || !data ? (
        <p className="banner">{t('art.loadError', { error: error ?? '' })}</p>
      ) : !data.length ? (
        <p className="muted">{t('art.empty')}</p>
      ) : (
        <>
          <Lead a={data[0]} />
          {group(data).map((s) => (
            <div key={s.season} className="art-season">
              <h2 className="arts-h2">{t('art.season', { season: s.season })}</h2>
              {s.weekends.map((w) => (
                <WeekendBlock key={w.key} w={w} />
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  )
}
