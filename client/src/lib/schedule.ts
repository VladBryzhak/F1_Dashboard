import type { CalendarRace, CalendarSession } from '../types/f1'

// Typical session lengths (minutes), for "live now" and calendar-event ends.
const DURATION_MIN: Record<CalendarSession['kind'], number> = {
  FP1: 60,
  FP2: 60,
  FP3: 60,
  SQ: 45,
  SPRINT: 60,
  Q: 60,
  RACE: 120,
}

export function sessionStart(s: CalendarSession): number {
  return new Date(s.start).getTime()
}

export function sessionEnd(s: CalendarSession): number {
  return sessionStart(s) + DURATION_MIN[s.kind] * 60_000
}

export type SessionState = 'done' | 'live' | 'upcoming'

export function sessionState(s: CalendarSession, now: number): SessionState {
  if (!s.timeKnown) {
    // Date only: treat the whole day as the session.
    const day = sessionStart(s)
    if (now >= day + 86_400_000) return 'done'
    return 'upcoming'
  }
  if (now >= sessionEnd(s)) return 'done'
  if (now >= sessionStart(s)) return 'live'
  return 'upcoming'
}

// "20261025T200000Z" — iCalendar UTC date-time.
function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// Build an .ics file with one event per timed session of the weekend.
export function weekendIcs(
  season: string,
  race: CalendarRace,
  sessionName: (kind: CalendarSession['kind']) => string,
  gpName: string,
): string {
  const now = icsStamp(Date.now())
  const events = race.sessions
    .filter((s) => s.timeKnown)
    .map((s) =>
      [
        'BEGIN:VEVENT',
        `UID:${season}-${race.round}-${s.kind}@f1-dashboard-bryzhak.onrender.com`,
        `DTSTAMP:${now}`,
        `DTSTART:${icsStamp(sessionStart(s))}`,
        `DTEND:${icsStamp(sessionEnd(s))}`,
        `SUMMARY:${icsEscape(`F1 · ${gpName} · ${sessionName(s.kind)}`)}`,
        `LOCATION:${icsEscape([race.circuitName, race.placeName].filter(Boolean).join(', '))}`,
        'END:VEVENT',
      ].join('\r\n'),
    )
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Paddock Times//Weekend schedule//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
