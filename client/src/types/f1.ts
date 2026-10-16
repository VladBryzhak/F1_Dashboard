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
  seasons: DriverSeasonEntry[]
}

export interface ConstructorSeasonEntry {
  season: number
  position: number
  points: number
  wins: number
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
  news: NewsItem[]
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
  sessionBest: { lap: number | null; sectors: (number | null)[] }
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
  pits: { num: number; from: number; to: number }[]
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
  name: string; // full name, e.g. "Circuit of the Americas"
  placeName: string
  countryCode: string | null
  nationality: string
  type: string; // RACE | ROAD | STREET
  racesHeld: number
  firstYear: number | null
  lastYear: number | null
  onCurrentCalendar: boolean
}

export interface CircuitLayoutInfo {
  layoutId: string
  length: number | null; // km
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
  id: string; // driverId or constructorId
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
  length: number | null; // current layout, km
  turns: number | null
  grandsPrix: string[]
  layouts: CircuitLayoutInfo[]
  lapRecord: CircuitLapRecord | null; // race lap record on the current layout
  topDrivers: CircuitTally[]
  topConstructors: CircuitTally[]
  topPoles: CircuitTally[]
  races: CircuitRace[]; // newest first, completed races only
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
  number: number; // 1..4
  results: PracticeEntry[]
}
