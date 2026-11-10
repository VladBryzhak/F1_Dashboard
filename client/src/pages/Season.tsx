import type { CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import Breadcrumbs from '../components/Breadcrumbs'
import SeasonSelect from '../components/SeasonSelect'
import TitleRaceChart from '../components/TitleRaceChart'
import { useAsync } from '../hooks/useAsync'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import { breadcrumbLd } from '../lib/jsonld'
import { teamColor } from '../lib/f1meta'
import { gpTitle } from '../lib/gpNames'
import { CURRENT_SEASON } from '../lib/seasons'
import { seoText } from '../lib/seoText'
import { localName } from '../lib/ukNames'
import type { ReviewEntrant, SeasonReview } from '../types/f1'
import NotFound from './NotFound'
import './Season.css'

// A season's review, read as the season's story: the champion (or the leader
// while the title is open) and the constructors', the season in numbers,
// every round's winner, the title race, first career wins, each team's
// teammate duel and the season's articles. Built from f1db, so it works for
// every season since 1950 and turns final by itself once the last round has
// run (or the rest were never held).

// "3rd" / "3-й".
function ordinal(n: number, lang: string): string {
  if (lang === 'uk') return `${n}-й`
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`
}

function Champion({ e, label, sub, href }: { e: ReviewEntrant; label: string; sub: string; href: string }) {
  const { lang } = useI18n()
  return (
    <div className="ssn-champ" style={{ '--team': teamColor(e.constructorId) } as CSSProperties}>
      <span className="ssn-champ-label">{label}</span>
      <Link to={href} className="ssn-champ-name">
        {href.startsWith('/drivers/') ? localName(e.id, e.name, lang) : e.name}
      </Link>
      <span className="ssn-champ-sub">{sub}</span>
    </div>
  )
}

function Body({ r }: { r: SeasonReview }) {
  const { t, tn, lang } = useI18n()
  const progression = useAsync(() => api.seasonProgression(String(r.season)), [r.season])
  const articles = useAsync(() => api.articles(lang), [lang])
  const seasonArticles = (articles.data ?? []).filter((a) => a.season === r.season)
  const gp = (name: string) => gpTitle(name, lang)
  const d = r.driver
  const lead = d && r.runnerUp ? d.points - r.runnerUp.points : null
  const maxWins = r.wins[0]?.count ?? 1

  const entrantSub = (e: ReviewEntrant, withTeam: boolean) =>
    [
      withTeam ? e.constructorName : null,
      tn('plural.points', e.points),
      tn('plural.winsN', e.wins),
      e.title != null ? (e.title === 1 ? t('ssn.firstTitle') : t('ssn.nthTitle', { n: ordinal(e.title, lang) })) : null,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <>
      {!r.final && <p className="ssn-provisional">{t('ssn.provisional', { held: r.held, rounds: r.rounds })}</p>}

      <div className="ssn-champs">
        {d && (
          <Champion
            e={d}
            label={t(r.driverDecided ? 'ssn.champion' : 'ssn.leader')}
            sub={entrantSub(d, true)}
            href={`/drivers/${d.id}`}
          />
        )}
        {r.team && (
          <Champion
            e={r.team}
            label={t(r.final ? 'ssn.constructors' : 'ssn.constructorsLeader')}
            sub={entrantSub(r.team, false)}
            href={`/teams/${r.team.id}`}
          />
        )}
      </div>
      {r.decidedAt && (
        <p className="ssn-decided">
          {t('ssn.decidedAt', { round: r.decidedAt.round, gp: gp(r.decidedAt.grandPrixName) })}
        </p>
      )}

      <h2 className="wknd-section">{t('ssn.numbers')}</h2>
      <dl className="ssn-numbers">
        <div>
          <dt>{t('ssn.races')}</dt>
          <dd>{r.held}</dd>
        </div>
        <div>
          <dt>{t('ssn.winners')}</dt>
          <dd>{r.wins.length}</dd>
        </div>
        <div>
          <dt>{t('ssn.winningTeams')}</dt>
          <dd>{r.winningTeams}</dd>
        </div>
        {lead != null && (
          <div>
            <dt>{t(r.driverDecided ? 'ssn.marginChampion' : 'ssn.marginLeader')}</dt>
            <dd>{tn('plural.points', lead)}</dd>
          </div>
        )}
      </dl>

      <h2 className="wknd-section">{t('ssn.byRound')}</h2>
      <ol className="ssn-rounds">
        {r.winners.map((w) => {
          const label = `${t('common.round')} ${w.round}. ${gp(w.grandPrixName)}. ${
            w.winnerName ? t('cy.won', { name: localName(w.winnerId, w.winnerName, lang) }) : t('cy.toCome')
          }`
          return (
            <li key={w.round}>
              <Link
                to={`/calendar/${r.season}/${w.round}`}
                className={`ssn-round${w.winnerId ? '' : ' is-ahead'}`}
                style={w.constructorId ? ({ '--team': teamColor(w.constructorId) } as CSSProperties) : undefined}
                title={label}
                aria-label={label}
              >
                <span className="ssn-round-n mono">{w.round}</span>
                <span className="ssn-round-code">{w.winnerCode ?? (w.winnerName ? w.winnerName.slice(0, 3).toUpperCase() : '')}</span>
              </Link>
            </li>
          )
        })}
      </ol>

      {r.wins.length > 0 && (
        <ol className="ssn-wins">
          {r.wins.map((w) => (
            <li key={w.id} style={{ '--team': teamColor(w.constructorId) } as CSSProperties}>
              <Link to={`/drivers/${w.id}`} className="ssn-wins-name">
                {localName(w.id, w.name, lang)}
              </Link>
              <span className="ssn-wins-bar" style={{ width: `${(w.count / maxWins) * 100}%` }} aria-hidden="true" />
              <span className="ssn-wins-n mono">{w.count}</span>
            </li>
          ))}
        </ol>
      )}

      {progression.data && progression.data.series.length > 0 && (
        <>
          <h2 className="wknd-section">{t('ssn.titleRace')}</h2>
          <TitleRaceChart data={progression.data} />
        </>
      )}

      {r.firstWins.length > 0 && r.season > 1950 && (
        <>
          <h2 className="wknd-section">{t('ssn.firstWins')}</h2>
          <ul className="ssn-list">
            {r.firstWins.map((f) => (
              <li key={f.id}>
                <span className="ssn-swatch" style={{ background: teamColor(f.constructorId) }} aria-hidden="true" />
                <Link to={`/drivers/${f.id}`}>{localName(f.id, f.name, lang)}</Link>
                <span className="muted">
                  {' '}
                  · <Link to={`/calendar/${r.season}/${f.round}`}>{gp(f.grandPrixName)}</Link>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {r.duels.length > 0 && (
        <>
          <h2 className="wknd-section">{t('ssn.duels')}</h2>
          <div className="ssn-duels">
            {r.duels.map((x) => (
              <Link
                key={x.constructorId}
                to={`/teams/${x.constructorId}`}
                className="ssn-duel"
                style={{ '--team': teamColor(x.constructorId) } as CSSProperties}
              >
                <span className="ssn-duel-team">{x.constructorName}</span>
                <span className="ssn-duel-row">
                  <span>{x.a.code ?? localName(x.a.id, x.a.name, lang)}</span>
                  <span className="ssn-duel-kind">{t('ssn.quali')}</span>
                  <span className="mono">
                    {x.quali.a}:{x.quali.b}
                  </span>
                  <span className="ssn-duel-kind">{t('ssn.race')}</span>
                  <span className="mono">
                    {x.race.a}:{x.race.b}
                  </span>
                  <span>{x.b.code ?? localName(x.b.id, x.b.name, lang)}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {seasonArticles.length > 0 && (
        <>
          <h2 className="wknd-section">{t('ssn.articles')}</h2>
          <ul className="ssn-list">
            {seasonArticles.map((a) => (
              <li key={a.slug}>
                <Link to={`/articles/${a.slug}`}>{a.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="ssn-links">
        {r.season > 1950 && <Link to={`/seasons/${r.season - 1}`}>← {t('ssn.seasonN', { n: r.season - 1 })}</Link>}
        <Link to={`/standings/${r.season}`}>{t('st.title', { season: r.season })}</Link>
        <Link to={`/calendar/${r.season}`}>{t('nav.calendar')} {r.season}</Link>
        {r.season < CURRENT_SEASON && <Link to={`/seasons/${r.season + 1}`}>{t('ssn.seasonN', { n: r.season + 1 })} →</Link>}
      </p>
    </>
  )
}

export default function Season() {
  const { season = '' } = useParams()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const valid = /^\d{4}$/.test(season)
  const { data, loading, error, notFound } = useAsync(
    () => (valid ? api.seasonReview(season) : Promise.reject(new Error('404'))),
    [season],
  )
  const crumbs = [
    { name: t('nav.home'), path: '/' },
    { name: t('ssn.seasonN', { n: season }), path: `/seasons/${season}` },
  ]

  useSeo({
    skip: notFound || !valid,
    ...(data ? seoText.season(data, lang) : {}),
    jsonLd: data ? [breadcrumbLd(crumbs)] : undefined,
  })

  if (!season) return <Navigate to={`/seasons/${CURRENT_SEASON}`} replace />
  if (!valid || notFound) return <NotFound />

  return (
    <section className="ssn">
      <Breadcrumbs trail={crumbs} />
      <div className="page-head">
        <h1>{t('ssn.title', { season })}</h1>
        <SeasonSelect value={season} onChange={(s) => navigate(`/seasons/${s}`)} />
      </div>
      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && error && <p className="banner">{t('ssn.loadError')}</p>}
      {data && <Body r={data} />}
    </section>
  )
}
