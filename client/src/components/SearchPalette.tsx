import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useI18n, type TKey } from '../i18n/core'
import { countryName } from '../lib/countries'
import { gpShort, gpTitle } from '../lib/gpNames'
import type { SearchIndex } from '../types/f1'
import Flag from './Flag'

type Hit = {
  kind: 'driver' | 'team' | 'circuit' | 'race'
  to: string
  title: string
  sub: string
  code: string | null
  score: number
}

const GROUPS: { kind: Hit['kind']; label: TKey }[] = [
  { kind: 'driver', label: 'search.drivers' },
  { kind: 'team', label: 'search.teams' },
  { kind: 'circuit', label: 'search.circuits' },
  { kind: 'race', label: 'search.races' },
]
const PER_GROUP = 5

// Loaded once per visit, on first open.
let indexPromise: Promise<SearchIndex> | null = null
function loadIndex(): Promise<SearchIndex> {
  if (!indexPromise) {
    indexPromise = api.searchIndex().catch((err) => {
      indexPromise = null
      throw err
    })
  }
  return indexPromise
}

// Lower-case, strip accents ("Pérez" → "perez").
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// 3 = whole text starts with the query, 2 = a word starts with it,
// 1 = contains it, 0 = no match. Every query word must match.
function matchScore(text: string, words: string[]): number {
  const t = norm(text)
  let total = 0
  for (const w of words) {
    if (t.startsWith(w)) total += 3
    else if (t.split(/[\s\-–,./()]+/).some((part) => part.startsWith(w))) total += 2
    else if (t.includes(w)) total += 1
    else return 0
  }
  return total
}

function search(index: SearchIndex, query: string, lang: 'en' | 'uk', locale: string): Hit[] {
  const raw = norm(query.trim())
  if (!raw) return []
  // A 4-digit year narrows races ("monaco 2021").
  const year = raw.match(/\b(19[5-9]\d|20\d\d)\b/)?.[1]
  const words = raw.replace(/\b(19[5-9]\d|20\d\d)\b/, ' ').split(/\s+/).filter(Boolean)
  const hits: Hit[] = []

  if (words.length) {
    for (const [id, name, first, last, races, code] of index.drivers) {
      const s = matchScore(name, words)
      if (s) hits.push({ kind: 'driver', to: `/drivers/${id}`, title: name, sub: `${first}–${last}`, code, score: s * 1000 + races })
    }
    for (const [id, name, first, last, races, code] of index.teams) {
      const s = matchScore(name, words)
      if (s) hits.push({ kind: 'team', to: `/teams/${id}`, title: name, sub: `${first}–${last}`, code, score: s * 1000 + races })
    }
    for (const [id, name, place, code] of index.circuits) {
      const s = Math.max(
        matchScore(`${name} ${place}`, words),
        matchScore(`${place} ${countryName(code, locale)}`, words),
      )
      if (s) hits.push({ kind: 'circuit', to: `/circuits/${id}`, title: name, sub: [place, countryName(code, locale)].filter(Boolean).join(', '), code, score: s * 1000 })
    }
  }

  let racesFound = 0
  for (const [season, round, gp, code] of index.races) {
    if (racesFound >= PER_GROUP) break
    if (year && String(season) !== year) continue
    const s = words.length
      ? Math.max(matchScore(gp, words), matchScore(gpShort(gp, lang), words), matchScore(countryName(code, locale), words))
      : year
        ? 1
        : 0
    if (!s) continue
    racesFound += 1
    hits.push({ kind: 'race', to: `/calendar/${season}/${round}`, title: `${gpTitle(gp, lang)} ${season}`, sub: '', code, score: s * 1000 + season })
  }

  // With a year in the query the user is after a race: list races first.
  const order = year ? [GROUPS[3], ...GROUPS.slice(0, 3)] : GROUPS
  const out: Hit[] = []
  for (const g of order) {
    out.push(
      ...hits
        .filter((h) => h.kind === g.kind)
        .sort((a, b) => b.score - a.score)
        .slice(0, PER_GROUP),
    )
  }
  return out
}

// Global search: a command palette opened with ⌘K / Ctrl+K, "/" or the
// header button. Searches drivers, teams, circuits and past races.
export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, locale } = useI18n()
  const navigate = useNavigate()
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [error, setError] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    setError(false)
    loadIndex().then(setIndex, () => setError(true))
    // Focus after the dialog is painted (iOS needs it inside the same tick as the tap).
    inputRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const hits = useMemo(() => (index ? search(index, q, lang, locale) : []), [index, q, lang, locale])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  function go(h: Hit) {
    onClose()
    navigate(h.to)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault()
      go(hits[active])
    }
  }

  let i = -1
  return (
    <div className="sp-overlay" onMouseDown={onClose}>
      <div
        className="sp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('search.label')}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="sp-input-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="sp-input"
            type="search"
            placeholder={t('search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="sp-results"
            aria-activedescendant={hits[active] ? `sp-hit-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="sp-esc" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="sp-results" id="sp-results" role="listbox" ref={listRef}>
          {error && <p className="sp-empty">{t('search.error')}</p>}
          {!error && !index && <p className="sp-empty">{t('common.loading')}</p>}
          {index && !q.trim() && <p className="sp-empty">{t('search.hint')}</p>}
          {index && q.trim() && hits.length === 0 && <p className="sp-empty">{t('search.none', { q })}</p>}
          {[...new Set(hits.map((h) => h.kind))].map((kind) => {
            const g = GROUPS.find((x) => x.kind === kind)!
            const group = hits.filter((h) => h.kind === kind)
            if (!group.length) return null
            return (
              <div key={g.kind} className="sp-group">
                <div className="sp-group-title">{t(g.label)}</div>
                {group.map((h) => {
                  i += 1
                  const idx = i
                  return (
                    <div
                      key={h.to}
                      id={`sp-hit-${idx}`}
                      role="option"
                      aria-selected={idx === active}
                      className={idx === active ? 'sp-hit on' : 'sp-hit'}
                      onMouseMove={() => setActive(idx)}
                      onClick={() => go(h)}
                    >
                      {h.code ? <Flag code={h.code} nationality="" /> : <span className="sp-noflag" />}
                      <span className="sp-hit-title">{h.title}</span>
                      {h.sub && <span className="sp-hit-sub">{h.sub}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="sp-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t('search.move')}</span>
          <span><kbd>↵</kbd> {t('search.open')}</span>
          <span><kbd>Esc</kbd> {t('search.close')}</span>
        </div>
      </div>
    </div>
  )
}
