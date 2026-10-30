// Page titles and meta descriptions in both languages, one place per page.
// The server builds the same text for the first HTML a visitor or crawler
// gets (server/src/services/og.ts, describePage) — keep the two in step.
import { plural, type Lang } from '../i18n/core'
import type { CircuitProfile, ConstructorProfile, DriverProfile, RaceWeekend } from '../types/f1'
import { countryName } from './countries'
import { gpTitle } from './gpNames'

export type NotFoundKind = 'page' | 'driver' | 'team' | 'circuit' | 'race'

export interface SeoText {
  title: string
  description: string
}

// Site-wide default (the home page uses it).
export const DEFAULT_SEO: Record<Lang, { title: string; description: string }> = {
  en: {
    title: 'Paddock Times: Formula 1 Standings, Calendar & Stats',
    description:
      'Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and past-race telemetry — every season from 1950 to today.',
  },
  uk: {
    title: 'Paddock Times: залік Ф1, календар і статистика Формули-1',
    description:
      "Залік Формули-1 (Ф1), календар гонок, статистика кар'єри пілотів і команд, порівняння та телеметрія: кожен сезон з 1950 року до сьогодні.",
  },
}

const uk = (lang: Lang) => lang === 'uk'
const n = (key: string, count: number) => plural(key, count, undefined, 'uk')

export const seoText = {
  standings: (season: string, lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: `Залік Ф1 ${season}: пілоти й конструктори Формули-1`,
          description: `Залік пілотів і Кубок конструкторів Формули-1 сезону ${season}: очки, перемоги та відставання від лідера.`,
        }
      : {
          title: `${season} F1 Championship Standings`,
          description: `Formula 1 drivers' and constructors' championship standings for the ${season} season: points, wins and gaps to the leader.`,
        },

  calendar: (season: string, lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: `Календар Ф1 ${season}: гонки й результати Формули-1`,
          description: `Календар гонок Формули-1 ${season} року з переможцями, командами та повними результатами кожного Гран-прі.`,
        }
      : {
          title: `${season} F1 Race Calendar & Results`,
          description: `The ${season} Formula 1 race calendar with winners, teams and full results for every Grand Prix.`,
        },

  race: (w: RaceWeekend, lang: Lang): SeoText => {
    if (uk(lang)) {
      const gp = gpTitle(w.grandPrixName, 'uk')
      return {
        title: `${gp} ${w.season}: результати Ф1, кваліфікація й практики`,
        description: `${gp} ${w.season}: повний результат гонки, стартова решітка, час кваліфікації, практики${w.sprintResults.length ? ', спринт' : ''}, найшвидше коло та пілот дня.`,
      }
    }
    return {
      title: `${w.grandPrixName} GP ${w.season}: Results, Qualifying & Practice`,
      description: `${w.grandPrixName} Grand Prix ${w.season}: full race result, starting grid, qualifying times, practice sessions${w.sprintResults.length ? ', sprint' : ''}, fastest lap and Driver of the Day.`,
    }
  },

  drivers: (season: string, lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: `Пілоти Ф1 ${season}: склад Формули-1`,
          description: `Усі пілоти Формули-1 сезону ${season} і пошук серед усіх пілотів з 1950 року, з посиланнями на повну статистику кар'єри.`,
        }
      : {
          title: `${season} F1 Drivers`,
          description: `Every Formula 1 driver on the ${season} grid, plus a searchable index of every driver since 1950, with links to full career profiles.`,
        },

  driver: (p: DriverProfile, lang: Lang): SeoText => {
    const name = `${p.givenName} ${p.familyName}`
    if (uk(lang)) {
      return {
        title: `${name}: статистика кар'єри у Ф1`,
        description: `${name} у Формулі-1: ${n('plural.titles', p.championships)}, ${n('plural.wins', p.wins)}, ${n('plural.podiums', p.podiums)} і ${n('plural.races', p.races)} у ${p.firstSeason}-${p.lastSeason} роках.`,
      }
    }
    return {
      title: `${name}: F1 Career Stats`,
      description: `${name}'s Formula 1 career: ${p.championships} title${p.championships === 1 ? '' : 's'}, ${p.wins} wins, ${p.podiums} podiums and ${p.races} races from ${p.firstSeason} to ${p.lastSeason}.`,
    }
  },

  teams: (season: string, lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: `Команди Ф1 ${season}: конструктори Формули-1`,
          description: `Усі конструктори Формули-1 сезону ${season} і пошук серед усіх команд з 1950 року, з посиланнями на повну історію кожної.`,
        }
      : {
          title: `${season} F1 Teams & Constructors`,
          description: `Formula 1 constructors on the ${season} grid, plus a searchable index of every constructor since 1950, with links to full team histories.`,
        },

  team: (p: ConstructorProfile, lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: `${p.name}: історія, титули й перемоги у Ф1`,
          description: `${p.name} у Формулі-1: ${n('plural.ctitles', p.championships)}, ${n('plural.wins', p.wins)}, ${n('plural.podiums', p.podiums)} і ${n('plural.races', p.races)} з ${p.firstSeason} року.`,
        }
      : {
          title: `${p.name}: F1 History, Titles & Wins`,
          description: `${p.name} in Formula 1: ${p.championships} constructors' title${p.championships === 1 ? '' : 's'}, ${p.wins} wins, ${p.podiums} podiums and ${p.races} races since ${p.firstSeason}.`,
        },

  circuits: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Траси Ф1: схеми, рекорди кола й переможці Формули-1',
          description:
            'Траси Формули-1 з поточного календаря та класичні: схеми, довжина, повороти, рекорди кола, конфігурації та всі переможці на кожній.',
        }
      : {
          title: 'F1 Circuits: Track Maps, Lap Records & Winners',
          description:
            'Formula 1 circuits on the current calendar and classic tracks: track maps, length, turns, race lap records, layouts and every winner at each venue.',
        },

  circuit: (c: CircuitProfile, lang: Lang): SeoText => {
    if (uk(lang)) {
      const country = countryName(c.countryCode, 'uk-UA')
      const facts = [
        c.length != null ? `${String(c.length).replace('.', ',')} км` : '',
        c.turns != null ? n('plural.turns', c.turns) : '',
        `${c.racesHeld} Гран-прі Формули-1${c.firstYear ? ` з ${c.firstYear} року` : ''}`,
      ].filter(Boolean)
      return {
        title: `${c.name}: траса Ф1, рекорд кола й переможці`,
        description: `${c.name} (${c.placeName}${country ? `, ${country}` : ''}): ${facts.join(', ')}. Рекорд кола в гонці, найуспішніші пілоти й команди та всі переможці.`,
      }
    }
    return {
      title: `${c.name}: F1 Circuit Guide, Lap Record & Winners`,
      description: `${c.name} (${c.placeName}): ${[
        c.length != null ? `${c.length} km` : '',
        c.turns != null ? `${c.turns} turns` : '',
        `${c.racesHeld} Formula 1 Grands Prix${c.firstYear ? ` since ${c.firstYear}` : ''}`,
      ]
        .filter(Boolean)
        .join(', ')}. Race lap record, most successful drivers and teams, and every winner.`,
    }
  },

  compare: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Порівняння пілотів Ф1',
          description:
            "Порівняйте двох будь-яких пілотів Формули-1: титули, перемоги, подіуми, очки та очні дуелі за кар'єру або окремий сезон.",
        }
      : {
          title: 'F1 Driver Comparison: Head to Head',
          description:
            'Compare any two Formula 1 drivers head-to-head: championships, wins, podiums, points and their race-by-race record, over a career or a single season.',
        },

  live: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Live-таймінг Ф1',
          description:
            'Live-таймінг Формули-1: позиції, відставання, час кіл, сектори, мінісектори та шини з деталями по кожному пілоту.',
        }
      : {
          title: 'Live Timing',
          description:
            'Live Formula 1 timing board: positions, gaps, lap times, sectors, mini-sectors and tyres, with expandable per-driver detail.',
        },

  telemetry: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Телеметрія Ф1: швидкість, газ і гальма',
          description:
            'Телеметрія гонок Формули-1: швидкість, газ, гальма, передача та DRS по колах, з 2023 року (OpenF1).',
        }
      : {
          title: 'F1 Telemetry: Speed, Throttle & Lap Traces',
          description:
            'Past-race Formula 1 telemetry: speed, throttle, brake, gear and DRS traces lap by lap, from 2023 onward (OpenF1).',
        },

  about: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Про проєкт',
          description:
            'Про Paddock Times: незалежний фанатський сайт зі статистикою Формули-1, звідки дані (f1db, OpenF1, Wikimedia Commons), точність і незалежність.',
        }
      : {
          title: 'About',
          description:
            'About Paddock Times: an independent, fan-made Formula 1 statistics site: where the data comes from (f1db, OpenF1, Wikimedia Commons), accuracy and independence.',
        },

  privacy: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Політика конфіденційності',
          description:
            'Як Paddock Times працює з даними: Google Analytics, що зберігається у браузері, форма відгуку, сторонній контент і хостинг.',
        }
      : {
          title: 'Privacy Policy',
          description:
            'How Paddock Times handles data: Google Analytics, what is stored in your browser, the feedback form, third-party content and hosting.',
        },

  support: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Підтримати Paddock Times',
          description:
            'Сайт Paddock Times безкоштовний, без реклами й облікових записів. Донати допомагають оплачувати хостинг і розробку.',
        }
      : {
          title: 'Support Paddock Times',
          description:
            'Paddock Times is free, with no ads and no accounts. Donations help pay for hosting and development.',
        },

  // The "not found" page (an address that leads nowhere, or a driver, team,
  // circuit or race that doesn't exist). The server sends the generic one
  // with its 404 (NOT_FOUND_META in server/src/services/pageHtml.ts).
  notFound: (kind: NotFoundKind, lang: Lang): SeoText => {
    const titles: Record<NotFoundKind, [string, string]> = {
      page: ['Page not found', 'Сторінку не знайдено'],
      driver: ['Driver not found', 'Пілота не знайдено'],
      team: ['Team not found', 'Команду не знайдено'],
      circuit: ['Circuit not found', 'Трасу не знайдено'],
      race: ['Race not found', 'Гонку не знайдено'],
    }
    return uk(lang)
      ? {
          title: titles[kind][1],
          description:
            'За цією адресою на Paddock Times нічого немає. Залік, календар, пілоти, команди й траси Формули-1 за один клік.',
        }
      : {
          title: titles[kind][0],
          description:
            'There is no page at this address on Paddock Times. Formula 1 standings, calendar, drivers, teams and circuits are a click away.',
        }
  },

  feedback: (lang: Lang): SeoText =>
    uk(lang)
      ? {
          title: 'Відгук',
          description: 'Надішліть відгук, повідомте про помилку чи запропонуйте функцію для Paddock Times.',
        }
      : {
          title: 'Feedback',
          description: 'Send feedback, report a bug or suggest a feature for Paddock Times.',
        },
}
