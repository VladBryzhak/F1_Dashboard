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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const b = (await res.json()) as { error?: string }
      if (b.error) detail = b.error
    } catch {
      // response had no JSON body; keep the status text
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

import type {
  CalendarResponse,
  ConstructorProfile,
  ConstructorStanding,
  DriverComparison,
  DriverLap,
  DriverListItem,
  DriverProfile,
  DriverStanding,
  HomeResponse,
  LiveBoard,
  LiveDriverDetail,
  LiveSessionMeta,
  LapTelemetry,
  RaceResultResponse,
  RaceWeekend,
  SeasonProgression,
  SessionDriver,
  StandingsResponse,
  TelemetrySession,
} from '../types/f1'

export const api = {
  home: () => getJson<HomeResponse>('/home'),
  driverStandings: (season: string) =>
    getJson<StandingsResponse<DriverStanding>>(`/standings/drivers/${season}`),
  seasonProgression: (season: string) =>
    getJson<SeasonProgression>(`/standings/progression/${season}`),
  constructorStandings: (season: string) =>
    getJson<StandingsResponse<ConstructorStanding>>(
      `/standings/constructors/${season}`,
    ),
  calendar: (season: string) =>
    getJson<CalendarResponse>(`/calendar/${season}`),
  raceResults: (season: string, round: number) =>
    getJson<RaceResultResponse>(`/calendar/${season}/${round}`),
  raceWeekend: (season: string, round: number) =>
    getJson<RaceWeekend>(`/calendar/${season}/${round}/weekend`),
  driverHeadshots: (season: string) =>
    getJson<Record<string, string>>(`/telemetry/headshots/${season}`),
  drivers: () => getJson<DriverListItem[]>('/drivers'),
  driverProfile: (driverId: string) =>
    getJson<DriverProfile>(`/drivers/${driverId}`),
  compareDrivers: (a: string, b: string) =>
    getJson<DriverComparison>(`/compare/drivers/${a}/${b}`),
  constructorProfile: (constructorId: string) =>
    getJson<ConstructorProfile>(`/constructors/${constructorId}`),
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
  feedback: (body: { message: string; contact?: string; website?: string }) =>
    postJson<{ ok: true }>('/feedback', body),
  liveSession: () => getJson<LiveSessionMeta>('/live/session'),
  liveBoard: (sessionKey: number) =>
    getJson<LiveBoard>(`/live/${sessionKey}/board`),
  liveDriver: (sessionKey: number, driverNumber: number) =>
    getJson<LiveDriverDetail>(`/live/${sessionKey}/driver/${driverNumber}`),
}
