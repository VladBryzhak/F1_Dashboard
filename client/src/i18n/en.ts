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

  // Sessions
  'session.fp1': 'Practice 1',
  'session.fp2': 'Practice 2',
  'session.fp3': 'Practice 3',
  'session.sq': 'Sprint Qualifying',
  'session.sprint': 'Sprint',
  'session.q': 'Qualifying',
  'session.race': 'Race',

  // Weekend schedule
  'sched.gp': '{name} GP',
  'sched.none': 'The session schedule has not been published yet.',
  'sched.nextSession': 'Next session',
  'sched.liveNow': 'Live now',
  'sched.live': 'LIVE',
  'sched.finished': 'Weekend finished',
  'sched.addToCalendar': 'Add to calendar',
  'sched.localTime': 'Times in your timezone · {tz}',
  'sched.tbc': 'TBC',
  'sched.dayShort': 'd',

  // Calendar page
  'cal.title': '{season} Race Results',
  'cal.loadError': 'Could not load the calendar: {error}',
  'cal.colGp': 'Grand Prix',
  'cal.colDate': 'Date',
  'cal.colWinner': 'Winner',
  'cal.colTeam': 'Team',
  'cal.upcoming': 'Upcoming',
  'cal.sprint': 'Sprint',
  'cal.viewWeekend': 'View {name} weekend',
  'cal.showSchedule': 'Show the weekend schedule',
  'cal.hideSchedule': 'Hide the weekend schedule',

  // Home
  'home.nextRace': 'Next race',

  // Circuits
  'nav.circuits': 'Circuits',
  'circ.listTitle': 'F1 Circuits',
  'circ.current': 'On the {season} calendar',
  'circ.historic': 'Historic circuits',
  'circ.search': 'Search circuits, cities or countries…',
  'circ.noMatch': 'No circuits match “{q}”.',
  'circ.loadError': 'Could not load circuits: {error}',
  'circ.loadOneError': 'Could not load this circuit: {error}',
  'circ.back': '← Back to Circuits',
  'circ.since': 'since {year}',
  'circ.years': '{from}–{to}',
  'circ.type.RACE': 'Race circuit',
  'circ.type.ROAD': 'Road circuit',
  'circ.type.STREET': 'Street circuit',
  'circ.dir.CLOCKWISE': 'Clockwise',
  'circ.dir.ANTI_CLOCKWISE': 'Anti-clockwise',
  'circ.length': 'Length',
  'circ.km': '{n} km',
  'circ.turns': 'Turns',
  'circ.racesHeld': 'Grands Prix held',
  'circ.firstGp': 'First GP',
  'circ.lapRecord': 'Race lap record',
  'circ.lapRecordNote': 'Fastest race lap on the current layout',
  'circ.noLapRecord': 'No lap record on the current layout yet.',
  'circ.mostWins': 'Most wins',
  'circ.mostTeamWins': 'Most wins · teams',
  'circ.mostPoles': 'Most pole positions',
  'circ.layouts': 'Track layouts',
  'circ.layoutYears': 'Years',
  'circ.layoutRaces': 'Races',
  'circ.winners': 'Winners',
  'circ.colYear': 'Year',
  'circ.colGp': 'Grand Prix',
  'circ.colWinner': 'Winner',
  'circ.colTeam': 'Team',
  'circ.colPole': 'Pole',
  'circ.previousNames': 'Previously known as {names}.',
  'circ.map': 'Open map',
  'circ.next': 'Next race here: {gp} · {date}',
  'circ.hostedGps': 'Grands Prix: {list}',
  'circ.viewCircuit': 'Circuit guide',
  'plural.races_one': '{n} race',
  'plural.races_other': '{n} races',
}

export type Dict = Record<keyof typeof en, string>
export default en as Dict
