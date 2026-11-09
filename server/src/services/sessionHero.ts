import { cached } from "../cache/cache";
import { getRaceNear, getSeasonDrivers, type SeasonDriver } from "./f1db";
import { LIVE_MARGIN_MS, endOf, getYearSessions, type RawSession } from "./live";
import { rawDrivers, type RawDriver } from "./openf1";
import { inBackground, openF1 } from "./openf1Client";
import type { SessionHero, SessionRow } from "../types/f1";

// The home hero follows a race weekend session by session: the top three
// after each practice, the pole-sitter after qualifying, the winner after a
// sprint or a race. f1db only has a race the morning after, so these come
// from OpenF1's session results, open 30 minutes after a session ends.

const KINDS: Record<string, SessionHero["kind"]> = {
  "Practice 1": "practice",
  "Practice 2": "practice",
  "Practice 3": "practice",
  Qualifying: "qualifying",
  "Sprint Qualifying": "qualifying",
  "Sprint Shootout": "qualifying",
  Sprint: "race",
  Race: "race",
};

export interface RawResult {
  position: number | null;
  driver_number: number;
  number_of_laps: number | null;
  points?: number | null;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
  // One value, or one per qualifying part (Q1, Q2, Q3).
  duration: number | (number | null)[] | null;
  gap_to_leader: number | string | (number | string | null)[] | null;
}

// The latest session of the weekend whose results are open: not cancelled,
// not testing, ended (with OpenF1's 30-minute margin) before `now`.
export function pickSession(sessions: RawSession[], now: number): RawSession | null {
  let best: RawSession | null = null;
  for (const s of sessions) {
    if (!KINDS[s.session_name] || s.is_cancelled) continue;
    if (endOf(s) + LIVE_MARGIN_MS > now) continue;
    if (!best || s.date_start > best.date_start) best = s;
  }
  return best;
}

// 77.6 -> "1:17.600", 5716.65 -> "1:35:16.650".
export function formatDuration(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = ((ms % 60_000) / 1000).toFixed(3).padStart(6, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// 0.117 -> "+0.117", 75.402 -> "+1:15.402"; OpenF1's "+1 LAP" -> "+1 lap"
// (as f1db writes them).
export function formatGap(gap: number | string): string {
  if (typeof gap === "number") return gap >= 60 ? `+${formatDuration(gap)}` : `+${gap.toFixed(3)}`;
  const laps = /^\+?\s*(\d+)\s*LAPS?$/i.exec(gap.trim());
  if (laps) return `+${laps[1]} lap${laps[1] === "1" ? "" : "s"}`;
  return gap;
}

// The last value set: a qualifying result carries one per part.
export function lastSet<T>(v: T | (T | null)[] | null): T | null {
  if (!Array.isArray(v)) return v;
  for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i];
  return null;
}

// "Lando NORRIS" -> "Lando Norris".
export function titleCase(name: string): string {
  return name.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// The f1db driver behind an OpenF1 entry: by the three-letter code, then by
// surname, among the season's drivers. A stand-in f1db doesn't list yet (a
// rookie in first practice) stays unmatched.
export function matchDriver(d: RawDriver | undefined, season: SeasonDriver[]): SeasonDriver | null {
  if (!d) return null;
  const code = d.name_acronym?.toUpperCase();
  const byCode = code ? season.filter((s) => s.abbreviation?.toUpperCase() === code) : [];
  if (byCode.length === 1) return byCode[0];
  const last = d.last_name ?? d.full_name?.split(" ").slice(1).join(" ");
  if (!last) return null;
  const byName = season.filter((s) => plain(s.lastName) === plain(last));
  return byName.length === 1 ? byName[0] : null;
}

// The top three of a session result, P1 with their time and the others with
// the gap to P1.
export function topThree(results: RawResult[], drivers: RawDriver[], season: SeasonDriver[]): SessionRow[] {
  return results
    .filter((r) => r.position != null && r.position >= 1 && r.position <= 3)
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((r) => {
      const d = drivers.find((x) => x.driver_number === r.driver_number);
      const f1 = matchDriver(d, season);
      const duration = lastSet(r.duration);
      const gap = lastSet(r.gap_to_leader);
      return {
        position: r.position as number,
        driverId: f1?.driverId ?? null,
        driverName: f1 ? `${f1.firstName} ${f1.lastName}` : titleCase(d?.full_name ?? `#${r.driver_number}`),
        driverCode: d?.name_acronym ?? f1?.abbreviation ?? null,
        number: String(r.driver_number),
        constructorId: f1?.constructorId ?? null,
        constructorName: f1?.constructorName ?? d?.team_name ?? "",
        time:
          r.position === 1
            ? duration != null
              ? formatDuration(duration)
              : null
            : gap != null && gap !== 0
              ? formatGap(gap)
              : null,
        laps: r.number_of_laps ?? null,
        headshot: d?.headshot_url ?? null,
      };
    });
}

// A session's classification. Kept a few hours (a race's for one, in case of
// penalties); an empty answer, while OpenF1 is still filling it in, a minute.
export function sessionResult(sessionKey: number, race: boolean): Promise<RawResult[]> {
  return cached(
    `of1:result:${sessionKey}`,
    (rows) => (rows.length ? (race ? 3600 : 6 * 3600) : 60),
    () => openF1<RawResult[]>(`/session_result?session_key=${sessionKey}`),
  );
}

async function build(): Promise<SessionHero | null> {
  const sessions = await getYearSessions(new Date().getUTCFullYear());
  const s = pickSession(sessions, Date.now());
  if (!s) return null;
  const kind = KINDS[s.session_name];
  // The weekend's race places the session in the calendar.
  const race = sessions.find((x) => x.meeting_key === s.meeting_key && x.session_name === "Race");
  const weekend = await getRaceNear((race ?? s).date_start);
  if (!weekend) return null;
  const [results, drivers, season] = await Promise.all([
    sessionResult(s.session_key, kind === "race"),
    rawDrivers(s.session_key),
    getSeasonDrivers(weekend.season),
  ]);
  const top = topThree(results, drivers, season);
  if (top.length < 3) return null; // not classified yet
  const sprint = s.session_name.startsWith("Sprint");
  const poleParts = kind === "qualifying" ? results.find((r) => r.position === 1)?.duration : null;
  return {
    kind,
    sessionName: s.session_name,
    sprint,
    segment: Array.isArray(poleParts) ? `${sprint ? "SQ" : "Q"}${poleParts.length}` : null,
    season: weekend.season,
    round: weekend.round,
    grandPrixName: weekend.grandPrixName,
    top,
    endedAt: new Date(endOf(s)).toISOString(),
  };
}

// The last answer worked out, for when OpenF1 is busy or locked (a session
// running) and its cached data has run out.
let lastGood: SessionHero | null = null;

/** The latest answer worked out so far, without asking OpenF1 again. */
export const latestSessionHero = (): SessionHero | null => lastGood;

export async function getSessionHero(): Promise<SessionHero | null> {
  try {
    lastGood = await build();
  } catch (err) {
    console.warn("[home] session hero kept:", err instanceof Error ? err.message : err);
  }
  return lastGood;
}

// The answer at hand within `waitMs`: the home page never waits on OpenF1
// for long. A slow answer keeps working and is ready for the next visitor.
export function sessionHeroWithin(waitMs: number): Promise<SessionHero | null> {
  return Promise.race([
    getSessionHero(),
    new Promise<SessionHero | null>((r) => setTimeout(() => r(lastGood), waitMs).unref?.()),
  ]);
}

// Check every 5 minutes in the queue's spare budget, so a session's result is
// ready soon after OpenF1 opens it, before anyone asks.
export function warmSessionHero(): void {
  const run = () => void inBackground(getSessionHero);
  setTimeout(run, 5_000).unref();
  setInterval(run, 5 * 60_000).unref();
}
