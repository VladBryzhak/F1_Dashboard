// Normalized F1 domain types returned by our backend to the client.
// These intentionally flatten the verbose Jolpica/Ergast response shapes.

export interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driverId: string;
  givenName: string;
  familyName: string;
  nationality: string;
  countryCode: string | null; // ISO alpha-2, lowercase (for flag images)
  permanentNumber: string | null;
  code: string | null;
  constructorId: string;
  constructorName: string;
}

export interface ConstructorStanding {
  position: number;
  points: number;
  wins: number;
  constructorId: string;
  name: string;
  nationality: string;
  countryCode: string | null; // ISO alpha-2, lowercase (for flag images)
}

export interface StandingsResponse<T> {
  season: string;
  round: string;
  standings: T[];
}

export interface DriverSeasonEntry {
  season: number;
  constructorId: string;
  constructorName: string;
  position: number;
  points: number;
  wins: number;
}

export interface DriverProfile {
  driverId: string;
  givenName: string;
  familyName: string;
  nationality: string;
  countryCode: string | null;
  permanentNumber: string | null;
  code: string | null;
  firstSeason: number;
  lastSeason: number;
  championships: number;
  wins: number;
  podiums: number;
  points: number;
  races: number;
  photoUrl?: string | null; // Wikimedia Commons photo, when found
  seasons: DriverSeasonEntry[]; // ascending by season
}

export interface ConstructorSeasonEntry {
  season: number;
  position: number;
  points: number;
  wins: number;
}

export interface ConstructorProfile {
  constructorId: string;
  name: string;
  nationality: string;
  countryCode: string | null;
  firstSeason: number;
  lastSeason: number;
  championships: number;
  wins: number;
  podiums: number;
  points: number;
  races: number;
  seasons: ConstructorSeasonEntry[]; // ascending by season
}

export interface CalendarRace {
  round: number;
  grandPrixId: string;
  name: string;
  officialName: string;
  date: string; // ISO yyyy-mm-dd
  circuitName: string;
  placeName: string;
  nationality: string; // GP country demonym (for flag lookup)
  countryCode: string | null; // ISO alpha-2, lowercase (for flag images)
  winnerDriverId: string | null;
  winnerName: string | null;
  winnerConstructorId: string | null;
  winnerConstructorName: string | null;
}

export interface CalendarResponse {
  season: string;
  races: CalendarRace[];
}

export interface RaceResult {
  positionText: string; // "1".."20", "DNF", "NC", "DSQ"
  driverId: string;
  driverName: string;
  driverCode: string | null;
  nationality: string;
  countryCode: string | null;
  constructorId: string;
  constructorName: string;
  timeDisplay: string; // winner total time / "+gap" / "+N laps" / retirement
  laps: number | null;
  points: number;
}

export interface RaceResultResponse {
  season: string;
  round: string;
  raceName: string;
  officialName: string;
  date: string;
  results: RaceResult[];
}

// ----- Home page: dynamic weekend highlights + news -----

export interface PodiumEntry {
  position: number; // 1..3
  driverId: string;
  driverName: string;
  driverCode: string | null;
  constructorId: string;
  constructorName: string;
  countryCode: string | null;
}

export interface RaceHighlight {
  season: number;
  round: number;
  grandPrixName: string;
  date: string;
  countryCode: string | null;
  podium: PodiumEntry[]; // P1..P3, ascending by position
}

export interface NotableRetirement {
  driverId: string;
  driverName: string;
  constructorId: string;
  reason: string; // e.g. "Collision", "Accident"
}

export interface NextRace {
  round: number;
  grandPrixName: string;
  date: string;
  countryCode: string | null;
}

export interface LeaderSummary {
  driverId: string;
  driverName: string;
  constructorId: string;
  constructorName: string;
  points: number;
}

export interface HomeHighlights {
  season: number;
  latestRace: RaceHighlight | null;
  notableRetirement: NotableRetirement | null;
  championshipLeader: LeaderSummary | null;
  nextRace: NextRace | null;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string; // ISO
}

export interface HomeResponse {
  highlights: HomeHighlights;
  news: NewsItem[];
}

// ----- Championship progression (title-race chart) -----

export interface ProgressionSeries {
  driverId: string;
  driverName: string;
  driverCode: string | null;
  constructorId: string;
  finalPosition: number;
  points: number[]; // cumulative points, aligned to `rounds`
}

export interface SeasonProgression {
  season: number;
  rounds: number[];
  grandPrixNames: string[]; // short GP labels, aligned to `rounds`
  series: ProgressionSeries[]; // top drivers, ordered by final position
}

// ----- Head-to-head driver comparison -----

export interface DriverListItem {
  driverId: string;
  name: string;
  nationality: string;
  countryCode: string | null;
  firstSeason: number;
  lastSeason: number;
  races: number;
  podiums: number;
}

export interface HeadToHead {
  sharedSeasons: number[];
  racesTogether: number;
  aheadA: number; // races where driver A finished ahead of B
  aheadB: number;
}

export interface DriverComparison {
  a: DriverProfile;
  b: DriverProfile;
  headToHead: HeadToHead;
}

// ----- Race weekend detail -----

export interface QualifyingEntry {
  position: number | null;
  driverId: string;
  driverName: string;
  driverCode: string | null;
  constructorId: string;
  constructorName: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface WeekendResult extends RaceResult {
  gridPosition: number | null;
  positionsGained: number | null; // grid − finish (positive = places gained)
}

export interface WeekendHighlight {
  driverId: string;
  driverName: string;
  constructorId: string;
  constructorName: string;
  detail: string; // fastest-lap time / "30%" driver-of-the-day share
}

export interface RaceWeekend {
  season: string;
  round: number;
  grandPrixName: string;
  officialName: string;
  date: string;
  countryCode: string | null;
  qualifying: QualifyingEntry[];
  results: WeekendResult[];
  fastestLap: WeekendHighlight | null;
  driverOfTheDay: WeekendHighlight | null;
}

export interface TelemetrySession {
  sessionKey: number;
  name: string; // e.g. country / location
  location: string;
  circuit: string;
  date: string;
}

export interface SessionDriver {
  driverNumber: number;
  fullName: string;
  acronym: string;
  team: string;
  colour: string; // hex without '#'
}

export interface DriverLap {
  lapNumber: number;
  lapDuration: number | null; // seconds
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  isPitOutLap: boolean;
}

export interface TelemetryPoint {
  t: number; // seconds since lap start
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
}

export interface LapTelemetry {
  sessionKey: number;
  driverNumber: number;
  lapNumber: number;
  points: TelemetryPoint[];
}

// --- Live timing (OpenF1) ---
export interface LiveSessionMeta {
  sessionKey: number;
  sessionName: string;
  location: string;
  countryName: string;
  year: number;
  dateStart: string;
  dateEnd: string | null;
  isRace: boolean;
}

export interface LiveBoardRow {
  driverNumber: number;
  position: number | null;
  code: string;
  fullName: string;
  teamName: string;
  teamColour: string | null;
  gapToLeader: string | null;
  interval: string | null;
  lastLap: number | null;
  bestLap: number | null;
  tyreCompound: string | null;
  tyreAge: number | null;
}

export interface LiveBoard {
  session: LiveSessionMeta;
  rows: LiveBoardRow[];
  sessionBest: { lap: number | null; sectors: (number | null)[] };
}

export interface LiveLap {
  lapNumber: number;
  lapDuration: number | null;
  sectors: (number | null)[];
  segments: number[][];
  speeds: { i1: number | null; i2: number | null; st: number | null };
  isPitOut: boolean;
}

export interface LiveStint {
  stintNumber: number;
  compound: string | null;
  lapStart: number;
  lapEnd: number;
  tyreAgeAtStart: number | null;
}

export interface LivePit {
  lapNumber: number | null;
  pitDuration: number | null;
}

export interface LiveDriverDetail {
  driverNumber: number;
  laps: LiveLap[];
  bestLap: number | null;
  bestSectors: (number | null)[];
  stints: LiveStint[];
  pits: LivePit[];
}

// --- Session replay (time-based playback of a completed session) ---
export interface ReplayLap {
  num: number; // driver number
  lap: number; // lap number
  t: number; // lap start, epoch ms
  d: number | null; // lap duration, seconds
  s: (number | null)[]; // sector durations [s1, s2, s3]
  sc: string[]; // sector colours ['p' | 'g' | 'y' | ''], baked server-side
  seg: number[][]; // mini-sector codes per sector
  sp: (number | null)[]; // speeds [i1, i2, speed-trap]
  gl: string | null; // gap to leader at this lap ("+1.234")
  iv: string | null; // interval to the car ahead at this lap
}
export interface ReplayDriver {
  num: number;
  code: string;
  name: string;
  colour: string | null;
}
export interface ReplayStint {
  num: number;
  compound: string | null;
  start: number; // lap_start
  end: number; // lap_end
  age: number | null; // tyre age at stint start
}
export interface ReplayData {
  session: LiveSessionMeta;
  startMs: number;
  endMs: number;
  drivers: ReplayDriver[];
  laps: ReplayLap[];
  pos: { num: number; p: number; t: number }[]; // position changes over time
  stints: ReplayStint[];
}

export interface LiveStatus {
  live: LiveSessionMeta | null; // a session in progress right now
  next: LiveSessionMeta | null; // the next upcoming session (for the countdown)
  last: LiveSessionMeta | null; // the most recent completed session
  boardSessionKey: number | null; // which session the board should show
  // OpenF1 paywalls its whole API while a session is live; when that happens we
  // can't read any data, but we know a session is on.
  locked: boolean;
}
