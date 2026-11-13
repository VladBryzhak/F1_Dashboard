// schema.org JSON-LD builders. These feed Google's rich-result parser so our
// pages can show richer snippets (driver facts, event cards, breadcrumbs) and
// are understood as entities, not just text. Each builder returns a plain object
// that useSeo({ jsonLd }) serializes into a <script type="application/ld+json">.
// The server writes the same into the page's HTML for crawlers that don't run
// the app (server/src/services/jsonld.ts): keep the two in step.
import { getLang, localizedPath } from '../i18n/core'
import type { Article, ConstructorProfile, DriverProfile, RaceWeekend } from '../types/f1'
import { gpTitle } from './gpNames'
import { TELEGRAM_URL } from './telegram'
import { driverName } from './ukNames'

const BASE = 'https://paddocktimes.com'

// Absolute URL of the page currently being rendered (no query string).
function pageUrl(): string {
  if (typeof window === 'undefined') return BASE
  return window.location.origin + window.location.pathname
}

// The page's preview card in Google's three article shapes (16:9, 4:3, 1:1).
function cards(path: string): string[] {
  const png = `${BASE}/og${localizedPath(path, getLang())}.png`
  return [png, `${png}?r=4x3`, `${png}?r=1x1`]
}

const SITE_DESCRIPTION = {
  en: 'Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and telemetry.',
  uk: 'Турнірна таблиця, календар і результати Формули-1, статистика пілотів і команд, порівняння й телеметрія.',
}

// Site-wide identity — emitted on the home page.
export function siteLd(): object[] {
  const description = SITE_DESCRIPTION[getLang()]
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Paddock Times',
      alternateName: 'Paddock Times F1',
      url: BASE,
      logo: `${BASE}/apple-touch-icon.png`,
      description,
      ...(TELEGRAM_URL && { sameAs: [TELEGRAM_URL] }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Paddock Times',
      alternateName: 'Paddock Times F1',
      url: BASE,
      inLanguage: ['en', 'uk'],
      description,
    },
  ]
}

// A driver as a schema.org Person.
// On a Ukrainian page the name is the Ukrainian spelling, with the Latin one
// as alternateName.
export function driverLd(p: DriverProfile, uk = false): object {
  const latin = `${p.givenName} ${p.familyName}`
  const name = driverName(p.driverId, p.givenName, p.familyName, uk)
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    ...(name !== latin && { alternateName: latin }),
    givenName: p.givenName,
    familyName: p.familyName,
    jobTitle: 'Formula One Driver',
    nationality: p.nationality,
    ...(p.dateOfBirth && { birthDate: p.dateOfBirth }),
    ...(p.dateOfDeath && { deathDate: p.dateOfDeath }),
    ...(p.placeOfBirth && {
      birthPlace: {
        '@type': 'Place',
        name: p.placeOfBirth,
        ...(p.birthCountryCode && {
          address: { '@type': 'PostalAddress', addressCountry: p.birthCountryCode.toUpperCase() },
        }),
      },
    }),
    url: pageUrl(),
  }
  if (p.championships > 0) {
    ld.award = `${p.championships}× Formula One World Champion`
  }
  return ld
}

// A constructor as a schema.org SportsTeam.
export function teamLd(p: ConstructorProfile): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: p.name,
    sport: 'Formula One',
    url: pageUrl(),
  }
  if (p.championships > 0) {
    ld.award = `${p.championships}× Formula One Constructors' Champion`
  }
  return ld
}

// The weekend from its first session to about two hours after the race
// start (dates alone without times): server/src/services/jsonld.ts eventSpan.
function eventSpan(w: RaceWeekend): { start: string; end: string } {
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const sessions = w.sessions ?? []
  const known = sessions
    .filter((s) => s.timeKnown)
    .map((s) => Date.parse(s.start))
    .filter((t) => !Number.isNaN(t))
  const race = sessions.find((s) => s.kind === 'RACE' && s.timeKnown)
  const first = sessions.map((s) => s.start.slice(0, 10)).sort()[0]
  return {
    start: known.length ? iso(Math.min(...known)) : (first ?? w.date),
    end: race ? iso(Date.parse(race.start) + 2 * 3600_000) : w.date,
  }
}

// A race weekend as a schema.org SportsEvent, with what Google's event
// guidelines ask for (address, start and end, description, images).
export function raceLd(w: RaceWeekend): object {
  const uk = getLang() === 'uk'
  const { start, end } = eventSpan(w)
  const sprint = (w.sessions ?? []).some((s) => s.kind === 'SPRINT')
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: uk ? `${gpTitle(w.grandPrixName, 'uk')} ${w.season}` : `${w.grandPrixName} Grand Prix ${w.season}`,
    description: uk
      ? `${w.round}-й етап чемпіонату світу Формули-1 ${w.season} року: практики, ${sprint ? 'спринт, ' : ''}кваліфікація й гонка.`
      : `Round ${w.round} of the ${w.season} FIA Formula One World Championship: practice, ${sprint ? 'the sprint, ' : ''}qualifying and the race.`,
    sport: 'Formula One',
    startDate: start,
    endDate: end,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: w.circuitName,
      address: {
        '@type': 'PostalAddress',
        ...(w.placeName && { addressLocality: w.placeName }),
        ...(w.countryCode && { addressCountry: w.countryCode.toUpperCase() }),
      },
    },
    image: cards(`/calendar/${w.season}/${w.round}`),
    organizer: { '@type': 'Organization', name: 'Formula 1', url: 'https://www.formula1.com' },
    url: pageUrl(),
  }
}

// An article's day as a full date-time, which Google's article checks ask for:
// the start of that day in Kyiv, with its offset (+02:00, or +03:00 in summer).
export function articleTime(date: string): string {
  const at = new Date(`${date}T12:00:00Z`)
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')
    ?.value.replace('GMT', '')
  return `${date}T00:00:00${off || '+00:00'}`
}

// An article of ours as a schema.org NewsArticle; its image is the page's
// link-preview card (server/src/services/jsonld.ts articleLd builds the same).
export function articleLd(a: Article): object {
  const path = localizedPath(`/articles/${a.slug}`, getLang())
  const org = { '@type': 'Organization', name: 'Paddock Times', url: BASE }
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title,
    description: a.description,
    datePublished: articleTime(a.date),
    dateModified: articleTime(a.date),
    image: cards(`/articles/${a.slug}`),
    url: BASE + path,
    mainEntityOfPage: BASE + path,
    author: { ...org, url: BASE + localizedPath('/about', getLang()) },
    publisher: { ...org, logo: { '@type': 'ImageObject', url: `${BASE}/apple-touch-icon.png` } },
  }
}

// Breadcrumb trail (e.g. Home › Drivers › Lewis Hamilton) for sub-pages.
export function breadcrumbLd(
  trail: { name: string; path: string }[],
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: BASE + localizedPath(t.path, getLang()),
    })),
  }
}

// A section's list page (and its season version): Home › Section [› season],
// as the server writes it (server/src/services/jsonld.ts listPage).
export function sectionLd(home: string, name: string, path: string, season?: string): object {
  return breadcrumbLd([
    { name: home, path: '/' },
    { name, path },
    ...(season ? [{ name: season, path: `${path}/${season}` }] : []),
  ])
}
