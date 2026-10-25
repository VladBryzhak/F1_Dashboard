import type { Lang } from '../i18n/core'
import { retirementReason } from './retirementReasons'
import type { RaceStory, StoryDriver, StoryEvent } from '../types/f1'

// Turns the race-story facts from /api/calendar/:season/:round/story into a
// few short paragraphs and one line per key moment, in English or Ukrainian.
// Only facts from the data are stated; nothing is inferred about causes.
// Ukrainian copy avoids gendered past-tense verbs (noun phrasing, present
// tense), and laps/positions are written as "коло 8" / "P19" to dodge ordinal
// endings.

// Race-control penalty reasons (upper case as published) → short phrases.
const PENALTY_REASON: [RegExp, string, string][] = [
  [/COLLISION/, 'causing a collision', 'зіткнення'],
  [
    /LEAVING THE TRACK AND GAINING/,
    'gaining an advantage off track',
    'перевага через виїзд за межі траси',
  ],
  [/TRACK LIMITS/, 'track limits', 'межі траси'],
  [/SPEEDING IN THE PIT/, 'speeding in the pit lane', 'перевищення швидкості на піт-лейні'],
  [/UNSAFE RELEASE/, 'unsafe release', 'небезпечний випуск із боксу'],
  [
    /FALSE START|JUMP START|START PROCEDURE|POSITIONING/,
    'start procedure',
    'порушення процедури старту',
  ],
  [/FORCING ANOTHER DRIVER/, 'forcing a driver off track', 'виштовхування суперника з траси'],
  [/IMPEDING/, 'impeding', 'блокування суперника'],
  [/SAFETY CAR|VSC/, 'safety car rules', 'порушення режиму Safety Car'],
]

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// Ukrainian number agreement: 1 коло, 2 кола, 5 кіл.
function ukPlural(n: number, one: string, few: string, many: string): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return one
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few
  return many
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

function penaltyReason(reason: string | undefined, lang: Lang): string {
  if (!reason) return ''
  for (const [re, en, uk] of PENALTY_REASON) if (re.test(reason)) return lang === 'uk' ? uk : en
  return reason.toLowerCase()
}

const last = (d: StoryDriver) => d.name.split(' ').slice(-1)[0]

function list(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join('')
  const and = lang === 'uk' ? ' і ' : ' and '
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`
}

const secs = (gap: string, lang: Lang) => {
  const n = gap.replace('+', '')
  return lang === 'uk' ? `${n.replace('.', ',')} с` : `${n} s`
}

function pitsUnder(story: RaceStory, n: RaceStory['neutralisations'][number]) {
  return story.events.filter(
    (e) => e.kind === 'pit' && e.lap >= n.from && e.lap <= n.to && e.driver,
  )
}

// The story as paragraphs. Empty when there is nothing beyond the summary.
export function storyParagraphs(s: RaceStory, lang: Lang): string[] {
  const uk = lang === 'uk'
  const out: string[] = []
  const w = s.winner
  if (!w) return out

  // 1. Result: how the winner did it, margin, podium.
  {
    const ledAll = s.lapsLed.length === 1 && s.lapsLed[0].code === w.code && s.totalLaps
    const ledWinner = s.lapsLed.find((l) => l.code === w.code)?.laps ?? null
    const parts: string[] = []
    if (uk) {
      let p = `Перемога ${w.name} (${w.team})`
      const how: string[] = []
      if (w.grid === 1) how.push('старт із поулу')
      else if (w.grid) how.push(`старт із P${w.grid}`)
      if (ledAll) how.push(`лідерство в усіх ${s.totalLaps} колах`)
      else if (ledWinner)
        how.push(
          `${ledWinner} ${ukPlural(ledWinner, 'коло', 'кола', 'кіл')} у лідерах із ${s.totalLaps}`,
        )
      if (s.margin && s.second) how.push(`${secs(s.margin, lang)} переваги над ${s.second.name}`)
      if (how.length) p += `: ${list(how, lang)}`
      parts.push(p + '.')
      if (s.third) {
        parts.push(
          `Третє місце: ${s.third.name}${s.third.grid && s.third.grid > 3 ? ` (старт із P${s.third.grid})` : ''}.`,
        )
      }
    } else {
      let p = `${w.name} won for ${w.team}`
      if (w.grid === 1) p += ' from pole'
      else if (w.grid) p += ` from P${w.grid} on the grid`
      if (ledAll) p += `, leading all ${s.totalLaps} laps`
      else if (ledWinner) p += `, leading ${ledWinner} laps`
      if (s.margin && s.second)
        p += `, and finished ${secs(s.margin, lang)} ahead of ${s.second.name}`
      parts.push(p + '.')
      if (s.third) {
        parts.push(
          `${s.third.name} completed the podium${s.third.grid && s.third.grid > 3 ? ` from P${s.third.grid}` : ''}.`,
        )
      }
    }
    if (!ledAll && s.leadChanges > 0) {
      const leaders = s.lapsLed.map((l) => `${last(l)} (${l.laps})`)
      parts.push(
        uk
          ? `Лідер змінювався ${s.leadChanges} ${ukPlural(s.leadChanges, 'раз', 'рази', 'разів')}; кола в лідерах: ${list(leaders, lang)}.`
          : `The lead changed hands ${times(s.leadChanges)}; laps led: ${list(leaders, lang)}.`,
      )
    }
    out.push(parts.join(' '))
  }

  // 2. How it unfolded: start, neutralisations, strategy, rain.
  {
    const parts: string[] = []
    if (s.rain) parts.push(uk ? 'Гонка пройшла під дощем.' : 'Rain fell during the race.')
    for (const m of s.startMovers.slice(0, 1)) {
      parts.push(
        uk
          ? `Найкращий старт: ${m.name}, P${m.from} → P${m.to} після першого кола.`
          : `${m.name} made the best start, from P${m.from} to P${m.to} by the end of lap 1.`,
      )
    }
    if (s.neutralisations.length) {
      const name = (k: string, many: boolean) =>
        uk
          ? k === 'sc'
            ? 'автомобіль безпеки'
            : k === 'vsc'
              ? 'віртуальний автомобіль безпеки (VSC)'
              : many
                ? 'червоні прапори'
                : 'червоний прапор'
          : k === 'sc'
            ? 'the Safety Car'
            : k === 'vsc'
              ? 'the Virtual Safety Car'
              : 'a red flag'
      const range = (n: { from: number; to: number }) =>
        n.from === n.to
          ? `${uk ? 'коло' : 'lap'} ${n.from}`
          : `${uk ? 'кола' : 'laps'} ${n.from}–${n.to}`
      const kinds = [...new Set(s.neutralisations.map((n) => n.kind))]
      if (kinds.length === 1) {
        const k = kinds[0]
        // "laps 8–9 and 39–40": the word once, then just the ranges.
        const bare = s.neutralisations.map((n) =>
          n.from === n.to ? `${n.from}` : `${n.from}–${n.to}`,
        )
        const ranges =
          s.neutralisations.length === 1
            ? range(s.neutralisations[0])
            : `${uk ? 'кола' : 'laps'} ${list(bare, lang)}`
        const count = s.neutralisations.length
        parts.push(
          uk
            ? `${sentence(name(k, count > 1))}${count > 1 ? `, ${count} ${ukPlural(count, 'раз', 'рази', 'разів')}` : ''}: ${ranges}.`
            : `${sentence(name(k, count > 1))} came out ${times(count)} (${ranges}).`,
        )
      } else {
        const items = s.neutralisations.map(
          (n) => `${n.kind === 'vsc' ? 'VSC' : name(n.kind, false)} (${range(n)})`,
        )
        parts.push(
          uk ? `Нейтралізації: ${list(items, lang)}.` : `Neutralisations: ${list(items, lang)}.`,
        )
      }
      // Each stop counts once, under the first neutralisation it falls in
      // (a Safety Car can run straight into a red flag on the same lap).
      const counted = new Set<StoryEvent>()
      for (const n of s.neutralisations) {
        const pits = pitsUnder(s, n).filter((p) => !counted.has(p))
        pits.forEach((p) => counted.add(p))
        if (!pits.length) continue
        const who = list([...new Set(pits.map((p) => p.driver!.name))], lang)
        parts.push(
          uk
            ? `Піт-стопи під час нейтралізації (${range(n)}): ${who}.`
            : `${who} pitted under it on ${range(n)}.`,
        )
      }
    }
    if (s.stops.winner != null && s.hasTiming) {
      const winnerPits = s.events.filter((e) => e.kind === 'pit' && e.driver?.code === w.code)
      const laps = winnerPits.map((e) => e.lap)
      if (s.stops.winner === 0) {
        parts.push(uk ? `У переможця жодного піт-стопу.` : `The winner didn't stop.`)
      } else {
        parts.push(
          uk
            ? `У переможця ${s.stops.winner} ${ukPlural(s.stops.winner, 'піт-стоп', 'піт-стопи', 'піт-стопів')} (${laps.length === 1 ? 'коло' : 'кола'} ${laps.join(', ')}).`
            : `${last(w)} stopped ${times(s.stops.winner)} (lap${laps.length === 1 ? '' : 's'} ${laps.join(', ')}).`,
        )
      }
      if (s.stops.common != null && s.stops.common !== s.stops.winner) {
        parts.push(
          uk
            ? `У більшості пілотів ${s.stops.common} ${ukPlural(s.stops.common, 'піт-стоп', 'піт-стопи', 'піт-стопів')}.`
            : `Most drivers stopped ${times(s.stops.common)}.`,
        )
      }
    }
    if (parts.length) out.push(parts.join(' '))
  }

  // 3. Movers, penalties, retirements, fastest lap.
  {
    const parts: string[] = []
    if (s.climbers.length) {
      const items = s.climbers.map((c) => `${c.name} (P${c.grid} → P${c.finish})`)
      parts.push(
        uk
          ? `Найбільший прогрес: ${list(items, lang)}.`
          : `Biggest climb${items.length > 1 ? 's' : ''}: ${list(items, lang)}.`,
      )
    }
    if (s.penalties.length) {
      const items = s.penalties.map((p) => {
        const what =
          p.penalty === 'time' && p.seconds
            ? uk
              ? `${p.seconds} с штрафу`
              : `${p.seconds}-second penalty`
            : p.penalty === 'drive'
              ? uk
                ? 'проїзд через піт-лейн'
                : 'drive-through'
              : p.penalty === 'stopgo'
                ? uk
                  ? 'штраф stop-go'
                  : 'stop-go penalty'
                : uk
                  ? 'штраф'
                  : 'penalty'
        const why = penaltyReason(p.reason, lang)
        return `${p.driver?.name} (${what}${why ? `, ${why}` : ''})`
      })
      parts.push(uk ? `Штрафи: ${list(items, lang)}.` : `Penalties: ${list(items, lang)}.`)
    }
    if (s.retirements.length) {
      const items = [...s.retirements]
        .sort((a, b) => (a.lap ?? 999) - (b.lap ?? 999))
        .map(
          (r) =>
            `${r.name} (${retirementReason(r.reason, lang)}${r.lap ? `, ${uk ? 'коло' : 'lap'} ${r.lap}` : ''})`,
        )
      parts.push(
        uk
          ? `Сходи: ${list(items, lang)}.`
          : `${s.retirements.length === 1 ? 'One retirement' : `${s.retirements.length} retirements`}: ${list(items, lang)}.`,
      )
    }
    if (s.fastest) {
      parts.push(
        uk
          ? `Найшвидше коло: ${s.fastest.name}, ${s.fastest.time}${s.fastest.lap ? ` (коло ${s.fastest.lap})` : ''}.`
          : `${s.fastest.name} set the fastest lap, ${s.fastest.time}${s.fastest.lap ? ` on lap ${s.fastest.lap}` : ''}.`,
      )
    }
    if (parts.length) out.push(parts.join(' '))
  }

  // 4. Championship.
  if (s.championship) {
    const c = s.championship
    const parts: string[] = []
    const gap = c.second ? c.leader.points - c.second.points : null
    if (uk) {
      parts.push(
        `${c.leaderChanged ? 'Новий лідер чемпіонату' : 'Лідер чемпіонату'}: ${c.leader.name}, ${c.leader.points} ${ukPlural(c.leader.points, 'очко', 'очки', 'очок')}${
          gap != null && c.second ? `, на ${gap} більше, ніж у ${c.second.name}` : ''
        }.`,
      )
    } else {
      parts.push(
        `${c.leader.name} ${c.leaderChanged ? 'takes the championship lead' : 'leads the championship'} on ${c.leader.points} points${
          gap != null && c.second ? `, ${gap} ahead of ${c.second.name}` : ''
        }.`,
      )
    }
    if (c.winnerPos && c.winnerPosBefore && c.winnerPos < c.winnerPosBefore && c.winnerPos !== 1) {
      parts.push(
        uk
          ? `${w.name} піднімається в заліку з P${c.winnerPosBefore} на P${c.winnerPos}.`
          : `${w.name} moves up from P${c.winnerPosBefore} to P${c.winnerPos} in the standings.`,
      )
    }
    out.push(parts.join(' '))
  }

  return out
}

// One line for a key moment on the timeline.
// `withLaps`: false where the lap is already shown next to the text.
export function eventText(e: StoryEvent, lang: Lang, withLaps = true): string {
  const uk = lang === 'uk'
  const n = e.driver?.name ?? ''
  const range = e.to && e.to !== e.lap ? `${e.lap}–${e.to}` : `${e.lap}`
  switch (e.kind) {
    case 'lead':
      return uk ? `${n} у лідерах` : `${n} takes the lead`
    case 'sc':
      return (
        (uk ? 'Автомобіль безпеки' : 'Safety Car') +
        (withLaps ? (uk ? ` (кола ${range})` : ` (laps ${range})`) : '')
      )
    case 'vsc':
      return (
        (uk ? 'Віртуальний автомобіль безпеки' : 'Virtual Safety Car') +
        (withLaps ? (uk ? ` (кола ${range})` : ` (laps ${range})`) : '')
      )
    case 'red':
      return uk ? `Червоний прапор` : `Red flag`
    case 'pit':
      return uk ? `${n}: піт-стоп №${e.stop}` : `${n}: pit stop ${e.stop}`
    case 'penalty': {
      const what =
        e.penalty === 'time' && e.seconds
          ? uk
            ? `штраф ${e.seconds} с`
            : `${e.seconds} s penalty`
          : uk
            ? 'штраф'
            : 'penalty'
      const why = penaltyReason(e.reason, lang)
      return `${n}: ${what}${why ? `, ${why}` : ''}`
    }
    case 'dnf':
      return uk
        ? `${n}: сход, ${retirementReason(e.reason ?? '', lang)}`
        : `${n} retires: ${retirementReason(e.reason ?? '', lang)}`
    case 'fastest':
      return uk ? `${n}: найшвидше коло` : `${n}: fastest lap`
  }
}
