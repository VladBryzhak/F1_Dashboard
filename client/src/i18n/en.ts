// English strings — the source of truth for keys. Every key here must also
// exist in uk.ts (TypeScript enforces it via the Dict type).
const en = {
  // Navigation
  'nav.home': 'Home',
  'nav.live': 'Live',
  'nav.standings': 'Standings',
  'nav.calendar': 'Calendar',
  'nav.drivers': 'Drivers',
  'nav.teams': 'Teams',
  'nav.compare': 'Compare',
  'nav.telemetry': 'Telemetry',
  'nav.feedback': 'Feedback',
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',
  'nav.liveOn': 'Session live now',
  'nav.liveOff': 'No session live',
  'lang.label': 'Interface language',

  // Footer
  'footer.tagline': 'Formula 1 standings, calendars and career stats — 1950 to today.',
  'footer.explore': 'Explore',
  'footer.credits': 'Data & credits',
  'footer.dataBy': 'Data by',
  'footer.telemetryBy': 'Telemetry by',
  'footer.flagsBy': 'Flag icons by',
  'footer.photosVia': 'Driver photos and team logos/photos via',
  'footer.photosLicense': '(CC BY-SA / public domain, by their respective authors)',
  'footer.legal': 'Legal',
  'footer.trademark':
    'Driver and car images are © Formula 1. F1, FORMULA 1 and related marks are trademarks of Formula One Licensing B.V.',
  'footer.independent':
    'An independent, fan-made project — not affiliated with, endorsed by, or associated with Formula 1, Formula One Management or the FIA.',
  'footer.analytics': 'This site uses Google Analytics to measure site traffic.',

  // Cookie banner
  'cookie.label': 'Cookie notice',
  'cookie.text':
    'F1 Dashboard uses cookies for analytics to understand how the site is used. You can accept or decline.',
  'cookie.decline': 'Decline',
  'cookie.accept': 'Accept',

  // Common
  'common.loading': 'Loading…',
  'common.season': 'Season',
  'common.round': 'Round',
  'common.next': 'Next',
}

export type Dict = Record<keyof typeof en, string>
export default en as Dict
