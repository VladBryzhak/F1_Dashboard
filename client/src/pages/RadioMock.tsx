// TEMP: design mock-ups for team radio in the race replay (dev only, /mock/radio).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from '../lib/live'
import type { ReplayData, TeamRadio, TeamRadioClip } from '../types/f1'
import './RadioMock.css'

const VARIANTS = [
  { id: '1', label: 'Р1 Трансляція' },
  { id: '2', label: 'Р2 Хронологія' },
  { id: '3', label: 'Р3 Діалог' },
]

const ACTIVE = 'ANT_12_20261101_162613'

interface Clip extends TeamRadioClip {
  lap: number | null
  surname: string
  colour: string
}

function useData() {
  const replay = useAsync(() => api.replay(11404), [])
  const radio = useAsync(() => fetch('/api/live/11404/radio').then((r) => r.json() as Promise<TeamRadio>), [])
  return useMemo(() => {
    const d = replay.data as ReplayData | null
    const r = radio.data
    if (!d || !r) return null
    const drivers = new Map(d.drivers.map((x) => [x.num, x]))
    const clips: Clip[] = r.clips.map((c) => {
      const t = Date.parse(c.date)
      const laps = d.laps.filter((l) => l.num === c.driverNumber && l.t <= t)
      const drv = drivers.get(c.driverNumber)
      const parts = (drv?.name ?? c.code).split(' ')
      return {
        ...c,
        lap: laps.length ? laps[laps.length - 1].lap : null,
        surname: parts[parts.length - 1].toUpperCase(),
        colour: teamColor(drv?.colour ?? null),
      }
    })
    // Finishing order for the sample board.
    const last = new Map<number, number>()
    for (const p of d.pos) last.set(p.num, p.p)
    const order = [...last.entries()].sort((a, b) => a[1] - b[1]).slice(0, 8)
    const rows = order.map(([num, p]) => ({ num, p, code: drivers.get(num)?.code ?? String(num), colour: teamColor(drivers.get(num)?.colour ?? null) }))
    return { clips, rows }
  }, [replay.data, radio.data])
}

// One clip plays at a time, straight from F1's server.
function useAudio() {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  useEffect(() => () => ref.current?.pause(), [])
  const toggle = (c: Clip) => {
    if (playing === c.id) {
      ref.current?.pause()
      setPlaying(null)
      return
    }
    ref.current?.pause()
    const a = new Audio(c.url)
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    ref.current = a
    setPlaying(c.id)
  }
  return { playing, toggle }
}

function PlayButton({ on, onClick, small = false }: { on: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button type="button" className={`rm-play${small ? ' rm-play--sm' : ''}${on ? ' is-on' : ''}`} onClick={onClick} aria-label={on ? 'Зупинити' : 'Слухати'}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        {on ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M4.5 2.5v11L13 8z" fill="currentColor" />}
      </svg>
    </button>
  )
}

function RadioIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12a7 7 0 0 1 2-5M19 12a7 7 0 0 0-2-5M8.5 12a3.5 3.5 0 0 1 1-2.5M15.5 12a3.5 3.5 0 0 0-1-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 14v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const WHO: Record<string, string> = { driver: 'Пілот', engineer: 'Інженер' }

function Lines({ c, original = true, max }: { c: Clip; original?: boolean; max?: number }) {
  if (c.unclear) return <p className="rm-unclear">Розшифровки немає: запис нерозбірливий.</p>
  const lines = max ? c.lines.filter((l) => l.uk).slice(0, max) : c.lines
  return (
    <div className="rm-lines">
      {lines.map((l, i) => (
        <p key={i} className={`rm-line${l.who === 'engineer' ? ' is-eng' : ''}`}>
          {l.who && <span className="rm-who">{WHO[l.who]}</span>}
          {l.uk ? (
            <span className="rm-text">
              {l.uk}
              {original && <span className="rm-orig">{l.en}</span>}
            </span>
          ) : (
            <span className="rm-text rm-text--unclear">нерозбірливо</span>
          )}
        </p>
      ))}
    </div>
  )
}

function Board({ rows, active, style }: { rows: { num: number; p: number; code: string; colour: string }[]; active: number; style: string }) {
  return (
    <div className="rm-board">
      {rows.map((r) => (
        <div key={r.num} className={`rm-row${r.num === active ? ` is-radio rm-row--${style}` : ''}`}>
          <span className="mono rm-pos">{r.p}</span>
          <span className="rm-drv">
            <span className="rm-stripe" style={{ background: r.colour }} />
            <span className="rm-code">{r.code}</span>
            {r.num === active && style === '1' && <RadioIcon className="rm-ico" />}
          </span>
          <span className="mono rm-gap">{r.p === 1 ? 'Лідер' : `+${(r.p * 3.4).toFixed(3)}`}</span>
          {r.num === active && style === '2' && <span className="rm-pill"><span className="rm-dot" />RADIO</span>}
          {r.num === active && style === '3' && (
            <span className="rm-speaker" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------- Р1: broadcast plates ----------
function Plate({ c, audio, compact = false }: { c: Clip; audio?: ReturnType<typeof useAudio>; compact?: boolean }) {
  return (
    <div className={`rm-plate${compact ? ' rm-plate--compact' : ''}`} style={{ '--team': c.colour } as CSSProperties}>
      <div className="rm-plate-head">
        <span className="rm-plate-name">{c.surname}</span>
        <span className="rm-plate-tag">
          <RadioIcon /> RADIO
        </span>
        {audio && <PlayButton small on={audio.playing === c.id} onClick={() => audio.toggle(c)} />}
      </div>
      <div className="rm-plate-body">
        <Lines c={c} original={!compact} max={compact ? 3 : undefined} />
      </div>
    </div>
  )
}

function Meta({ c }: { c: Clip }) {
  return (
    <span className="rm-meta">
      {c.lap != null ? (
        <span>
          Коло <span className="mono">{c.lap}</span>
        </span>
      ) : (
        <span>До старту</span>
      )}
    </span>
  )
}

function V1({ clips, rows }: { clips: Clip[]; rows: Parameters<typeof Board>[0]['rows'] }) {
  const audio = useAudio()
  const active = clips.find((c) => c.id === ACTIVE)!
  return (
    <>
      <div className="rm-stage">
        <div className="rm-map">
          <span className="rm-map-note">Карта траси</span>
          <div className="rm-overlay rm-overlay--plate">
            <Plate c={active} compact />
          </div>
        </div>
        <Board rows={rows} active={active.driverNumber} style="1" />
      </div>
      <section className="rm-block">
        <h2 className="rm-h2">Радіо команд</h2>
        <div className="rm-grid">
          {clips.map((c) => (
            <div key={c.id} className="rm-card">
              <Meta c={c} />
              <Plate c={c} audio={audio} />
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

// ---------- Р2: timeline by lap ----------
function V2({ clips, rows }: { clips: Clip[]; rows: Parameters<typeof Board>[0]['rows'] }) {
  const audio = useAudio()
  const active = clips.find((c) => c.id === ACTIVE)!
  const [only, setOnly] = useState<string | null>(null)
  const codes = [...new Set(clips.map((c) => c.code))]
  const shown = clips.filter((c) => !only || c.code === only)
  return (
    <>
      <div className="rm-stage rm-stage--v2">
        <div className="rm-third" style={{ '--team': active.colour } as CSSProperties}>
          <span className="rm-eq" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="rm-third-name">{active.surname}</span>
          <span className="rm-third-text">{active.lines.find((l) => l.uk)?.uk}</span>
        </div>
        <div className="rm-map"><span className="rm-map-note">Карта траси</span></div>
        <Board rows={rows} active={active.driverNumber} style="2" />
      </div>
      <section className="rm-block">
        <div className="rm-block-head">
          <h2 className="rm-h2">Радіо команд</h2>
          <div className="rm-chips">
            <button type="button" className={`rm-chip${!only ? ' is-on' : ''}`} onClick={() => setOnly(null)}>Усі</button>
            {codes.map((k) => (
              <button key={k} type="button" className={`rm-chip${only === k ? ' is-on' : ''}`} onClick={() => setOnly(k)}>{k}</button>
            ))}
          </div>
        </div>
        <ol className="rm-tl">
          {shown.map((c) => (
            <li key={c.id} className="rm-tl-item" style={{ '--team': c.colour } as CSSProperties}>
              <span className="rm-tl-lap mono">{c.lap ?? ''}</span>
              <span className="rm-tl-dot" />
              <div className="rm-tl-body">
                <div className="rm-tl-head">
                  <span className="rm-stripe" />
                  <span className="rm-tl-name">{c.surname}</span>
                  <Meta c={c} />
                  <PlayButton small on={audio.playing === c.id} onClick={() => audio.toggle(c)} />
                </div>
                <Lines c={c} original={false} />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

// ---------- Р3: chat ----------
function V3({ clips, rows }: { clips: Clip[]; rows: Parameters<typeof Board>[0]['rows'] }) {
  const audio = useAudio()
  const active = clips.find((c) => c.id === ACTIVE)!
  const first = active.lines.find((l) => l.uk)
  return (
    <>
      <div className="rm-stage">
        <div className="rm-map">
          <span className="rm-map-note">Карта траси</span>
          <div className="rm-toast" style={{ '--team': active.colour } as CSSProperties}>
            <span className="rm-stripe" />
            <span className="rm-toast-body">
              <span className="rm-toast-name">{active.surname}</span>
              <span className="rm-toast-text">{first?.uk}</span>
            </span>
            <PlayButton small on={audio.playing === active.id} onClick={() => audio.toggle(active)} />
          </div>
        </div>
        <Board rows={rows} active={active.driverNumber} style="3" />
      </div>
      <section className="rm-block">
        <h2 className="rm-h2">Радіо команд</h2>
        <div className="rm-chat">
          {clips.map((c) => (
            <article key={c.id} className="rm-thread" style={{ '--team': c.colour } as CSSProperties}>
              <header className="rm-thread-head">
                <span className="rm-stripe" />
                <span className="rm-tl-name">{c.surname}</span>
                <Meta c={c} />
                <PlayButton small on={audio.playing === c.id} onClick={() => audio.toggle(c)} />
              </header>
              {c.unclear ? (
                <p className="rm-unclear">Розшифровки немає: запис нерозбірливий.</p>
              ) : (
                c.lines.map((l, i) => (
                  <p key={i} className={`rm-bubble${l.who === 'driver' ? ' is-drv' : l.who === 'engineer' ? ' is-eng' : ''}`}>
                    {l.uk ?? <span className="rm-text--unclear">нерозбірливо</span>}
                  </p>
                ))
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

export default function RadioMock() {
  const [params] = useSearchParams()
  const v = VARIANTS.some((x) => x.id === params.get('v')) ? params.get('v')! : '1'
  const data = useData()
  return (
    <div className="rm">
      <nav className="rm-bar" aria-label="Варіанти макетів">
        <span className="rm-bar-label">Радіо в повторі</span>
        {VARIANTS.map((x) => (
          <Link key={x.id} to={`?v=${x.id}`} className={`rm-bar-link${x.id === v ? ' is-on' : ''}`}>
            {x.label}
          </Link>
        ))}
        <span className="rm-bar-note">Гонка в Мехіко, справжні кліпи; таблиця й карта умовні</span>
      </nav>
      {!data ? <p className="muted">Завантаження…</p> : v === '1' ? <V1 {...data} /> : v === '2' ? <V2 {...data} /> : <V3 {...data} />}
    </div>
  )
}
