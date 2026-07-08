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
  circuitName: string
  placeName: string
  nationality: string
  countryCode: string | null
  winnerDriverId: string | null
  winnerName: string | null
  winnerConstructorId: string | null
  winnerConstructorName: string | null
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
