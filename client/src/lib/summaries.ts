// Data-driven prose for profile and result pages. Pages were tables of numbers
// with almost no body text, which search engines have little to rank. These
// builders turn the data we already load into a natural-reading paragraph that
// is unique per page. Written without personal pronouns (we don't know any
// driver's pronouns) — the surname is repeated instead.
import type {
  ConstructorProfile,
  ConstructorStanding,
  DriverProfile,
  DriverStanding,
  RaceWeekend,
} from '../types/f1'
import { CURRENT_SEASON } from './seasons'

// "a, b and c" from a de-duplicated, non-empty list.
function naturalList(items: string[]): string {
  const uniq = [...new Set(items)].filter(Boolean)
  if (uniq.length === 0) return ''
  if (uniq.length === 1) return uniq[0]
  return `${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]}`
}

// "1 win" / "3 wins".
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

// "a" / "an" for the following word (good enough for F1 nationalities).
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

// "since 2010" (active) · "in 1994" (one season) · "from 1991 to 2012".
function yearSpan(first: number, last: number, active: boolean): string {
  if (active) return `since ${first}`
  if (first === last) return `in ${first}`
  return `from ${first} to ${last}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function driverSummary(p: DriverProfile): string {
  const surname = p.familyName
  const active = p.lastSeason >= CURRENT_SEASON
  const role = active
    ? `${p.nationality} Formula One driver`
    : `${p.nationality} former Formula One racing driver`
  const span = `${active ? 'has raced' : 'raced'} in the FIA Formula One World Championship ${yearSpan(p.firstSeason, p.lastSeason, active)}`
  const teams = naturalList(p.seasons.map((s) => s.constructorName))

  let text = `${p.givenName} ${p.familyName} is ${article(p.nationality)} ${role} who ${span}`
  if (teams) text += `, driving for ${teams}`
  text += '.'

  const feats: string[] = []
  if (p.championships > 0) feats.push(count(p.championships, 'World Championship'))
  if (p.wins > 0) feats.push(count(p.wins, 'Grand Prix win'))
  if (p.podiums > 0) feats.push(count(p.podiums, 'podium'))

  const verb = active ? 'has taken' : 'took'
  const starts = count(p.races, 'race start')
  if (feats.length > 0) {
    text += ` Across ${starts}, ${surname} ${verb} ${naturalList(feats)}, scoring ${p.points} career points.`
  } else {
    text += ` ${surname} ${active ? 'has made' : 'made'} ${starts} and scored ${p.points} career points.`
  }
  return text
}

export function teamSummary(p: ConstructorProfile): string {
  const active = p.lastSeason >= CURRENT_SEASON
  const span = `${active ? 'has competed' : 'competed'} in the FIA Formula One World Championship ${yearSpan(p.firstSeason, p.lastSeason, active)}`
  const lead = active
    ? `${article(p.nationality)} ${p.nationality}`
    : `a former ${p.nationality}`

  let text = `${p.name} is ${lead} Formula One constructor that ${span}.`

  const feats: string[] = []
  if (p.championships > 0)
    feats.push(count(p.championships, "Constructors' Championship"))
  if (p.wins > 0) feats.push(count(p.wins, 'Grand Prix win'))
  if (p.podiums > 0) feats.push(count(p.podiums, 'podium'))

  const verb = active ? 'has scored' : 'scored'
  const races = count(p.races, 'race entry', 'race entries')
  if (feats.length > 0) {
    text += ` The team ${active ? 'has won' : 'won'} ${naturalList(feats)} across ${races}, for a total of ${p.points} points.`
  } else {
    text += ` The team ${verb} ${p.points} points across ${races}.`
  }
  return text
}

export function raceSummary(w: RaceWeekend): string {
  const winner = w.results.find((r) => r.positionText === '1')
  const pole =
    w.qualifying.find((q) => q.position === 1) ?? w.qualifying[0] ?? null

  let text = `The ${w.season} ${w.grandPrixName} Grand Prix was held on ${formatDate(w.date)}.`

  if (winner) {
    text += ` ${winner.driverName} won the race for ${winner.constructorName}`
    const grid = w.results.find((r) => r.driverId === winner.driverId)?.gridPosition
    if (grid === 1) text += ' from pole position'
    else if (grid) text += ` from P${grid} on the grid`
    text += '.'
  }
  if (pole && (!winner || pole.driverId !== winner.driverId)) {
    text += ` ${pole.driverName} took pole position.`
  }
  if (w.fastestLap) {
    text += ` ${w.fastestLap.driverName} set the fastest lap of the race.`
  }
  return text
}

export function seasonSummary(
  season: string,
  driver: DriverStanding | undefined,
  constructor: ConstructorStanding | undefined,
): string {
  if (!driver) return ''
  const complete = Number(season) < CURRENT_SEASON
  const driverName = `${driver.givenName} ${driver.familyName}`

  if (complete) {
    let text = `The ${season} FIA Formula One World Championship was won by ${driverName} of ${driver.constructorName}, with ${driver.points} points and ${count(driver.wins, 'win')}.`
    if (constructor) {
      text += ` ${constructor.name} won the Constructors' Championship.`
    }
    return text
  }

  let text = `${driverName} (${driver.constructorName}) leads the ${season} Formula One Drivers' Championship with ${driver.points} points`
  if (driver.wins > 0) text += ` and ${count(driver.wins, 'win')}`
  text += '.'
  if (constructor) {
    text += ` ${constructor.name} leads the Constructors' standings.`
  }
  return text
}
