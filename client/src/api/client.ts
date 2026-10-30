// Thin typed wrapper around our backend API. All requests go to /api, which
// Vite proxies to the Express server in dev (see vite.config.ts).
import { dicts, langFromPath } from '../i18n/core'

// A failed API call, with its HTTP status (404: the thing asked for doesn't
// exist, which pages show as "not found" rather than as an error) and, for a
// 503, why: "busy" (OpenF1's rate limit) or "locked" (a session is live and
// OpenF1 is closed to free access).
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// The reason shown in the page's error banner ("Could not load …: <reason>"),
// in the page's language.
function reason(status: number, code: string | undefined, fallback: string): string {
  const d = dicts[langFromPath(window.location.pathname)]
  if (code === 'busy') return d['api.busy']
  if (code === 'locked') return d['api.locked']
  if (status >= 500) return d['api.server']
  return fallback
}

const BUSY_RETRIES = 2
const MAX_BUSY_WAIT_S = 15

async function getJson<T>(path: string, attempt = 0): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    let code: string | undefined
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) detail = body.error
      if (res.status === 503) code = body.error
    } catch {
      // response had no JSON body; keep the status text
    }
    // OpenF1 is busy: the server says when to try again; wait (the page keeps
    // showing "Loading") and retry a couple of times before giving up.
    if (code === 'busy' && attempt < BUSY_RETRIES) {
      const after = Number(res.headers.get('Retry-After')) || 3
      await new Promise((r) => setTimeout(r, Math.min(after, MAX_BUSY_WAIT_S) * 1000))
      return getJson<T>(path, attempt + 1)
    }
    throw new ApiError(reason(res.status, code, detail), res.status, code)
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
  CircuitProfile,
  CircuitSummary,
  ConstructorListItem,
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
  LiveStatus,
  ReplayData,
  LapTelemetry,
  RaceResultResponse,
  RaceStory,
  RaceStrategy,
  ReplaySession,
  SearchIndex,
  RaceWeekend,
  SeasonComparison,
  SeasonProgression,
  SessionDriver,
  StandingsResponse,
  TeamImage,
  TeammateDuels,
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
  raceStrategy: (season: string, round: number, kind: 'race' | 'sprint') =>
    getJson<RaceStrategy>(`/calendar/${season}/${round}/strategy?kind=${kind}`),
  raceStory: (season: string, round: number) =>
    getJson<RaceStory>(`/calendar/${season}/${round}/story`),
  driverHeadshots: (season: string) =>
    getJson<Record<string, string>>(`/telemetry/headshots/${season}`),
  drivers: () => getJson<DriverListItem[]>('/drivers'),
  driverPhotos: () => getJson<Record<string, string>>('/drivers/photos'),
  driverProfile: (driverId: string) =>
    getJson<DriverProfile>(`/drivers/${driverId}`),
  compareDrivers: (a: string, b: string) =>
    getJson<DriverComparison>(`/compare/drivers/${a}/${b}`),
  compareDriversSeason: (a: string, b: string, season: number) =>
    getJson<SeasonComparison>(`/compare/drivers/${a}/${b}/season/${season}`),
  constructors: () => getJson<ConstructorListItem[]>('/constructors'),
  searchIndex: () => getJson<SearchIndex>('/search-index'),
  circuits: () => getJson<CircuitSummary[]>('/circuits'),
  circuitProfile: (circuitId: string) =>
    getJson<CircuitProfile>(`/circuits/${circuitId}`),
  teamImages: () =>
    getJson<Record<string, TeamImage>>('/constructors/images'),
  constructorProfile: (constructorId: string) =>
    getJson<ConstructorProfile>(`/constructors/${constructorId}`),
  teamDuels: (constructorId: string, season: number) =>
    getJson<TeammateDuels>(`/constructors/${constructorId}/duels/${season}`),
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
  liveStatus: () => getJson<LiveStatus>('/live/status'),
  liveSession: () => getJson<LiveSessionMeta>('/live/session'),
  liveBoard: (sessionKey: number) =>
    getJson<LiveBoard>(`/live/${sessionKey}/board`),
  liveDriver: (sessionKey: number, driverNumber: number) =>
    getJson<LiveDriverDetail>(`/live/${sessionKey}/driver/${driverNumber}`),
  replaySessions: () => getJson<ReplaySession[]>('/live/replays'),
  replay: (sessionKey: number) =>
    getJson<ReplayData>(`/live/${sessionKey}/replay`),
}
