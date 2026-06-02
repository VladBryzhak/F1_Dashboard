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

export interface CalendarRace {
  round: number
  grandPrixId: string
  name: string
  officialName: string
  date: string
  circuitName: string
  placeName: string
  nationality: string
  winnerDriverId: string | null
  winnerName: string | null
  winnerConstructorId: string | null
  winnerConstructorName: string | null
}

export interface CalendarResponse {
  season: string
  races: CalendarRace[]
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
