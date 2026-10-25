import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n, type TKey } from '../i18n/core'
import { downloadText, sessionStart, sessionState, weekendIcs } from '../lib/schedule'
import type { CalendarRace, CalendarSession } from '../types/f1'
import { gpTitle } from '../lib/gpNames'
import './WeekendSchedule.css'

const SESSION_KEY: Record<CalendarSession['kind'], TKey> = {
  FP1: 'session.fp1',
  FP2: 'session.fp2',
  FP3: 'session.fp3',
  SQ: 'session.sq',
  SPRINT: 'session.sprint',
  Q: 'session.q',
  RACE: 'session.race',
}

function useNow(stepMs: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs)
    return () => clearInterval(id)
  }, [stepMs])
  return now
}

// The session schedule of one race weekend, in the visitor's own timezone:
// a countdown to the next session, every session by day, and an .ics export.
export default function WeekendSchedule({
  season,
  race,
}: {
  season: string
  race: CalendarRace
}) {
  const { t, lang, fmtDate, fmtTime } = useI18n()
  const now = useNow(1000)
  const name = (kind: CalendarSession['kind']) => t(SESSION_KEY[kind])
  const gpName = gpTitle(race.name, lang)

  if (race.sessions.length === 0) {
    return <p className="muted sched-empty">{t('sched.none')}</p>
  }

  const live = race.sessions.find((s) => sessionState(s, now) === 'live')
  const next = race.sessions.find((s) => s.timeKnown && sessionState(s, now) === 'upcoming')
  const hasTimes = race.sessions.some((s) => s.timeKnown)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  function countdown(target: number): string {
    let s = Math.max(0, Math.floor((target - now) / 1000))
    const d = Math.floor(s / 86400)
    s -= d * 86400
    const h = Math.floor(s / 3600)
    s -= h * 3600
    const m = Math.floor(s / 60)
    s -= m * 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d > 0 ? `${d}${t('sched.dayShort')} ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`
  }

  // "Fri 23" / "Пт 23": the month is already shown in the calendar row.
  function dayLabel(start: string): string {
    const wd = fmtDate(start, { weekday: 'short' }).replace('.', '')
    const day = fmtDate(start, { day: 'numeric' })
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${day}`
  }

  function exportIcs() {
    const slug = race.grandPrixId || `round-${race.round}`
    downloadText(
      `f1-${season}-r${race.round}-${slug}.ics`,
      weekendIcs(season, race, name, gpName),
      'text/calendar;charset=utf-8',
    )
  }

  return (
    <div className="sched">
      <div className="sched-head">
        <div className="sched-next">
          {live ? (
            <>
              <span className="sched-label sched-label--live">
                <span className="live-dot on" /> {t('sched.liveNow')}
              </span>
              <b>{name(live.kind)}</b>
            </>
          ) : next ? (
            <>
              <span className="sched-label">{t('sched.nextSession')}</span>
              <b>{name(next.kind)}</b>
              <span className="sched-count mono">{countdown(sessionStart(next))}</span>
            </>
          ) : (
            <span className="sched-label">{t('sched.finished')}</span>
          )}
        </div>
        {hasTimes && (
          <button type="button" className="sched-ics" onClick={exportIcs}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {t('sched.addToCalendar')}
          </button>
        )}
      </div>

      <ol className="sched-list">
        {race.sessions.map((s) => {
          const state = sessionState(s, now)
          return (
            <li
              key={s.kind}
              className={`sched-item sched-item--${state}${s.kind === 'RACE' ? ' sched-item--race' : ''}`}
            >
              <span className="sched-day">{dayLabel(s.start)}</span>
              <span className="sched-name">{name(s.kind)}</span>
              <span className="sched-time mono">
                {state === 'live' ? (
                  <span className="sched-live">{t('sched.live')}</span>
                ) : s.timeKnown ? (
                  fmtTime(s.start)
                ) : (
                  t('sched.tbc')
                )}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="sched-foot">
        {hasTimes && <p className="sched-tz">{t('sched.localTime', { tz })}</p>}
        <p className="sched-circuit">
          {t('circ.viewCircuit')}:{' '}
          <Link to={`/circuits/${race.circuitId}`}>{race.circuitName}</Link>
        </p>
      </div>
    </div>
  )
}
