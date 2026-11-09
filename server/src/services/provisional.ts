import { cached } from "../cache/cache";
import type { PracticeSession, QualifyingEntry, RaceWeekend, WeekendHighlight, WeekendResult } from "../types/f1";
import { getRaceWeekend, getSeasonDrivers, type SeasonDriver } from "./f1db";
import { LIVE_MARGIN_MS, endOf, getReplay, getYearSessions, type RawSession } from "./live";
import { rawDrivers, type RawDriver } from "./openf1";
import { inBackground, isOpenF1Unavailable, optional } from "./openf1Client";
import { formatDuration, formatGap, lastSet, matchDriver, sessionResult, titleCase, type RawResult } from "./sessionHero";

// A race weekend between its sessions and f1db's release, which usually comes
// the morning after the race: the classification from OpenF1's session
// results (open 30 minutes after a session ends), the race's grid from the
// replay's first positions and its fastest lap from the replay's lap times.
// Marked provisional: penalties after the race may still change it. Once
// f1db has the race, its own results take over by themselves.

const DAY = 86_400_000;

// PROVISIONAL_ROUND=2026:20 (local checks only) shows that round as if f1db
// hadn't got it yet.
const TRY = process.env.PROVISIONAL_ROUND;

export async function getRaceWeekendNow(season: string, round: string): Promise<RaceWeekend | null> {
  let wk = await getRaceWeekend(season, round);
  const trying = TRY === `${season}:${round}`;
  if (wk && trying) wk = { ...wk, results: [], sprintResults: [], qualifying: [], sprintQualifying: [], practices: [], fastestLap: null };
  if (!wk || wk.results.length || Number(season) < 2023) return wk;
  // only around the weekend: from its Friday to a week after the race
  const day = Date.parse(`${wk.date}T12:00:00Z`);
  if (!trying && (Date.now() < day - 3 * DAY || Date.now() > day + 8 * DAY)) return wk;
  try {
    return (await provisional(wk)) ?? wk;
  } catch (err) {
    if (isOpenF1Unavailable(err)) return wk; // busy or locked: the f1db page now, the next visitor tries again
    throw err;
  }
}

// Kept 10 minutes (penalties come in after the flag), a minute while OpenF1
// has nothing yet.
function provisional(wk: RaceWeekend): Promise<RaceWeekend | null> {
  return cached(`prov:${wk.season}:${wk.round}`, (v) => (v ? 600 : 60), () => build(wk));
}

// Check every 10 minutes in the queue's spare budget, so a weekend's results
// are ready before the first visitor (or crawler) asks.
export function warmProvisional(current: () => Promise<{ season: string; round: string } | null>): void {
  const run = () =>
    void inBackground(async () => {
      const r = await current();
      if (r) await getRaceWeekendNow(r.season, r.round).catch(() => null);
    });
  setTimeout(run, 20_000).unref();
  setInterval(run, 10 * 60_000).unref();
}

// Exported to check it against f1db on a race f1db already has.
export async function build(wk: RaceWeekend): Promise<RaceWeekend | null> {
  const sessions = await getYearSessions(Number(wk.season));
  const race = nearest(sessions, "Race", Date.parse(`${wk.date}T12:00:00Z`));
  if (!race) return null;
  const meeting = sessions.filter((s) => s.meeting_key === race.meeting_key && !s.is_cancelled);
  const open = (s: RawSession | undefined) => (s && endOf(s) + LIVE_MARGIN_MS <= Date.now() ? s : undefined);
  const named = (...names: string[]) => open(meeting.find((s) => names.includes(s.session_name)));

  const season = await getSeasonDrivers(Number(wk.season));
  const drivers = await rawDrivers(race.session_key).catch(optional<RawDriver[]>([]));
  const who = whoIs(drivers, season);

  const raceS = named("Race");
  const sprintS = named("Sprint");
  const qualiS = named("Qualifying");
  const sprintQualiS = named("Sprint Qualifying", "Sprint Shootout");
  const practiceS = [1, 2, 3].map((n) => named(`Practice ${n}`));

  const [results, sprintResults, qualifying, sprintQualifying, practices] = await Promise.all([
    raceS ? raceClassification(raceS, who) : null,
    sprintS ? raceClassification(sprintS, who) : null,
    qualiS ? qualiClassification(qualiS, who) : null,
    sprintQualiS ? qualiClassification(sprintQualiS, who) : null,
    Promise.all(practiceS.map((s, i) => (s ? practiceClassification(s, i + 1, who) : null))),
  ]);
  if (!results?.rows.length && !qualifying?.length && !practices.some((p) => p?.results.length)) return null;

  return {
    ...wk,
    // f1db's own sessions stay where it has them
    results: results?.rows ?? [],
    sprintResults: wk.sprintResults.length ? wk.sprintResults : sprintResults?.rows ?? [],
    qualifying: wk.qualifying.length ? wk.qualifying : qualifying ?? [],
    sprintQualifying: wk.sprintQualifying.length ? wk.sprintQualifying : sprintQualifying ?? [],
    practices: wk.practices.length ? wk.practices : (practices.filter(Boolean) as PracticeSession[]),
    fastestLap: wk.fastestLap ?? results?.fastest ?? null,
    provisional: true,
  };
}

// The session of that name nearest to the f1db race day (local day vs UTC start).
function nearest(sessions: RawSession[], name: string, target: number): RawSession | null {
  let best: RawSession | null = null;
  for (const s of sessions) {
    if (s.session_name !== name || s.is_cancelled) continue;
    const diff = Math.abs(Date.parse(s.date_start) - target);
    if (diff <= 1.5 * DAY && (!best || diff < Math.abs(Date.parse(best.date_start) - target))) best = s;
  }
  return best;
}

interface Who {
  driverId: string;
  driverName: string;
  driverCode: string | null;
  nationality: string;
  countryCode: string | null;
  constructorId: string;
  constructorName: string;
}

// An OpenF1 car number as one of f1db's drivers (a stand-in f1db doesn't list
// keeps OpenF1's name and no id).
function whoIs(drivers: RawDriver[], season: SeasonDriver[]): (num: number) => Who {
  return (num) => {
    const d = drivers.find((x) => x.driver_number === num);
    const f = matchDriver(d, season);
    return {
      driverId: f?.driverId ?? "",
      driverName: f ? `${f.firstName} ${f.lastName}` : titleCase(d?.full_name ?? `#${num}`),
      driverCode: d?.name_acronym ?? f?.abbreviation ?? null,
      nationality: f?.nationality ?? "",
      countryCode: f?.countryCode ?? null,
      constructorId: f?.constructorId ?? "",
      constructorName: f?.constructorName ?? d?.team_name ?? "",
    };
  };
}

// Classified cars by position, then the rest as f1db writes them: retired
// (most laps first), disqualified, did not start.
export function classify(results: RawResult[], who: (num: number) => Who, grid: Map<number, number>): WeekendResult[] {
  const status = (r: RawResult) => (r.position != null && !r.dsq ? "" : r.dsq ? "DSQ" : r.dns ? "DNS" : "DNF");
  const rank = (r: RawResult) => (r.position != null && !r.dsq ? r.position : 1000 + ["DNF", "DSQ", "DNS"].indexOf(status(r)) * 100 - (r.number_of_laps ?? 0));
  return results
    .slice()
    .sort((a, b) => rank(a) - rank(b))
    .map((r) => {
      const st = status(r);
      const duration = lastSet(r.duration);
      const gap = lastSet(r.gap_to_leader);
      const g = grid.get(r.driver_number) ?? null;
      const finish = st ? null : r.position!;
      return {
        positionText: st || String(r.position),
        ...who(r.driver_number),
        timeDisplay: st
          ? st === "DNF" ? "Retired" : st
          : r.position === 1
            ? duration != null ? formatDuration(duration) : ""
            : gap != null && gap !== 0 ? formatGap(gap) : "",
        laps: r.number_of_laps ?? null,
        points: r.points ?? 0,
        gridPosition: g,
        positionsGained: g != null && finish != null ? g - finish : null,
      };
    });
}

async function raceClassification(s: RawSession, who: (num: number) => Who): Promise<{ rows: WeekendResult[]; fastest: WeekendHighlight | null }> {
  const results = await sessionResult(s.session_key, true);
  if (!results.length) return { rows: [], fastest: null };
  // the replay gives the grid (each car's first position) and every lap time
  const replay = await getReplay(s.session_key).catch(optional(null));
  const grid = new Map<number, number>();
  for (const p of replay?.pos ?? []) if (!grid.has(p.num)) grid.set(p.num, p.p);
  let best: { num: number; lap: number; d: number } | null = null;
  for (const l of replay?.laps ?? []) if (l.d != null && l.lap > 1 && (!best || l.d < best.d)) best = { num: l.num, lap: l.lap, d: l.d };
  const rows = classify(results, who, grid);
  const fw = best && who(best.num);
  return {
    rows,
    fastest: best && fw ? { driverId: fw.driverId, driverName: fw.driverName, constructorId: fw.constructorId, constructorName: fw.constructorName, detail: `${formatDuration(best.d)} (lap ${best.lap})` } : null,
  };
}

async function qualiClassification(s: RawSession, who: (num: number) => Who): Promise<QualifyingEntry[]> {
  const results = await sessionResult(s.session_key, false);
  const part = (r: RawResult, i: number) => {
    const v = Array.isArray(r.duration) ? r.duration[i] : i === 0 ? r.duration : null;
    return typeof v === "number" ? formatDuration(v) : null;
  };
  return results
    .filter((r) => r.position != null)
    .sort((a, b) => a.position! - b.position!)
    .map((r) => {
      const w = who(r.driver_number);
      return { position: r.position, driverId: w.driverId, driverName: w.driverName, driverCode: w.driverCode, constructorId: w.constructorId, constructorName: w.constructorName, q1: part(r, 0), q2: part(r, 1), q3: part(r, 2) };
    });
}

async function practiceClassification(s: RawSession, number: number, who: (num: number) => Who): Promise<PracticeSession | null> {
  const results = await sessionResult(s.session_key, false);
  if (!results.length) return null;
  return {
    number,
    results: results
      .slice()
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      .map((r) => {
        const w = who(r.driver_number);
        const duration = lastSet(r.duration);
        const gap = lastSet(r.gap_to_leader);
        return {
          positionText: r.position != null ? String(r.position) : "",
          driverId: w.driverId, driverName: w.driverName, driverCode: w.driverCode,
          constructorId: w.constructorId, constructorName: w.constructorName,
          time: duration != null ? formatDuration(duration) : null,
          gap: r.position !== 1 && gap != null && gap !== 0 ? formatGap(gap) : null,
          laps: r.number_of_laps ?? null,
        };
      }),
  };
}
