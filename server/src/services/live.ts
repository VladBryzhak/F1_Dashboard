import { cached } from "../cache/cache";
import type {
  LiveBoard,
  LiveBoardRow,
  LiveDriverDetail,
  LiveLap,
  LivePit,
  LiveSessionMeta,
  LiveStint,
} from "../types/f1";

// Live timing from OpenF1 (https://openf1.org). For the prototype this reads a
// completed session so it's testable off-track; the same joins work on a live
// session because those endpoints return evolving data while a session runs.
const BASE = "https://api.openf1.org/v1";
const TIMEOUT_MS = 20_000;

async function get<T>(path: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`OpenF1 ${path} timed out`);
    }
    throw err;
  }
  // OpenF1's free tier rate-limits bursts; back off and retry on 429.
  if (res.status === 429 && attempt < 4) {
    const wait = 400 * 2 ** attempt + Math.random() * 300;
    await new Promise((r) => setTimeout(r, wait));
    return get<T>(path, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`OpenF1 ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

interface RawSession {
  session_key: number;
  session_name: string;
  location: string;
  country_name: string;
  year: number;
  date_start: string;
  date_end: string | null;
}
interface RawDriver {
  driver_number: number;
  name_acronym: string | null;
  full_name: string | null;
  team_name: string | null;
  team_colour: string | null;
}
interface RawPosition {
  driver_number: number;
  position: number;
  date: string;
}
interface RawInterval {
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
  date: string;
}
interface RawLap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  segments_sector_1: number[] | null;
  segments_sector_2: number[] | null;
  segments_sector_3: number[] | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
}
interface RawStint {
  driver_number: number;
  stint_number: number;
  compound: string | null;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number | null;
}
interface RawPit {
  driver_number: number;
  lap_number: number | null;
  pit_duration: number | null;
}

// Keep only the newest row per driver from a dated time-series.
function latestByDriver<T extends { driver_number: number; date: string }>(
  rows: T[],
): Map<number, T> {
  const out = new Map<number, T>();
  for (const r of rows) {
    const prev = out.get(r.driver_number);
    if (!prev || r.date > prev.date) out.set(r.driver_number, r);
  }
  return out;
}

function toMeta(s: RawSession): LiveSessionMeta {
  return {
    sessionKey: s.session_key,
    sessionName: s.session_name,
    location: s.location,
    countryName: s.country_name,
    year: s.year,
    dateStart: s.date_start,
    dateEnd: s.date_end,
    isRace: /race/i.test(s.session_name),
  };
}

// gap_to_leader / interval come as a number (seconds) or a string ("+1 LAP").
function gapText(v: number | string | null): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (v === 0) return null;
  return `+${v.toFixed(3)}`;
}

// The most recent completed session OpenF1 has (prefers a Race). Cached for an
// hour — Phase 2 will swap this for "the session happening right now".
export async function getLatestSession(): Promise<LiveSessionMeta | null> {
  return cached("live:session", 3600, async () => {
    const now = Date.now();
    const thisYear = new Date().getFullYear();
    const years = [...new Set([thisYear, thisYear - 1, 2024])];
    for (const year of years) {
      const sessions = await get<RawSession[]>(
        `/sessions?year=${year}&session_name=Race`,
      );
      const past = sessions
        .filter((s) => new Date(s.date_start).getTime() < now)
        .sort(
          (a, b) =>
            new Date(b.date_start).getTime() - new Date(a.date_start).getTime(),
        );
      if (past.length) return toMeta(past[0]);
    }
    return null;
  });
}

export async function getBoard(sessionKey: number): Promise<LiveBoard> {
  return cached(`live:board:${sessionKey}`, 5, async () => {
    // Two batches of three to keep concurrency (and OpenF1's rate limit) sane.
    const [sessions, drivers, stints] = await Promise.all([
      get<RawSession[]>(`/sessions?session_key=${sessionKey}`),
      get<RawDriver[]>(`/drivers?session_key=${sessionKey}`),
      get<RawStint[]>(`/stints?session_key=${sessionKey}`),
    ]);
    const [positions, intervals, laps] = await Promise.all([
      get<RawPosition[]>(`/position?session_key=${sessionKey}`),
      get<RawInterval[]>(`/intervals?session_key=${sessionKey}`).catch(
        () => [] as RawInterval[],
      ),
      get<RawLap[]>(`/laps?session_key=${sessionKey}`),
    ]);

    const session = sessions[0] ? toMeta(sessions[0]) : null;
    if (!session) throw new Error(`Session ${sessionKey} not found`);

    const latestPos = latestByDriver(positions);
    const latestInt = latestByDriver(intervals);

    // Best and most-recent lap per driver.
    const bestLap = new Map<number, number>();
    const lastLap = new Map<number, { num: number; dur: number | null }>();
    for (const l of laps) {
      if (l.lap_duration != null) {
        const b = bestLap.get(l.driver_number);
        if (b == null || l.lap_duration < b)
          bestLap.set(l.driver_number, l.lap_duration);
      }
      const prev = lastLap.get(l.driver_number);
      if (!prev || l.lap_number > prev.num)
        lastLap.set(l.driver_number, { num: l.lap_number, dur: l.lap_duration });
    }

    // Current tyre = the latest stint per driver.
    const curStint = new Map<number, RawStint>();
    for (const s of stints) {
      const prev = curStint.get(s.driver_number);
      if (!prev || s.stint_number > prev.stint_number)
        curStint.set(s.driver_number, s);
    }

    const rows: LiveBoardRow[] = drivers.map((d) => {
      const stint = curStint.get(d.driver_number);
      const age =
        stint && stint.tyre_age_at_start != null
          ? stint.tyre_age_at_start + (stint.lap_end - stint.lap_start)
          : null;
      const inter = latestInt.get(d.driver_number);
      return {
        driverNumber: d.driver_number,
        position: latestPos.get(d.driver_number)?.position ?? null,
        code: d.name_acronym ?? String(d.driver_number),
        fullName: d.full_name ?? d.name_acronym ?? String(d.driver_number),
        teamName: d.team_name ?? "",
        teamColour: d.team_colour,
        gapToLeader: inter ? gapText(inter.gap_to_leader) : null,
        interval: inter ? gapText(inter.interval) : null,
        lastLap: lastLap.get(d.driver_number)?.dur ?? null,
        bestLap: bestLap.get(d.driver_number) ?? null,
        tyreCompound: stint?.compound ?? null,
        tyreAge: age,
      };
    });

    rows.sort((a, b) => {
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });

    return { session, rows };
  });
}

export async function getDriverDetail(
  sessionKey: number,
  driverNumber: number,
): Promise<LiveDriverDetail> {
  return cached(`live:driver:${sessionKey}:${driverNumber}`, 5, async () => {
    const [rawLaps, rawStints, rawPits] = await Promise.all([
      get<RawLap[]>(
        `/laps?session_key=${sessionKey}&driver_number=${driverNumber}`,
      ),
      get<RawStint[]>(
        `/stints?session_key=${sessionKey}&driver_number=${driverNumber}`,
      ),
      get<RawPit[]>(
        `/pit?session_key=${sessionKey}&driver_number=${driverNumber}`,
      ).catch(() => [] as RawPit[]),
    ]);

    const laps: LiveLap[] = rawLaps
      .slice()
      .sort((a, b) => b.lap_number - a.lap_number)
      .slice(0, 12)
      .map((l) => ({
        lapNumber: l.lap_number,
        lapDuration: l.lap_duration,
        sectors: [
          l.duration_sector_1,
          l.duration_sector_2,
          l.duration_sector_3,
        ],
        segments: [
          l.segments_sector_1 ?? [],
          l.segments_sector_2 ?? [],
          l.segments_sector_3 ?? [],
        ],
        speeds: { i1: l.i1_speed, i2: l.i2_speed, st: l.st_speed },
        isPitOut: l.is_pit_out_lap,
      }));

    // Best lap + best individual sectors across the whole session.
    let bestLap: number | null = null;
    const bestSectors: (number | null)[] = [null, null, null];
    for (const l of rawLaps) {
      if (l.lap_duration != null && (bestLap == null || l.lap_duration < bestLap))
        bestLap = l.lap_duration;
      const secs = [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3];
      secs.forEach((s, i) => {
        if (s != null && (bestSectors[i] == null || s < bestSectors[i]!))
          bestSectors[i] = s;
      });
    }

    const stints: LiveStint[] = rawStints.map((s) => ({
      stintNumber: s.stint_number,
      compound: s.compound,
      lapStart: s.lap_start,
      lapEnd: s.lap_end,
      tyreAgeAtStart: s.tyre_age_at_start,
    }));

    const pits: LivePit[] = rawPits.map((p) => ({
      lapNumber: p.lap_number,
      pitDuration: p.pit_duration,
    }));

    return { driverNumber, laps, bestLap, bestSectors, stints, pits };
  });
}
