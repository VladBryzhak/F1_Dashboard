// Thin typed wrapper around our backend API. All requests go to /api, which
// Vite proxies to the Express server in dev (see vite.config.ts).

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      // response had no JSON body; keep the status text
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

import type {
  CalendarResponse,
  ConstructorStanding,
  DriverLap,
  DriverStanding,
  LapTelemetry,
  RaceResultResponse,
  SessionDriver,
  StandingsResponse,
  TelemetrySession,
} from '../types/f1'

export const api = {
  driverStandings: (season: string) =>
    getJson<StandingsResponse<DriverStanding>>(`/standings/drivers/${season}`),
  constructorStandings: (season: string) =>
    getJson<StandingsResponse<ConstructorStanding>>(
      `/standings/constructors/${season}`,
    ),
  calendar: (season: string) =>
    getJson<CalendarResponse>(`/calendar/${season}`),
  raceResults: (season: string, round: number) =>
    getJson<RaceResultResponse>(`/calendar/${season}/${round}`),
  driverHeadshots: (season: string) =>
    getJson<Record<string, string>>(`/telemetry/headshots/${season}`),
  telemetrySessions: (season: string) =>
    getJson<TelemetrySession[]>(`/telemetry/sessions/${season}`),
  sessionDrivers: (sessionKey: number) =>
    getJson<SessionDriver[]>(`/telemetry/drivers/${sessionKey}`),
  driverLaps: (sessionKey: number, driverNumber: number) =>
    getJson<DriverLap[]>(`/telemetry/laps/${sessionKey}/${driverNumber}`),
  lapTelemetry: (sessionKey: number, driverNumber: number, lapNumber: number) =>
    getJson<LapTelemetry>(
      `/telemetry/lap/${sessionKey}/${driverNumber}/${lapNumber}`,
    ),
}
