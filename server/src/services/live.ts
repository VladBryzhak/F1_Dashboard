import { cached, isPending } from "../cache/cache";
import { OpenF1Locked, inBackground, isBackground, openF1, optional, promoteBackground } from "./openf1Client";
import { trackLine } from "./trackLines";
import type {
  LiveBoard,
  LiveBoardRow,
  LiveDriverDetail,
  LiveLap,
  LivePit,
  LiveSessionMeta,
  LiveStatus,
  LiveStint,
  ReplayData,
  ReplayLap,
  ReplaySession,
  WeatherSample,
} from "../types/f1";

// Live timing from OpenF1 (https://openf1.org). For the prototype this reads a
// completed session so it's testable off-track; the same joins work on a live
// session because those endpoints return evolving data while a session runs.
// Every request goes through the shared, rate-limited queue (openf1Client.ts).
const get = openF1;

export interface RawSession {
  session_key: number;
  meeting_key?: number;
  circuit_key?: number;
  circuit_short_name?: string;
  is_cancelled?: boolean;
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
  date_start: string | null;
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
  lane_duration?: number | null;
  date?: string | null;
}
interface RawRaceControl {
  date: string;
  category: string | null;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  message: string | null;
  lap_number?: number | null;
  driver_number?: number | null;
}

// A session's race-control messages, one request shared by the replay and
// the race story (both read them for the same race).
function rawRaceControl(sessionKey: number): Promise<RawRaceControl[]> {
  return cached(`of1:rc:${sessionKey}`, REPLAY_TTL, () =>
    get<RawRaceControl[]>(`/race_control?session_key=${sessionKey}`),
  );
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
interface RawWeather {
  date: string;
  air_temperature: number | null;
  track_temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
}

// OpenF1 posts a weather sample about once a minute.
function toWeather(raw: RawWeather[]): WeatherSample[] {
  return raw
    .map((w) => ({
      t: Date.parse(w.date),
      air: w.air_temperature,
      track: w.track_temperature,
      humidity: w.humidity,
      rain: (w.rainfall ?? 0) > 0,
      wind: w.wind_speed,
      windDir: w.wind_direction,
    }))
    .filter((w) => !Number.isNaN(w.t))
    .sort((a, b) => a.t - b.t);
}

// Every session of a year (practice to race), one request shared by the live
// status, the replay list, the latest race and the telemetry race list.
// OpenF1 publishes the calendar ahead and fills in end times as sessions
// finish, so the current year refreshes hourly; past years don't change.
export async function getYearSessions(year: number): Promise<RawSession[]> {
  const current = year >= new Date().getFullYear();
  return cached(`of1:year:${year}`, current ? 3600 : 24 * 3600, () =>
    get<RawSession[]>(`/sessions?year=${year}`),
  );
}

// Data counts as live (and OpenF1 locks it, see OpenF1Locked) from 30
// minutes before a session until 30 minutes after it ends.
const LIVE_MARGIN_MS = 30 * 60 * 1000;

// A session's entry from the cached year lists (saves a request per board or
// replay), or from OpenF1 when it isn't there.
async function findSession(sessionKey: number): Promise<RawSession | null> {
  for (let y = new Date().getFullYear(); y >= 2023; y--) {
    const s = (await getYearSessions(y)).find((x) => x.session_key === sessionKey);
    if (s) return s;
  }
  return (await get<RawSession[]>(`/sessions?session_key=${sessionKey}`))[0] ?? null;
}

// Has this session's data stopped changing? Its board and driver detail can
// then be kept for long instead of a few seconds.
async function sessionIsOver(sessionKey: number): Promise<boolean> {
  const s = await findSession(sessionKey).catch(() => null);
  return !s || endOf(s) + LIVE_MARGIN_MS < Date.now();
}

// Keep the replays of the last week's sessions ready: a race weekend's
// sessions are what people open, and a cold replay takes OpenF1 about 2.5 s.
// Fetched in the queue's background lane, so it never takes a visitor's turn;
// one at a time; a replay already cached costs nothing. Runs a minute after
// start and every 30 minutes (a session finishing is picked up within that).
const WARM_DAYS = 7;
export function warmReplays(): void {
  const run = async () => {
    try {
      const now = Date.now();
      const sessions = await getYearSessions(new Date().getFullYear());
      const recent = sessions
        .filter((s) => REPLAYABLE.has(s.session_name))
        .filter((s) => endOf(s) + LIVE_MARGIN_MS < now && endOf(s) > now - WARM_DAYS * 24 * 3600 * 1000)
        .sort((a, b) => b.date_start.localeCompare(a.date_start));
      for (const s of recent) {
        await inBackground(() => getReplay(s.session_key)).catch((err) =>
          console.warn(`[openf1] warming replay ${s.session_key} failed:`, err instanceof Error ? err.message : err),
        );
      }
    } catch (err) {
      console.warn("[openf1] replay warming skipped:", err instanceof Error ? err.message : err);
    }
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, 30 * 60_000).unref();
}
const OVER_TTL = 3600;
const RUNNING_TTL = 8;

export async function getLatestSession(): Promise<LiveSessionMeta | null> {
  return cached("live:session", 3600, async () => {
    const now = Date.now();
    const thisYear = new Date().getFullYear();
    const years = [...new Set([thisYear, thisYear - 1, 2024])];
    for (const year of years) {
      const sessions = (await getYearSessions(year)).filter((s) => s.session_name === "Race");
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

// Default session length when OpenF1 hasn't published date_end yet.
const DEFAULT_LEN_MS = 2 * 60 * 60 * 1000;

function endOf(s: RawSession): number {
  return s.date_end
    ? new Date(s.date_end).getTime()
    : new Date(s.date_start).getTime() + DEFAULT_LEN_MS;
}

// Is a session happening right now? What's next? What was last? Drives the live
// dot, the board source, and the countdown. Cached briefly so a session going
// live (or ending) is picked up within ~30s.
const LOCKED: LiveStatus = {
  live: null,
  next: null,
  last: null,
  boardSessionKey: null,
  locked: true,
};

// Worked out from the year's schedule (cached), so the status every page
// polls costs no OpenF1 request of its own. During a session's live window
// OpenF1 refuses free access, so the status says "locked" then.
export async function getLiveStatus(): Promise<LiveStatus> {
  return cached("live:status", (s) => (s.locked ? 300 : 30), async () => {
    const now = Date.now();
    const year = new Date().getFullYear();
    let sessions: RawSession[];
    try {
      sessions = await getYearSessions(year);
    } catch (err) {
      if (err instanceof OpenF1Locked) return LOCKED;
      throw err;
    }
    // Near a season boundary this year may hold no upcoming session; peek ahead.
    if (!sessions.some((s) => new Date(s.date_start).getTime() > now)) {
      const nextYear = await getYearSessions(year + 1).catch(() => [] as RawSession[]);
      sessions = sessions.concat(nextYear);
    }
    const inLiveWindow = sessions.some(
      (s) => new Date(s.date_start).getTime() - LIVE_MARGIN_MS <= now && now <= endOf(s) + LIVE_MARGIN_MS,
    );
    if (inLiveWindow) return LOCKED;

    let live: RawSession | null = null;
    let next: RawSession | null = null;
    let last: RawSession | null = null;
    for (const s of sessions) {
      const start = new Date(s.date_start).getTime();
      if (start <= now && now <= endOf(s)) live = s;
      if (start > now && (!next || start < new Date(next.date_start).getTime())) {
        next = s;
      }
      if (
        endOf(s) <= now &&
        (!last ||
          new Date(s.date_start).getTime() >
            new Date(last.date_start).getTime())
      ) {
        last = s;
      }
    }

    const boardSource = live ?? last;
    return {
      live: live ? toMeta(live) : null,
      next: next ? toMeta(next) : null,
      last: last ? toMeta(last) : null,
      boardSessionKey: boardSource?.session_key ?? null,
      locked: false,
    };
  });
}

export async function getBoard(sessionKey: number): Promise<LiveBoard> {
  const over = await sessionIsOver(sessionKey);
  return cached(`live:board:${sessionKey}`, over ? OVER_TTL : RUNNING_TTL, async () => {
    // All at once: the queue (openf1Client.ts) paces them.
    const [raw, drivers, stints, positions, intervals, laps, rawWeather] = await Promise.all([
      findSession(sessionKey),
      get<RawDriver[]>(`/drivers?session_key=${sessionKey}`),
      get<RawStint[]>(`/stints?session_key=${sessionKey}`),
      get<RawPosition[]>(`/position?session_key=${sessionKey}`),
      get<RawInterval[]>(`/intervals?session_key=${sessionKey}`).catch(optional<RawInterval[]>([])),
      get<RawLap[]>(`/laps?session_key=${sessionKey}`),
      get<RawWeather[]>(`/weather?session_key=${sessionKey}`).catch(optional<RawWeather[]>([])),
    ]);
    const weather = toWeather(rawWeather);

    const session = raw ? toMeta(raw) : null;
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

    if (session.isRace) {
      rows.sort((a, b) => {
        if (a.position == null) return 1;
        if (b.position == null) return -1;
        return a.position - b.position;
      });
    } else {
      // Practice / Qualifying: OpenF1 has no race-style intervals, so classify by
      // best lap and show the gap to the fastest lap (pole) and to the car ahead.
      const ranked = rows
        .filter((r) => r.bestLap != null)
        .sort((a, b) => a.bestLap! - b.bestLap!);
      const rest = rows.filter((r) => r.bestLap == null);
      const pole = ranked[0]?.bestLap ?? null;
      ranked.forEach((r, i) => {
        r.position = i + 1;
        r.gapToLeader =
          pole != null && r.bestLap! > pole
            ? `+${(r.bestLap! - pole).toFixed(3)}`
            : null;
        const prev = ranked[i - 1];
        r.interval = prev ? `+${(r.bestLap! - prev.bestLap!).toFixed(3)}` : null;
      });
      rest.forEach((r) => {
        r.position = null;
        r.gapToLeader = null;
        r.interval = null;
      });
      rows.length = 0;
      rows.push(...ranked, ...rest);
    }

    // Session-wide best lap + best individual sectors, for "purple" colouring.
    let sbLap: number | null = null;
    const sbSectors: (number | null)[] = [null, null, null];
    const sbDrivers: (number | null)[] = [null, null, null];
    let sbLapDriver: number | null = null;
    let sbLapNumber: number | null = null;
    for (const l of laps) {
      if (l.lap_duration != null && (sbLap == null || l.lap_duration < sbLap)) {
        sbLap = l.lap_duration;
        sbLapDriver = l.driver_number;
        sbLapNumber = l.lap_number;
      }
      const secs = [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3];
      secs.forEach((s, i) => {
        if (s != null && (sbSectors[i] == null || s < sbSectors[i]!)) {
          sbSectors[i] = s;
          sbDrivers[i] = l.driver_number;
        }
      });
    }

    return {
      session,
      rows,
      sessionBest: {
        lap: sbLap,
        sectors: sbSectors,
        sectorDrivers: sbDrivers,
        lapDriver: sbLapDriver,
        lapNumber: sbLapNumber,
      },
      weather: weather[weather.length - 1] ?? null,
    };
  });
}

export async function getDriverDetail(
  sessionKey: number,
  driverNumber: number,
): Promise<LiveDriverDetail> {
  const over = await sessionIsOver(sessionKey);
  return cached(`live:driver:${sessionKey}:${driverNumber}`, over ? OVER_TTL : RUNNING_TTL, async () => {
    const [rawLaps, rawStints, rawPits] = await Promise.all([
      get<RawLap[]>(
        `/laps?session_key=${sessionKey}&driver_number=${driverNumber}`,
      ),
      get<RawStint[]>(
        `/stints?session_key=${sessionKey}&driver_number=${driverNumber}`,
      ),
      get<RawPit[]>(
        `/pit?session_key=${sessionKey}&driver_number=${driverNumber}`,
      ).catch(optional<RawPit[]>([])),
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

// Full session replay: compact per-lap records (sector colours and gaps baked
// in) plus the position time-series, so the client can play the session back on
// a virtual clock, revealing sectors one at a time. Cached long — a finished
// session never changes.
// A finished session's replay doesn't change: kept a week (about 360 KB
// each), and the last week's are fetched ahead of visitors (warmReplays).
const REPLAY_TTL = 7 * 24 * 3600;

export async function getReplay(sessionKey: number): Promise<ReplayData> {
  // A visitor asking for the replay the background warming is fetching right
  // now shouldn't wait in the background lane.
  const key = `live:replay:${sessionKey}`;
  if (!isBackground() && isPending(key)) promoteBackground();
  return cached(key, REPLAY_TTL, async () => {
    // All at once: the queue (openf1Client.ts) paces them, about 2.5 s for
    // the seven.
    const [raw, drivers, stints, positions, rawLaps, rawRc, rawPit, rawWeather] = await Promise.all([
      findSession(sessionKey),
      get<RawDriver[]>(`/drivers?session_key=${sessionKey}`),
      get<RawStint[]>(`/stints?session_key=${sessionKey}`),
      get<RawPosition[]>(`/position?session_key=${sessionKey}`),
      get<RawLap[]>(`/laps?session_key=${sessionKey}`),
      rawRaceControl(sessionKey).catch(optional<RawRaceControl[]>([])),
      get<RawPit[]>(`/pit?session_key=${sessionKey}`).catch(optional<RawPit[]>([])),
      get<RawWeather[]>(`/weather?session_key=${sessionKey}`).catch(optional<RawWeather[]>([])),
    ]);

    const session = raw ? toMeta(raw) : null;
    if (!session) throw new Error(`Session ${sessionKey} not found`);

    const laps: ReplayLap[] = [];
    for (const l of rawLaps) {
      if (!l.date_start) continue;
      const t = Date.parse(l.date_start);
      if (Number.isNaN(t)) continue;
      laps.push({
        num: l.driver_number,
        lap: l.lap_number,
        t,
        d: l.lap_duration,
        s: [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3],
        sc: ["", "", ""],
        seg: [
          l.segments_sector_1 ?? [],
          l.segments_sector_2 ?? [],
          l.segments_sector_3 ?? [],
        ],
        sp: [l.i1_speed, l.i2_speed, l.st_speed],
        gl: null,
        iv: null,
      });
    }

    // Bake sector colours in completion-time order: purple = fastest in the
    // session so far, green = that driver's personal best so far, else yellow.
    interface SecDone {
      lap: ReplayLap;
      i: number;
      dur: number;
      done: number;
    }
    const done: SecDone[] = [];
    for (const lap of laps) {
      let acc = 0;
      for (let i = 0; i < 3; i++) {
        const dur = lap.s[i];
        if (dur == null) continue;
        acc += dur;
        done.push({ lap, i, dur, done: lap.t + acc * 1000 });
      }
    }
    done.sort((a, b) => a.done - b.done);
    const sessBest: (number | null)[] = [null, null, null];
    const pb = new Map<string, number>();
    for (const sd of done) {
      const key = `${sd.lap.num}:${sd.i}`;
      if (sessBest[sd.i] == null || sd.dur < sessBest[sd.i]!) {
        sd.lap.sc[sd.i] = "p";
        sessBest[sd.i] = sd.dur;
        pb.set(key, sd.dur);
      } else if (!pb.has(key) || sd.dur < pb.get(key)!) {
        sd.lap.sc[sd.i] = "g";
        pb.set(key, sd.dur);
      } else {
        sd.lap.sc[sd.i] = "y";
      }
    }

    // Gaps from lap-crossing times, per lap number.
    const byLap = new Map<number, { lap: ReplayLap; end: number }[]>();
    for (const lap of laps) {
      if (lap.d == null) continue;
      const end = lap.t + lap.d * 1000;
      const arr = byLap.get(lap.lap) ?? [];
      arr.push({ lap, end });
      byLap.set(lap.lap, arr);
    }
    for (const arr of byLap.values()) {
      arr.sort((a, b) => a.end - b.end);
      const leadEnd = arr[0].end;
      arr.forEach((e, i) => {
        if (i === 0) return;
        e.lap.gl = `+${((e.end - leadEnd) / 1000).toFixed(3)}`;
        e.lap.iv = `+${((e.end - arr[i - 1].end) / 1000).toFixed(3)}`;
      });
    }

    const starts = laps.map((l) => l.t);
    const ends = laps
      .filter((l) => l.d != null)
      .map((l) => l.t + (l.d as number) * 1000);
    const startMs = starts.length ? Math.min(...starts) : 0;
    const endMs = ends.length ? Math.max(...ends) : 0;

    // Track-status timeline from race control: green / yellow / sc / vsc / red.
    const flags: { t: number; s: string }[] = [];
    {
      const rc = rawRc
        .filter((m) => m.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      let red = false;
      let sc = false;
      let vsc = false;
      let chequered = false;
      const yellow = new Set<number>();
      let last = "";
      const derive = () =>
        chequered
          ? "chequered"
          : red
            ? "red"
            : sc
              ? "sc"
              : vsc
                ? "vsc"
                : yellow.size
                  ? "yellow"
                  : "green";
      for (const m of rc) {
        const msg = (m.message ?? "").toUpperCase();
        const flag = (m.flag ?? "").toUpperCase();
        // Race control writes the virtual safety car both in full and as
        // "VSC" ("VSC DEPLOYED" / "VSC ENDING").
        if (msg.includes("VIRTUAL SAFETY CAR") || /\bVSC\b/.test(msg)) {
          if (msg.includes("DEPLOY")) vsc = true;
          else if (msg.includes("ENDING")) vsc = false;
        } else if (m.category === "SafetyCar") {
          if (msg.includes("DEPLOY")) sc = true;
          else if (msg.includes("IN THIS LAP") || msg.includes("ENDING")) sc = false;
        }
        if (flag === "RED") red = true;
        if (flag === "GREEN") {
          // A green flag ends any neutralisation, even if its end message
          // was missed.
          red = false;
          sc = false;
          vsc = false;
          yellow.clear();
        }
        if (flag === "YELLOW" || flag === "DOUBLE YELLOW") {
          if (m.sector != null) yellow.add(m.sector);
        }
        if (flag === "CLEAR") {
          if (m.sector != null) yellow.delete(m.sector);
          else yellow.clear();
        }
        if (flag === "CHEQUERED") chequered = true;
        const s = derive();
        if (s !== last) {
          flags.push({ t: Date.parse(m.date), s });
          last = s;
        }
      }
    }

    // In-pit windows: from the stop time for the pit-lane duration.
    // In-pit windows. OpenF1's `date` comes late in the drive through the pit
    // lane, so where we know the circuit, shift it by the calibrated offset to
    // the moment the car leaves the racing line and cover the whole detour.
    const track = trackLine(raw?.circuit_key);
    const pits = rawPit
      .filter((p) => p.date)
      .map((p) => {
        const at = Date.parse(p.date as string);
        // Practice and qualifying entries have no lane time, and their
        // pit_duration is time spent in the garage, so don't use it as one.
        const lane = p.lane_duration ?? null;
        if (track?.pit) {
          const laneTime = lane ?? track.pit.lane;
          const detour = track.pit.path[track.pit.path.length - 1][2] + (laneTime - track.pit.lane);
          const from = at + track.pit.offset * 1000;
          return { num: p.driver_number, from, to: from + detour * 1000, at, lane };
        }
        const dur = (p.pit_duration ?? p.lane_duration ?? 25) * 1000;
        return { num: p.driver_number, from: at, to: at + dur, at, lane };
      })
      .filter((p) => !Number.isNaN(p.from));

    return {
      session,
      startMs,
      endMs,
      drivers: drivers.map((d) => ({
        num: d.driver_number,
        code: d.name_acronym ?? String(d.driver_number),
        name: d.full_name ?? d.name_acronym ?? String(d.driver_number),
        colour: d.team_colour,
      })),
      laps,
      pos: positions
        .map((p) => ({
          num: p.driver_number,
          p: p.position,
          t: Date.parse(p.date),
        }))
        .filter((p) => !Number.isNaN(p.t)),
      stints: stints.map((s) => ({
        num: s.driver_number,
        compound: s.compound,
        start: s.lap_start,
        end: s.lap_end,
        age: s.tyre_age_at_start,
      })),
      flags,
      pits,
      weather: toWeather(rawWeather),
      track,
    };
  });
}

// Sessions we can replay, in weekend order. Testing days are left out.
const REPLAYABLE = new Set([
  "Practice 1",
  "Practice 2",
  "Practice 3",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Sprint",
  "Qualifying",
  "Race",
]);

// Past sessions available to replay (OpenF1 has data from 2023 on): every
// practice, qualifying, sprint and race. One request per season.
export async function getReplaySessions(): Promise<ReplaySession[]> {
  return cached("live:replay-sessions", 3600, async () => {
    const now = Date.now();
    const out: ReplaySession[] = [];
    for (let year = new Date().getFullYear(); year >= 2023; year--) {
      const sessions = await getYearSessions(year);
      for (const s of sessions) {
        if (!REPLAYABLE.has(s.session_name)) continue;
        if (new Date(s.date_start).getTime() >= now) continue;
        out.push({
          sessionKey: s.session_key,
          meetingKey: s.meeting_key ?? s.session_key,
          year: s.year,
          location: s.location,
          date: s.date_start,
          sessionName: s.session_name,
          isSprint: s.session_name === "Sprint",
        });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  });
}

// Race-control messages for a finished session (flags, safety cars,
// investigations, penalties), each with the lap OpenF1 logged it on.
export interface RaceControlMessage {
  lap: number | null;
  category: string | null;
  flag: string | null;
  driver: number | null;
  message: string;
}
export async function getRaceControl(sessionKey: number): Promise<RaceControlMessage[]> {
  return cached(`live:rc:${sessionKey}`, REPLAY_TTL, async () => {
    const rows = await rawRaceControl(sessionKey);
    return rows
      .filter((m) => m.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({
        lap: m.lap_number ?? null,
        category: m.category,
        flag: m.flag,
        driver: m.driver_number ?? null,
        message: m.message ?? "",
      }));
  });
}
