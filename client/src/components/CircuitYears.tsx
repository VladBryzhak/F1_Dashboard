import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/core'
import { gpTitle } from '../lib/gpNames'
import type { RaceWeekend } from '../types/f1'
import './CircuitYears.css'

// Every race held at this race's circuit, one link per year, this one marked:
// a reader can step to any other year here, and every race page links the
// circuit's whole history. Years run under another Grand Prix name are dimmed.
export default function CircuitYears({ weekend: w }: { weekend: RaceWeekend }) {
  const { t, tn, lang } = useI18n()
  if (w.atCircuit.length < 2) return null
  const others = [...new Set(w.atCircuit.map((r) => r.grandPrixName))].filter((n) => n !== w.grandPrixName)

  return (
    <section className="cy" aria-labelledby="cy-title">
      <h2 id="cy-title" className="wknd-section">
        {t('cy.title')}
        <span className="wknd-when">{tn('plural.races', w.atCircuit.length)}</span>
      </h2>
      <ol className="cy-years">
        {w.atCircuit.map((r) => {
          const here = r.year === Number(w.season) && r.round === w.round
          const label = `${gpTitle(r.grandPrixName, lang)} ${r.year}. ${
            r.winnerName ? t('cy.won', { name: r.winnerName }) : t('cy.toCome')
          }`
          const cls = `cy-year mono${r.grandPrixName !== w.grandPrixName ? ' is-other' : ''}`
          return (
            <li key={`${r.year}-${r.round}`}>
              {here ? (
                <span className={`${cls} is-here`} aria-current="page" title={label}>
                  {r.year}
                </span>
              ) : (
                <Link to={`/calendar/${r.year}/${r.round}`} className={cls} title={label} aria-label={label}>
                  {r.year}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
      {others.length > 0 && (
        <p className="cy-note">
          {t('cy.otherName', { names: others.map((n) => gpTitle(n, lang)).join(', ') })}
        </p>
      )}
    </section>
  )
}
