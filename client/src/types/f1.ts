// Mirrors the normalized shapes returned by our backend (server/src/types/f1.ts).

export interface DriverStanding {
  position: number
  points: number
  wins: number
  driverId: string
  givenName: string
  familyName: string
  nationality: string
  countryCode: string | null
  permanentNumber: string | null
  code: string | null
  constructorId: string
  constructorName: string
}

export interface ConstructorStanding {
  position: number
  points: number
  wins: number
  constructorId: string
  name: string
  nationality: string
  countryCode: string | null
}

export interface StandingsResponse<T> {
  season: string
  round: string
  standings: T[]
}

export interface DriverSeasonEntry {
  season: number
  constructorId: string
  constructorName: string
  position: number
  points: number
  wins: number
}

export interface DriverProfile {
  driverId: string
  givenName: string
  familyName: string
  nationality: string
  countryCode: string | null
  permanentNumber: string | null
  code: string | null
  firstSeason: number
  lastSeason: number
  championships: number
  wins: number
  podiums: number
  points: number
  races: number
  photoUrl?: string | null
  seasons: DriverSeasonEntry[] // ascending by season
  fullName: string | null
  dateOfBirth: string | null // yyyy-mm-dd
  dateOfDeath: string | null
  placeOfBirth: string | null
  birthCountryCode: string | null
  poles: number
  fastestLaps: number
  sprintWins: number
  grandSlams: number
  driverOfTheDay: number
  bestResult: number | null
  bestGrid: number | null
  bestChampionship: number | null
  family: { driverId: string; name: string; relation: string }[] // relation: f1db type (CHILD, SIBLING…)
  recentRaces: DriverRecentRace[] // newest first
}

export interface DriverRecentRace {
  season: number
  round: number
  grandPrixName: string
  positionText: string
  constructorId: string
  points: number
}

export interface ConstructorSeasonEntry {
  season: number
  position: number
  points: number
  wins: number
  drivers: { driverId: string; name: string }[] // race drivers that season
  engine: string | null
}

export interface ConstructorProfile {
  constructorId: string
  name: string
  nationality: string
  countryCode: string | null
  firstSeason: number
  lastSeason: number
  championships: number
  wins: number
  podiums: number
  points: number
  races: number
  seasons: ConstructorSeasonEntry[]
  fullName: string | null
  poles: number
  fastestLaps: number
  oneTwos: number
  sprintWins: number
  // Names the team raced under, oldest first (empty if it never changed).
  lineage: { constructorId: string; name: string; yearFrom: number; yearTo: number | null }[]
  engines: { name: string; yearFrom: number; yearTo: number }[]
}

export interface CalendarRace {
  round: number
  grandPrixId: string
  name: string
  officialName: string
  date: string
  circuitId: string
  circuitName: string
  placeName: string
  nationality: string
  countryCode: string | null
  winnerDriverId: string | null
  winnerName: string | null
  winnerConstructorId: string | null
  winnerConstructorName: string | null
  isSprint: boolean
  sessions: CalendarSession[]
}

// One session of a race weekend. Practice, sprint qualifying, sprint,
// qualifying, race.
export interface CalendarSession {
  kind: 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'SPRINT' | 'Q' | 'RACE'
  start: string // UTC ISO timestamp, or yyyy-mm-dd when timeKnown is false
  timeKnown: boolean
}

export interface CalendarResponse {
  season: string
  races: CalendarRace[]
}

export interface RaceResult {
  positionText: string
  driverId: string
  driverName: string
  driverCode: string | null
  nationality: string
  countryCode: string | null
  constructorId: string
  constructorName: string
  timeDisplay: string
  laps: number | null
  points: number
}

export interface RaceResultResponse {
  season: string
  round: string
  raceName: string
  officialName: string
  date: string
  results: RaceResult[]
}

// ----- Home page: dynamic weekend highlights + news -----

export interface PodiumEntry {
  position: number
  driverId: string
  driverName: string
  driverCode: string | null
  number: string | null // car number in that race
  constructorId: string
  constructorName: string
  countryCode: string | null
}

export interface RaceHighlight {
  season: number
  round: number
  grandPrixName: string
  date: string
  countryCode: string | null
  podium: PodiumEntry[]
}

export interface NotableRetirement {
  driverId: string
  driverName: string
  constructorId: string
  reason: string
}

export interface NextRace {
  round: number
  grandPrixName: string
  date: string
  countryCode: string | null
  circuitId: string
  placeName: string
  outline: CircuitOutline | null
}

export interface LeaderSummary {
  driverId: string
  driverName: string
  constructorId: string
  constructorName: string
  points: number
}

export interface HomeHighlights {
  season: number
  latestRace: RaceHighlight | null
  notableRetirement: NotableRetirement | null
  championshipLeader: LeaderSummary | null
  nextRace: NextRace | null
}

export interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
}

export interface HomeResponse {
  highlights: HomeHighlights
  standings: DriverStanding[] // championship top 5
  // null only in the payload inlined into the HTML when the feed wasn't
  // cached yet; the client then fetches /api/home for it.
  news: NewsItem[] | null
  heroImage: string | null // winner portrait for the hero (preloaded)
  // Responsive variants of heroImage for <img srcset>/<link imagesrcset>; the
  // same strings feed the preload and the image so the browser reuses it.
  heroSrcSet: string | null
  heroSizes: string
}

// ----- Championship progression (title-race chart) -----

export interface ProgressionSeries {
  driverId: string
  driverName: string
  driverCode: string | null
  constructorId: string
  finalPosition: number
  points: number[]
}

export interface SeasonProgression {
  season: number
  rounds: number[]
  grandPrixNames: string[]
  series: ProgressionSeries[]
}

// ----- Head-to-head driver comparison -----

export interface DriverListItem {
  driverId: string
  name: string
  nationality: string
  countryCode: string | null
  firstSeason: number
  lastSeason: number
  races: number
  podiums: number
}

export interface ConstructorListItem {
  constructorId: string
  name: string
  nationality: string
  countryCode: string | null
  firstSeason: number
  lastSeason: number
  races: number
  podiums: number
}

export interface TeamImage {
  url: string
  type: 'logo' | 'car'
}

export interface HeadToHead {
  sharedSeasons: number[]
  racesTogether: number
  aheadA: number
  aheadB: number
}

export interface DriverComparison {
  a: DriverProfile
  b: DriverProfile
  headToHead: HeadToHead
}

export interface SeasonDriverStats {
  driverId: string
  givenName: string
  familyName: string
  nationality: string
  countryCode: string | null
  constructorId: string
  constructorName: string
  raced: boolean
  championshipPosition: number | null
  points: number
  wins: number
  podiums: number
  poles: number
  fastestLaps: number
  bestFinish: number | null
  races: number
}

export interface SeasonComparison {
  season: number
  a: SeasonDriverStats
  b: SeasonDriverStats
  headToHead: { racesTogether: number; aheadA: number; aheadB: number }
}

// ----- Teammate duels (one team, one season) -----

export interface DuelDriver {
  driverId: string
  name: string
  code: string | null
  countryCode: string | null
  nationality: string
  races: number // starts for this team
  points: number // race + sprint points scored for this team
  wins: number
  podiums: number
  poles: number
  dnfs: number
  bestFinish: number | null
}

// Who was ahead in one round: the duel's driver 'a', 'b', or null when the
// round doesn't count (one of them didn't take part / no classification).
export type DuelSide = 'a' | 'b' | null

export interface DuelRound {
  round: number
  grandPrix: string // f1db Grand Prix name, e.g. 'Italy'
  quali: DuelSide
  race: DuelSide
}

export interface TeammateDuel {
  a: string // driverId
  b: string
  quali: { a: number; b: number }
  race: { a: number; b: number }
  // Median qualifying gap a − b in ms over rounds where both set a time in
  // the same session (negative = a faster); null when no times are known.
  qualiGapMs: number | null
  qualiGapRounds: number
  rounds: DuelRound[]
}

export interface TeammateDuels {
  constructorId: string
  season: number
  seasons: number[] // every season the team raced, newest first
  drivers: DuelDriver[]
  duels: TeammateDuel[]
}

// ----- Race weekend detail -----

export interface QualifyingEntry {
  position: number | null
  driverId: string
  driverName: string
  driverCode: string | null
  constructorId: string
  constructorName: string
  q1: string | null
  q2: string | null
  q3: string | null
}

export interface WeekendResult extends RaceResult {
  gridPosition: number | null
  positionsGained: number | null
}

export interface WeekendHighlight {
  driverId: string
  driverName: string
  constructorId: string
  constructorName: string
  detail: string
}

export interface RaceWeekend {
  season: string
  round: number
  grandPrixName: string
  officialName: string
  date: string
  countryCode: string | null
  circuitId: string
  circuitName: string
  qualifying: QualifyingEntry[]
  results: WeekendResult[]
  sprintResults: WeekendResult[]
  sprintQualifying: QualifyingEntry[]
  practices: PracticeSession[]
  sessions: CalendarSession[] // weekend schedule, for session order/dates
  fastestLap: WeekendHighlight | null
  driverOfTheDay: WeekendHighlight | null
}

export interface TelemetrySession {
  sessionKey: number
  name: string
  location: string
  circuit: string
  date: string
}

export interface SessionDriver {
  driverNumber: number
  fullName: string
  acronym: string
  team: string
  colour: string
}

export interface DriverLap {
  lapNumber: number
  lapDuration: number | null
  sector1: number | null
  sector2: number | null
  sector3: number | null
  isPitOutLap: boolean
}

export interface TelemetryPoint {
  t: number
  speed: number
  throttle: number
  brake: number
  gear: number
  drs: number
}

export interface LapTelemetry {
  sessionKey: number
  driverNumber: number
  lapNumber: number
  points: TelemetryPoint[]
}

// --- Live timing (OpenF1) ---
export interface LiveSessionMeta {
  sessionKey: number
  sessionName: string
  location: string
  countryName: string
  year: number
  dateStart: string
  dateEnd: string | null
  isRace: boolean
}

export interface LiveBoardRow {
  driverNumber: number
  position: number | null
  code: string
  fullName: string
  teamName: string
  teamColour: string | null
  gapToLeader: string | null
  interval: string | null
  lastLap: number | null
  bestLap: number | null
  tyreCompound: string | null
  tyreAge: number | null
}

export interface LiveBoard {
  session: LiveSessionMeta
  rows: LiveBoardRow[]
  sessionBest: {
    lap: number | null
    sectors: (number | null)[]
    sectorDrivers: (number | null)[] // driver number holding each best sector
  }
  weather: WeatherSample | null
}

export interface LiveLap {
  lapNumber: number
  lapDuration: number | null
  sectors: (number | null)[]
  segments: number[][]
  speeds: { i1: number | null; i2: number | null; st: number | null }
  isPitOut: boolean
}

export interface LiveStint {
  stintNumber: number
  compound: string | null
  lapStart: number
  lapEnd: number
  tyreAgeAtStart: number | null
}

export interface LivePit {
  lapNumber: number | null
  pitDuration: number | null
}

export interface LiveDriverDetail {
  driverNumber: number
  laps: LiveLap[]
  bestLap: number | null
  bestSectors: (number | null)[]
  stints: LiveStint[]
  pits: LivePit[]
}

// --- Session replay ---
export interface ReplayLap {
  num: number
  lap: number
  t: number
  d: number | null
  s: (number | null)[]
  sc: string[]
  seg: number[][]
  sp: (number | null)[]
  gl: string | null
  iv: string | null
}
export interface ReplayDriver {
  num: number
  code: string
  name: string
  colour: string | null
}
export interface ReplayStint {
  num: number
  compound: string | null
  start: number
  end: number
  age: number | null
}
export interface ReplayData {
  session: LiveSessionMeta
  startMs: number
  endMs: number
  drivers: ReplayDriver[]
  laps: ReplayLap[]
  pos: { num: number; p: number; t: number }[]
  stints: ReplayStint[]
  flags: { t: number; s: string }[]
  pits: { num: number; from: number; to: number; at: number; lane: number | null }[] // from–to = off the racing line
  track: TrackLine | null // racing line + pit lane for the track map
  weather: WeatherSample[]
}

export interface LiveStatus {
  live: LiveSessionMeta | null
  next: LiveSessionMeta | null
  last: LiveSessionMeta | null
  boardSessionKey: number | null
  locked: boolean
}

// ---------- Circuits ----------

export interface CircuitSummary {
  circuitId: string
  name: string // full name, e.g. "Circuit of the Americas"
  placeName: string
  countryCode: string | null
  nationality: string
  type: string // RACE | ROAD | STREET
  racesHeld: number
  firstYear: number | null
  lastYear: number | null
  onCurrentCalendar: boolean
  outline: CircuitOutline | null
}

export interface CircuitLayoutInfo {
  layoutId: string
  length: number | null // km
  turns: number | null
  firstYear: number
  lastYear: number
  races: number
}

export interface CircuitLapRecord {
  time: string
  year: number
  driverId: string
  driverName: string
  constructorId: string
  constructorName: string
}

export interface CircuitTally {
  id: string // driverId or constructorId
  name: string
  count: number
}

export interface CircuitRace {
  year: number
  round: number
  grandPrixName: string
  winnerDriverId: string | null
  winnerName: string | null
  winnerConstructorId: string | null
  winnerConstructorName: string | null
  poleDriverName: string | null
}

export interface CircuitProfile extends CircuitSummary {
  shortName: string
  previousNames: string | null
  direction: string | null
  latitude: number | null
  longitude: number | null
  length: number | null // current layout, km
  turns: number | null
  grandsPrix: string[]
  layouts: CircuitLayoutInfo[]
  lapRecord: CircuitLapRecord | null // race lap record on the current layout
  topDrivers: CircuitTally[]
  topConstructors: CircuitTally[]
  topPoles: CircuitTally[]
  races: CircuitRace[] // newest first, completed races only
  nextRace: { season: number; round: number; date: string; grandPrixName: string } | null
}

export interface PracticeEntry {
  positionText: string
  driverId: string
  driverName: string
  driverCode: string | null
  constructorId: string
  constructorName: string
  time: string | null
  gap: string | null
  laps: number | null
}

export interface PracticeSession {
  number: number // 1..4
  results: PracticeEntry[]
}

// Lap chart + tyre strategy for one race/sprint (OpenF1, 2023+).
export interface StrategyDriver {
  num: number
  code: string
  name: string
  colour: string | null // team hex without '#'
  grid: number | null // starting position (lap 0)
  positions: (number | null)[] // index = lap number (1-based; [0] = grid)
  finish: number | null // position after the last lap the car completed
  retired: boolean // stopped before the chequered flag
}

export interface StrategyStint {
  num: number
  compound: string | null
  start: number
  end: number
}

export interface RaceStrategy {
  sessionKey: number
  kind: 'race' | 'sprint'
  totalLaps: number
  drivers: StrategyDriver[] // ordered by finish
  stints: StrategyStint[]
}

// One OpenF1 weather sample (about one a minute through a session).
export interface WeatherSample {
  t: number // epoch ms
  air: number | null // °C
  track: number | null // °C
  humidity: number | null // %
  rain: boolean
  wind: number | null // m/s
  windDir: number | null // degrees
}

// Global search index (compact tuples).
export interface SearchIndex {
  // [driverId, name, firstSeason, lastSeason, races, countryCode]
  drivers: [string, string, number, number, number, string | null][]
  // [constructorId, name, firstSeason, lastSeason, races, countryCode]
  teams: [string, string, number, number, number, string | null][]
  // [circuitId, name, placeName, countryCode]
  circuits: [string, string, string, string | null][]
  // [season, round, grandPrixName, countryCode] — completed races, newest first
  races: [number, number, string, string | null][]
}

// A circuit drawn as one SVG path (viewBox 0..w × 0..h, longest side 100),
// rotated to suit a landscape card. `start` is the first point of the line.
export interface CircuitOutline {
  d: string
  w: number
  h: number
  start: [number, number]
  rotation: number
}

// A past session available in the replay player.
export interface ReplaySession {
  sessionKey: number
  meetingKey: number // groups the sessions of one race weekend
  year: number
  location: string
  date: string // session start, ISO
  sessionName: string // "Practice 1" … "Qualifying", "Sprint", "Race"
  isSprint: boolean
}

// Replay track map data for one circuit (see scripts/build-track-lines.mjs).
export interface TrackLine {
  name: string
  lapTime: number // reference lap, seconds
  sectors: [number, number] // reference-lap time at the end of S1 and S2
  w: number // drawing size (longest side 100)
  h: number
  line: [number, number][] // racing line, one point every 0.25 s of the reference lap
  pit: {
    entry: number // reference-lap time where the pit lane leaves the line
    exit: number // … and rejoins it (next lap)
    offset: number // seconds from OpenF1's pit `date` to leaving the line
    box: [number, number] | null // stationary stretch, seconds after leaving
    lane: number // the reference stop's pit-lane time
    path: [number, number, number][] // [x, y, seconds after leaving the line]
  } | null
}
