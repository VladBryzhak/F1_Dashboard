// schema.org JSON-LD builders. These feed Google's rich-result parser so our
// pages can show richer snippets (driver facts, event cards, breadcrumbs) and
// are understood as entities, not just text. Each builder returns a plain object
// that useSeo({ jsonLd }) serializes into a <script type="application/ld+json">.
import type { ConstructorProfile, DriverProfile, RaceWeekend } from '../types/f1'

const BASE = 'https://f1-dashboard-bryzhak.onrender.com'

// Absolute URL of the page currently being rendered (no query string).
function pageUrl(): string {
  if (typeof window === 'undefined') return BASE
  return window.location.origin + window.location.pathname
}

// Site-wide identity — emitted on the home page.
export function siteLd(): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'F1 Dashboard',
      url: BASE,
      logo: `${BASE}/apple-touch-icon.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'F1 Dashboard',
      url: BASE,
      description:
        'Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and telemetry.',
    },
  ]
}

// A driver as a schema.org Person.
export function driverLd(p: DriverProfile): object {
  const name = `${p.givenName} ${p.familyName}`
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle: 'Formula One Driver',
    nationality: p.nationality,
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

// A race weekend as a schema.org SportsEvent.
export function raceLd(w: RaceWeekend): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${w.grandPrixName} Grand Prix ${w.season}`,
    sport: 'Formula One',
    startDate: w.date,
    eventStatus: 'https://schema.org/EventScheduled',
    url: pageUrl(),
    ...(w.grandPrixName && {
      location: {
        '@type': 'Place',
        name: `${w.grandPrixName} Grand Prix`,
      },
    }),
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
      item: BASE + t.path,
    })),
  }
}
