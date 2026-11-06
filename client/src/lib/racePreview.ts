import { plural, translate, type Lang, type TKey } from '../i18n/core'
import type { PreviewWeatherDay, PreviewWins, RacePreview } from '../types/f1'

// The three short facts at the top of an upcoming race's preview
// (components/RacePreview.tsx): the race-day forecast (or, without one, the
// last race here), who on this year's grid has won here, and the lap record.
// Only what the data says. Ukrainian copy avoids gendered past-tense verbs.

export interface PreviewFact {
  tag: TKey
  text: string
}

// WMO weather code (Open-Meteo) → one word for the sky.
export function skyKey(code: number): TKey {
  if (code >= 95) return 'pv.sky.storm'
  if (code >= 80) return 'pv.sky.showers'
  if (code >= 71 && code <= 77) return 'pv.sky.snow'
  if (code >= 61) return 'pv.sky.rain'
  if (code >= 51) return 'pv.sky.drizzle'
  if (code >= 45) return 'pv.sky.fog'
  if (code >= 2) return 'pv.sky.cloudy'
  return 'pv.sky.clear'
}

// "Monday" / "Понеділок" for a yyyy-mm-dd day (read as that calendar day).
export function weekday(date: string, lang: Lang, style: 'long' | 'short' = 'long'): string {
  const s = new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    weekday: style,
    timeZone: 'UTC',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "A", "A and B", "A, B and C".
function names(list: PreviewWins[], lang: Lang): string {
  const n = list.map((w) => w.name)
  if (n.length < 2) return n.join('')
  return `${n.slice(0, -1).join(', ')} ${translate('pv.and', undefined, lang)} ${n[n.length - 1]}`
}

function weatherFact(p: RacePreview, lang: Lang): PreviewFact | null {
  const day: PreviewWeatherDay | undefined = p.weather?.find((d) => d.date === p.race.date)
  if (!day) return null
  return {
    tag: 'pv.tag.weather',
    text: translate(
      'pv.fact.weather',
      {
        day: weekday(day.date, lang),
        sky: translate(skyKey(day.code), undefined, lang),
        t: day.tMax,
        rain: day.rain,
      },
      lang,
    ),
  }
}

function lastTimeFact(p: RacePreview, lang: Lang): PreviewFact | null {
  const last = p.history[0]
  if (!last) return null
  return {
    tag: 'pv.tag.last',
    text: translate(
      'pv.fact.last',
      { year: last.year, name: last.winnerName, team: last.winnerConstructorName },
      lang,
    ),
  }
}

function winsFact(p: RacePreview, lang: Lang): PreviewFact {
  if (p.circuit.racesHeld === 0) {
    return { tag: 'pv.tag.history', text: translate('pv.fact.firstRace', undefined, lang) }
  }
  const top = p.gridWinners[0]
  if (!top) return { tag: 'pv.tag.history', text: translate('pv.fact.noGridWinner', undefined, lang) }
  const tied = p.gridWinners.filter((w) => w.count === top.count).slice(0, 3)
  const wins = plural('plural.winsN', top.count, undefined, lang)
  const key: TKey =
    tied.length === 1 ? 'pv.fact.wins' : top.count === 1 ? 'pv.fact.wonHere' : 'pv.fact.winsEach'
  return { tag: 'pv.tag.history', text: translate(key, { names: names(tied, lang), wins }, lang) }
}

function recordFact(p: RacePreview, lang: Lang): PreviewFact | null {
  const r = p.circuit.lapRecord
  if (r) {
    return {
      tag: 'pv.tag.record',
      text: translate('pv.fact.record', { time: r.time, name: r.driverName, year: r.year }, lang),
    }
  }
  if (!p.circuit.racesHeld) return null
  return { tag: 'pv.tag.circuit', text: translate('pv.fact.races', { n: p.circuit.racesHeld }, lang) }
}

export function previewFacts(p: RacePreview, lang: Lang): PreviewFact[] {
  return [weatherFact(p, lang) ?? lastTimeFact(p, lang), winsFact(p, lang), recordFact(p, lang)].filter(
    (f): f is PreviewFact => f != null,
  )
}

interface MeteoDaily {
  time: string[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  precipitation_probability_max: (number | null)[]
  weather_code: (number | null)[]
}

// The forecast straight from Open-Meteo, for when the server's request failed
// (its free tier limits requests per address, and a host's address is shared).
export async function fetchForecast(
  q: NonNullable<RacePreview['forecastFor']>,
): Promise<PreviewWeatherDay[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${q.lat}&longitude=${q.lon}` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
    `&timezone=auto&start_date=${q.start}&end_date=${q.end}`
  const res = await fetch(url)
  if (!res.ok) return null
  const d = ((await res.json()) as { daily?: MeteoDaily }).daily
  if (!d?.time?.length) return null
  const days: PreviewWeatherDay[] = []
  d.time.forEach((date, i) => {
    const tMax = d.temperature_2m_max[i]
    const tMin = d.temperature_2m_min[i]
    if (tMax == null || tMin == null) return
    days.push({
      date,
      tMax: Math.round(tMax),
      tMin: Math.round(tMin),
      rain: d.precipitation_probability_max[i] ?? 0,
      code: d.weather_code[i] ?? 0,
    })
  })
  return days.length ? days : null
}
