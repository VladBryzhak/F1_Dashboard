import { cached } from "../cache/cache";
import { getYearSessions } from "./live";
import { openF1 } from "./openf1Client";
import type {
  DriverLap,
  LapTelemetry,
  SessionDriver,
  TelemetryPoint,
  TelemetrySession,
} from "../types/f1";

// OpenF1 provides free historical F1 telemetry from 2023 onward.
// Docs: https://openf1.org/ — every request goes through the shared,
// rate-limited queue (openf1Client.ts). A finished session's data never
// changes, so it is kept for a day.
const MAX_TELEMETRY_POINTS = 400;
const getJson = openF1;
const DAY = 24 * 60 * 60;
interface RawDriver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string | null;
  headshot_url?: string | null;
}
interface RawLap {
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean;
  date_start: string | null;
}
interface RawCarData {
  date: string;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  drs: number;
}

export async function getRaceSessions(
  season: string
): Promise<TelemetrySession[]> {
  return cached(`of1:sessions:${season}`, 60 * 60, async () => {
    const rows = (await getYearSessions(Number(season))).filter(
      (s) => s.session_name === "Race"
    );
    return rows
      .sort((a, b) => a.date_start.localeCompare(b.date_start))
      .map((s) => ({
        sessionKey: s.session_key,
        name: s.country_name,
        location: s.location,
        circuit: s.circuit_short_name ?? s.location,
        date: s.date_start,
      }));
  });
}

// A session's drivers as OpenF1 lists them (shared by the telemetry driver
// list and the headshots).
function rawDrivers(sessionKey: number): Promise<RawDriver[]> {
  return cached(`of1:rawdrivers:${sessionKey}`, DAY, () =>
    getJson<RawDriver[]>(`/drivers?session_key=${sessionKey}`)
  );
}

// One driver's laps in a session (shared by the lap list and the lap
// telemetry, which needs the lap's start time).
function rawLaps(sessionKey: number, driverNumber: number): Promise<RawLap[]> {
  return cached(`of1:rawlaps:${sessionKey}:${driverNumber}`, DAY, () =>
    getJson<RawLap[]>(`/laps?session_key=${sessionKey}&driver_number=${driverNumber}`)
  );
}

/**
 * Map of driver acronym (e.g. "VER") -> official headshot URL for a season's
 * grid. Uses the season's most recent race already run. Empty for pre-2023
 * seasons (OpenF1 has no data there); callers fall back to a placeholder.
 */
export async function getDriverHeadshots(
  season: string
): Promise<Record<string, string>> {
  return cached(`of1:headshots:${season}`, 12 * 60 * 60, async () => {
    const now = Date.now();
    const sessions = (await getRaceSessions(season)).filter(
      (s) => Date.parse(s.date) < now
    );
    if (!sessions.length) return {};
    const latest = sessions[sessions.length - 1].sessionKey;
    const drivers = await rawDrivers(latest);
    const out: Record<string, string> = {};
    for (const d of drivers) {
      if (d.name_acronym && d.headshot_url) out[d.name_acronym] = d.headshot_url;
    }
    return out;
  });
}

export async function getSessionDrivers(
  sessionKey: number
): Promise<SessionDriver[]> {
  return cached(`of1:drivers:${sessionKey}`, DAY, async () => {
    const rows = await rawDrivers(sessionKey);
    return rows.map((d) => ({
      driverNumber: d.driver_number,
      fullName: d.full_name,
      acronym: d.name_acronym,
      team: d.team_name,
      colour: d.team_colour ?? "9a9aa8",
    }));
  });
}

export async function getDriverLaps(
  sessionKey: number,
  driverNumber: number
): Promise<DriverLap[]> {
  return cached(
    `of1:laps:${sessionKey}:${driverNumber}`,
    DAY,
    async () => {
      const rows = await rawLaps(sessionKey, driverNumber);
      return rows.map((l) => ({
        lapNumber: l.lap_number,
        lapDuration: l.lap_duration,
        sector1: l.duration_sector_1,
        sector2: l.duration_sector_2,
        sector3: l.duration_sector_3,
        isPitOutLap: l.is_pit_out_lap,
      }));
    }
  );
}

export async function getLapTelemetry(
  sessionKey: number,
  driverNumber: number,
  lapNumber: number
): Promise<LapTelemetry> {
  return cached(
    `of1:tel:${sessionKey}:${driverNumber}:${lapNumber}`,
    DAY,
    async () => {
      const laps = await rawLaps(sessionKey, driverNumber);
      const lap = laps.find((l) => l.lap_number === lapNumber);
      if (!lap || !lap.date_start) {
        throw new Error(`Lap ${lapNumber} not found for driver ${driverNumber}`);
      }
      const startMs = new Date(lap.date_start).getTime();
      // Bound the window by lap duration (fall back to 3 min if unknown).
      const durationMs = (lap.lap_duration ?? 180) * 1000;
      const startIso = new Date(startMs).toISOString();
      const endIso = new Date(startMs + durationMs).toISOString();
      const car = await getJson<RawCarData[]>(
        `/car_data?session_key=${sessionKey}&driver_number=${driverNumber}` +
          `&date>${startIso}&date<${endIso}`
      );

      // Downsample to keep the payload light for charting.
      const step = Math.max(1, Math.ceil(car.length / MAX_TELEMETRY_POINTS));
      const points: TelemetryPoint[] = [];
      for (let i = 0; i < car.length; i += step) {
        const c = car[i];
        points.push({
          t: Math.round((new Date(c.date).getTime() - startMs) / 100) / 10,
          speed: c.speed,
          throttle: c.throttle,
          brake: c.brake,
          gear: c.n_gear,
          drs: c.drs,
        });
      }
      return { sessionKey, driverNumber, lapNumber, points };
    }
  );
}
