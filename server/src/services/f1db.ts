import AdmZip from "adm-zip";
import type {
  CalendarRace,
  CalendarSession,
  CircuitProfile,
  CircuitRace,
  CircuitSummary,
  CircuitTally,
  PracticeSession,
  CalendarResponse,
  ConstructorProfile,
  ConstructorSeasonEntry,
  ConstructorStanding,
  DriverProfile,
  DriverSeasonEntry,
  DriverStanding,
  DriverComparison,
  DriverListItem,
  ConstructorListItem,
  HeadToHead,
  HomeHighlights,
  NotableRetirement,
  PodiumEntry,
  ProgressionSeries,
  QualifyingEntry,
  RaceResult,
  RaceResultResponse,
  RaceWeekend,
  SeasonComparison,
  SeasonDriverStats,
  SeasonProgression,
  StandingsResponse,
  WeekendHighlight,
  WeekendResult,
} from "../types/f1";

// f1db ships its data as downloadable release artifacts (no live API to time
// out). We fetch the latest "splitted JSON" zip once, unzip it in memory, and
// join the normalized tables into the flat shapes our client expects.
//
// Data: https://github.com/f1db/f1db (CC-BY 4.0).

const LATEST_ZIP_URL =
  "https://github.com/f1db/f1db/releases/latest/download/f1db-json-splitted.zip";

// --- raw f1db record shapes (only the fields we use) ---
interface RawSeasonDriverStanding {
  year: number;
  positionDisplayOrder: number;
  positionNumber: number | null;
  positionText: string;
  driverId: string;
  points: number;
}
interface RawSeasonConstructorStanding {
  year: number;
  positionDisplayOrder: number;
  positionNumber: number | null;
  positionText: string;
  constructorId: string;
  points: number;
}
interface RawDriver {
  id: string;
  firstName: string;
  lastName: string;
  abbreviation: string | null;
  permanentNumber: string | null;
  nationalityCountryId: string;
}
interface RawConstructor {
  id: string;
  name: string;
  fullName: string;
  countryId: string;
}
interface RawCountry {
  id: string;
  alpha2Code: string;
  demonym: string | null;
}
interface RawEntrantDriver {
  year: number;
  constructorId: string;
  driverId: string;
  rounds: number[];
  testDriver: boolean;
}
interface RawRaceResult {
  year: number;
  round: number;
  positionDisplayOrder: number;
  positionNumber: number | null;
  positionText: string;
  driverId: string;
  constructorId: string;
  time: string | null;
  gap: string | null;
  gapLaps: number | null;
  reasonRetired: string | null;
  laps: number | null;
  points: number | null;
}
interface RawRace {
  year: number;
  round: number;
  date: string;
  grandPrixId: string;
  officialName: string;
  circuitId: string;
  circuitLayoutId?: string | null;
  sprintRaceDate: string | null;
  // Session dates (yyyy-mm-dd) and UTC start times (HH:mm); null when the
  // session didn't run or the time isn't known (most older seasons).
  time?: string | null;
  freePractice1Date?: string | null;
  freePractice1Time?: string | null;
  freePractice2Date?: string | null;
  freePractice2Time?: string | null;
  freePractice3Date?: string | null;
  freePractice3Time?: string | null;
  sprintQualifyingDate?: string | null;
  sprintQualifyingTime?: string | null;
  sprintRaceTime?: string | null;
  qualifyingDate?: string | null;
  qualifyingTime?: string | null;
}

// A race weekend's sessions in running order. `start` is a UTC ISO timestamp
// when the time is known, else just the date.
function raceSessions(r: RawRace): CalendarSession[] {
  const pairs: [CalendarSession["kind"], string | null | undefined, string | null | undefined][] = [
    ["FP1", r.freePractice1Date, r.freePractice1Time],
    ["FP2", r.freePractice2Date, r.freePractice2Time],
    ["FP3", r.freePractice3Date, r.freePractice3Time],
    ["SQ", r.sprintQualifyingDate, r.sprintQualifyingTime],
    ["SPRINT", r.sprintRaceDate, r.sprintRaceTime],
    ["Q", r.qualifyingDate, r.qualifyingTime],
    ["RACE", r.date, r.time],
  ];
  return pairs
    .filter(([, date]) => !!date)
    .map(([kind, date, time]) => ({
      kind,
      start: time ? `${date}T${time}:00Z` : (date as string),
      timeKnown: !!time,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Sprint results mirror race results, plus grid/gained already computed by f1db.
interface RawSprintResult extends RawRaceResult {
  gridPositionNumber: number | null;
  positionsGained: number | null;
}
interface RawGrandPrix {
  id: string;
  name: string;
  countryId: string;
}
interface RawCircuit {
  id: string;
  name: string;
  placeName: string;
  fullName?: string;
  previousNames?: string | null;
  type?: string; // RACE | ROAD | STREET
  direction?: string; // CLOCKWISE | ANTI_CLOCKWISE
  countryId?: string;
  latitude?: number;
  longitude?: number;
  length?: number;
  turns?: number;
  totalRacesHeld?: number;
}
interface RawCircuitLayout {
  id: string;
  circuitId: string;
  length: number | null;
  turns: number | null;
}

interface WinCounts {
  drivers: Map<string, number>;
  constructors: Map<string, number>;
}

interface RaceWinner {
  driverId: string;
  constructorId: string;
}

// Cumulative championship standing for a driver after a given race (round).
interface RawRaceDriverStanding {
  year: number;
  round: number;
  positionDisplayOrder: number;
  positionNumber: number | null;
  driverId: string;
  points: number;
}

// --- race-weekend detail tables (kept compact per race) ---
interface RawQualifying {
  year: number;
  round: number;
  positionDisplayOrder: number;
  positionNumber: number | null;
  driverId: string;
  constructorId: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}
interface RawPractice {
  year: number;
  round: number;
  positionText: string;
  driverId: string;
  constructorId: string;
  time: string | null;
  gap: string | null;
  laps: number | null;
}
interface PracticeRow {
  position: string;
  driverId: string;
  constructorId: string;
  time: string | null;
  gap: string | null;
  laps: number | null;
}
interface RawGrid {
  year: number;
  round: number;
  positionNumber: number | null;
  driverId: string;
}
interface RawFastestLap {
  year: number;
  round: number;
  positionNumber: number | null;
  driverId: string;
  constructorId: string;
  lap: number | null;
  time: string | null;
  timeMillis?: number | null;
}
interface RawDriverOfTheDay {
  year: number;
  round: number;
  positionNumber: number | null;
  driverId: string;
  constructorId: string;
  percentage: number | null;
}

interface QualiRow {
  position: number | null;
  driverId: string;
  constructorId: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}
interface HighlightRow {
  driverId: string;
  constructorId: string;
  detail: string;
  // Fastest lap only: the lap time, for circuit lap records.
  time?: string | null;
  timeMillis?: number | null;
}

interface CareerAgg {
  firstSeason: number;
  lastSeason: number;
  races: number;
  podiums: number;
}

interface Dataset {
  version: string;
  driverStandings: RawSeasonDriverStanding[];
  constructorStandings: RawSeasonConstructorStanding[];
  drivers: Map<string, RawDriver>;
  constructors: Map<string, RawConstructor>;
  countries: Map<string, RawCountry>;
  races: RawRace[];
  grandsPrix: Map<string, RawGrandPrix>;
  circuits: Map<string, RawCircuit>;
  circuitLayouts: Map<string, RawCircuitLayout>;
  // `${year}:${driverId}` -> constructorId the driver raced most rounds for
  teamByYearDriver: Map<string, string>;
  winsByYear: Map<number, WinCounts>;
  // `${year}:${round}` -> winner (P1 finisher)
  winnerByRace: Map<string, RaceWinner>;
  // `${year}:${round}` -> full classification (all finishers/retirements)
  resultsByRace: Map<string, RawRaceResult[]>;
  // `${year}:${round}` -> sprint-race classification (sprint weekends only)
  sprintResultsByRace: Map<string, RawSprintResult[]>;
  // career totals for profile pages, keyed by driverId / constructorId
  driverCareer: Map<string, CareerAgg>;
  constructorCareer: Map<string, CareerAgg>;
  // per-round cumulative driver standings (for the title-race chart)
  racesDriverStandings: RawRaceDriverStanding[];
  // race-weekend detail, keyed by `${year}:${round}` (compact)
  qualifyingByRace: Map<string, QualiRow[]>;
  sprintQualifyingByRace: Map<string, QualiRow[]>;
  // `${year}:${round}:${n}` -> free practice n classification
  practiceByRace: Map<string, PracticeRow[]>;
  gridByRace: Map<string, Map<string, number>>; // driverId → grid position
  fastestLapByRace: Map<string, HighlightRow>;
  driverOfDayByRace: Map<string, HighlightRow>;
}

let datasetPromise: Promise<Dataset> | null = null;

async function fetchLatestZip(): Promise<{ version: string; zip: AdmZip }> {
  // Pull the stable-named asset straight from GitHub's "latest release" download
  // redirect instead of resolving it via api.github.com. The REST API caps
  // unauthenticated callers at 60 req/hr per IP, which shared hosting egress IPs
  // (e.g. Render's free tier) exhaust quickly → 403; the release-download path
  // has no such limit.
  const res = await fetch(LATEST_ZIP_URL, {
    headers: { "User-Agent": "f1-dashboard" },
  });
  if (!res.ok) throw new Error(`f1db download failed: ${res.status}`);
  // The redirect chain passes through /releases/download/<tag>/…; recover the
  // tag from the resolved URL when present, else label it "latest".
  const version = res.url.match(/\/releases\/download\/([^/]+)\//)?.[1] ?? "latest";
  const buf = Buffer.from(await res.arrayBuffer());
  return { version, zip: new AdmZip(buf) };
}

async function loadDataset(): Promise<Dataset> {
  const { version, zip } = await fetchLatestZip();
  const read = <T>(name: string): T[] =>
    JSON.parse(zip.readAsText(name)) as T[];

  const driverStandings = read<RawSeasonDriverStanding>(
    "f1db-seasons-driver-standings.json"
  );
  const constructorStandings = read<RawSeasonConstructorStanding>(
    "f1db-seasons-constructor-standings.json"
  );
  const drivers = new Map(
    read<RawDriver>("f1db-drivers.json").map((d) => [d.id, d])
  );
  const constructors = new Map(
    read<RawConstructor>("f1db-constructors.json").map((c) => [c.id, c])
  );
  const countries = new Map(
    read<RawCountry>("f1db-countries.json").map((c) => [c.id, c])
  );
  const races = read<RawRace>("f1db-races.json");
  const racesDriverStandings = read<RawRaceDriverStanding>(
    "f1db-races-driver-standings.json"
  );
  const grandsPrix = new Map(
    read<RawGrandPrix>("f1db-grands-prix.json").map((g) => [g.id, g])
  );
  const circuits = new Map(
    read<RawCircuit>("f1db-circuits.json").map((c) => [c.id, c])
  );
  const circuitLayouts = new Map(
    read<RawCircuitLayout>("f1db-circuits-layouts.json").map((l) => [l.id, l])
  );

  // Resolve each driver's constructor for a season (most rounds wins, to handle
  // mid-season swaps).
  const teamByYearDriver = new Map<string, string>();
  const roundsSeen = new Map<string, number>();
  for (const e of read<RawEntrantDriver>(
    "f1db-seasons-entrants-drivers.json"
  )) {
    if (e.testDriver) continue;
    const key = `${e.year}:${e.driverId}`;
    const rounds = e.rounds?.length ?? 0;
    if (rounds >= (roundsSeen.get(key) ?? -1)) {
      roundsSeen.set(key, rounds);
      teamByYearDriver.set(key, e.constructorId);
    }
  }

  // Single pass over race results: collect the full classification per race,
  // derive per-season win counts + the race winner from P1 finishes, and
  // accumulate career totals (first/last season, races entered, podiums) per
  // driver and per constructor for the profile pages.
  const winsByYear = new Map<number, WinCounts>();
  const winnerByRace = new Map<string, RaceWinner>();
  const resultsByRace = new Map<string, RawRaceResult[]>();
  const driverCareer = new Map<string, CareerAgg>();
  const constructorCareer = new Map<string, CareerAgg>();
  // Constructors field two cars per race, so "races entered" must dedupe by
  // race, not count raw result rows (which would double it).
  const constructorRaceKeys = new Map<string, Set<string>>();

  const bumpCareer = (
    map: Map<string, CareerAgg>,
    id: string,
    year: number,
    isPodium: boolean
  ) => {
    let agg = map.get(id);
    if (!agg) {
      agg = { firstSeason: year, lastSeason: year, races: 0, podiums: 0 };
      map.set(id, agg);
    }
    agg.firstSeason = Math.min(agg.firstSeason, year);
    agg.lastSeason = Math.max(agg.lastSeason, year);
    if (isPodium) agg.podiums += 1;
    return agg;
  };

  for (const r of read<RawRaceResult>("f1db-races-race-results.json")) {
    const raceKey = `${r.year}:${r.round}`;
    let arr = resultsByRace.get(raceKey);
    if (!arr) {
      arr = [];
      resultsByRace.set(raceKey, arr);
    }
    arr.push(r);

    const isPodium = r.positionNumber !== null && r.positionNumber <= 3;

    const driverAgg = bumpCareer(driverCareer, r.driverId, r.year, isPodium);
    driverAgg.races += 1;

    bumpCareer(constructorCareer, r.constructorId, r.year, isPodium);
    let raceKeys = constructorRaceKeys.get(r.constructorId);
    if (!raceKeys) {
      raceKeys = new Set();
      constructorRaceKeys.set(r.constructorId, raceKeys);
    }
    raceKeys.add(raceKey);

    if (r.positionNumber !== 1) continue;
    let w = winsByYear.get(r.year);
    if (!w) {
      w = { drivers: new Map(), constructors: new Map() };
      winsByYear.set(r.year, w);
    }
    w.drivers.set(r.driverId, (w.drivers.get(r.driverId) ?? 0) + 1);
    w.constructors.set(
      r.constructorId,
      (w.constructors.get(r.constructorId) ?? 0) + 1
    );
    winnerByRace.set(raceKey, {
      driverId: r.driverId,
      constructorId: r.constructorId,
    });
  }

  // Fix up constructor "races" to distinct-race counts (see note above).
  for (const [constructorId, keys] of constructorRaceKeys) {
    const agg = constructorCareer.get(constructorId);
    if (agg) agg.races = keys.size;
  }

  // Sprint-race classification, keyed by race (sprint weekends only).
  const sprintResultsByRace = new Map<string, RawSprintResult[]>();
  for (const r of read<RawSprintResult>(
    "f1db-races-sprint-race-results.json"
  )) {
    const raceKey = `${r.year}:${r.round}`;
    let arr = sprintResultsByRace.get(raceKey);
    if (!arr) {
      arr = [];
      sprintResultsByRace.set(raceKey, arr);
    }
    arr.push(r);
  }

  // Race-weekend detail. We reduce each big table to a compact per-race shape
  // right away (the large parsed arrays are then free to GC) to keep the
  // retained footprint small; pit stops are intentionally not loaded.
  const readQualifying = (file: string) => {
    const byRace = new Map<string, QualiRow[]>();
    for (const q of read<RawQualifying>(file)) {
      const key = `${q.year}:${q.round}`;
      let arr = byRace.get(key);
      if (!arr) {
        arr = [];
        byRace.set(key, arr);
      }
      arr.push({
        position: q.positionNumber,
        driverId: q.driverId,
        constructorId: q.constructorId,
        q1: q.q1,
        q2: q.q2,
        q3: q.q3,
      });
    }
    return byRace;
  };
  const qualifyingByRace = readQualifying("f1db-races-qualifying-results.json");
  const sprintQualifyingByRace = readQualifying(
    "f1db-races-sprint-qualifying-results.json"
  );

  // Free practice 1-4, compact rows keyed `${year}:${round}:${n}`.
  const practiceByRace = new Map<string, PracticeRow[]>();
  for (const n of [1, 2, 3, 4]) {
    for (const p of read<RawPractice>(`f1db-races-free-practice-${n}-results.json`)) {
      const key = `${p.year}:${p.round}:${n}`;
      let arr = practiceByRace.get(key);
      if (!arr) {
        arr = [];
        practiceByRace.set(key, arr);
      }
      arr.push({
        position: p.positionText,
        driverId: p.driverId,
        constructorId: p.constructorId,
        time: p.time,
        gap: p.gap,
        laps: p.laps,
      });
    }
  }

  const gridByRace = new Map<string, Map<string, number>>();
  for (const g of read<RawGrid>("f1db-races-starting-grid-positions.json")) {
    if (g.positionNumber == null) continue;
    const key = `${g.year}:${g.round}`;
    let m = gridByRace.get(key);
    if (!m) {
      m = new Map();
      gridByRace.set(key, m);
    }
    m.set(g.driverId, g.positionNumber);
  }

  const fastestLapByRace = new Map<string, HighlightRow>();
  for (const f of read<RawFastestLap>("f1db-races-fastest-laps.json")) {
    if (f.positionNumber !== 1) continue; // overall fastest lap only
    fastestLapByRace.set(`${f.year}:${f.round}`, {
      driverId: f.driverId,
      constructorId: f.constructorId,
      detail: f.time ? `${f.time}${f.lap ? ` (lap ${f.lap})` : ""}` : "",
      time: f.time,
      timeMillis: f.timeMillis ?? null,
    });
  }

  const driverOfDayByRace = new Map<string, HighlightRow>();
  for (const d of read<RawDriverOfTheDay>(
    "f1db-races-driver-of-the-day-results.json"
  )) {
    if (d.positionNumber !== 1) continue; // the winner of the vote
    driverOfDayByRace.set(`${d.year}:${d.round}`, {
      driverId: d.driverId,
      constructorId: d.constructorId,
      detail: d.percentage != null ? `${d.percentage}% of the vote` : "",
    });
  }

  return {
    version,
    driverStandings,
    constructorStandings,
    drivers,
    constructors,
    countries,
    races,
    grandsPrix,
    circuits,
    circuitLayouts,
    teamByYearDriver,
    winsByYear,
    winnerByRace,
    resultsByRace,
    sprintResultsByRace,
    driverCareer,
    constructorCareer,
    racesDriverStandings,
    qualifyingByRace,
    sprintQualifyingByRace,
    practiceByRace,
    gridByRace,
    fastestLapByRace,
    driverOfDayByRace,
  };
}

// How often a long-lived process re-pulls the latest f1db release in the
// background. On Render's free tier cold starts already refresh the data (a woken
// instance is a new process that re-downloads); this keeps an always-on instance
// current without a redeploy. Override with F1DB_REFRESH_MS; set 0 to disable.
const REFRESH_INTERVAL_MS =
  process.env.F1DB_REFRESH_MS !== undefined
    ? Number(process.env.F1DB_REFRESH_MS)
    : 12 * 60 * 60 * 1000; // 12h

let refreshTimer: NodeJS.Timeout | null = null;

// Cached for the process lifetime and refreshed in the background on a timer.
function dataset(): Promise<Dataset> {
  if (!datasetPromise) {
    datasetPromise = loadDataset().then(
      (ds) => {
        scheduleRefresh();
        return ds;
      },
      (err) => {
        datasetPromise = null; // allow retry on the next request
        throw err;
      },
    );
  }
  return datasetPromise;
}

// Periodically load a fresh copy in the background and swap it in only on
// success, so a failed refresh never replaces good data and requests are never
// blocked waiting on it.
function scheduleRefresh(): void {
  if (refreshTimer || !(REFRESH_INTERVAL_MS > 0)) return;
  refreshTimer = setInterval(() => {
    loadDataset().then(
      (fresh) => {
        datasetPromise = Promise.resolve(fresh);
      },
      (err) => {
        console.warn(`f1db refresh failed, keeping cached data: ${String(err)}`);
      },
    );
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref(); // don't keep the process alive for the timer alone
}

function demonym(ds: Dataset, countryId: string | undefined): string {
  if (!countryId) return "";
  return ds.countries.get(countryId)?.demonym ?? "";
}

function alpha2(ds: Dataset, countryId: string | undefined): string | null {
  if (!countryId) return null;
  const code = ds.countries.get(countryId)?.alpha2Code;
  return code ? code.toLowerCase() : null;
}

export async function getDriverStandings(
  season: string
): Promise<StandingsResponse<DriverStanding>> {
  const ds = await dataset();
  const year = Number(season);
  const wins = ds.winsByYear.get(year);
  const standings: DriverStanding[] = ds.driverStandings
    .filter((s) => s.year === year)
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder)
    .map((s) => {
      const d = ds.drivers.get(s.driverId);
      const constructorId = ds.teamByYearDriver.get(`${year}:${s.driverId}`) ?? "";
      const c = ds.constructors.get(constructorId);
      return {
        position: s.positionNumber ?? s.positionDisplayOrder,
        points: s.points,
        wins: wins?.drivers.get(s.driverId) ?? 0,
        driverId: s.driverId,
        givenName: d?.firstName ?? "",
        familyName: d?.lastName ?? s.driverId,
        nationality: demonym(ds, d?.nationalityCountryId),
        countryCode: alpha2(ds, d?.nationalityCountryId),
        permanentNumber: d?.permanentNumber != null ? String(d.permanentNumber) : null,
        code: d?.abbreviation ?? null,
        constructorId,
        constructorName: c?.name ?? "",
      };
    });
  return { season, round: "final", standings };
}

export async function getConstructorStandings(
  season: string
): Promise<StandingsResponse<ConstructorStanding>> {
  const ds = await dataset();
  const year = Number(season);
  const wins = ds.winsByYear.get(year);
  const standings: ConstructorStanding[] = ds.constructorStandings
    .filter((s) => s.year === year)
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder)
    .map((s) => {
      const c = ds.constructors.get(s.constructorId);
      return {
        position: s.positionNumber ?? s.positionDisplayOrder,
        points: s.points,
        wins: wins?.constructors.get(s.constructorId) ?? 0,
        constructorId: s.constructorId,
        name: c?.name ?? s.constructorId,
        nationality: demonym(ds, c?.countryId),
        countryCode: alpha2(ds, c?.countryId),
      };
    });
  return { season, round: "final", standings };
}

function formatResultTime(r: {
  positionNumber: number | null;
  time: string | null;
  gap: string | null;
  gapLaps: number | null;
  reasonRetired: string | null;
}): string {
  if (r.positionNumber === 1 && r.time) return r.time;
  if (r.gap) return r.gap;
  if (r.gapLaps) return `+${r.gapLaps} lap${r.gapLaps > 1 ? "s" : ""}`;
  if (r.reasonRetired) return r.reasonRetired;
  return "—";
}

export async function getRaceResults(
  season: string,
  round: string
): Promise<RaceResultResponse> {
  const ds = await dataset();
  const rows = (ds.resultsByRace.get(`${season}:${round}`) ?? [])
    .slice()
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder);
  const race = ds.races.find(
    (r) => r.year === Number(season) && r.round === Number(round)
  );
  const gp = race ? ds.grandsPrix.get(race.grandPrixId) : undefined;

  const results: RaceResult[] = rows.map((r) => {
    const d = ds.drivers.get(r.driverId);
    const c = ds.constructors.get(r.constructorId);
    return {
      positionText: r.positionText,
      driverId: r.driverId,
      driverName: d ? `${d.firstName} ${d.lastName}` : r.driverId,
      driverCode: d?.abbreviation ?? null,
      nationality: demonym(ds, d?.nationalityCountryId),
      countryCode: alpha2(ds, d?.nationalityCountryId),
      constructorId: r.constructorId,
      constructorName: c?.name ?? r.constructorId,
      timeDisplay: formatResultTime(r),
      laps: r.laps ?? null,
      points: r.points ?? 0,
    };
  });

  return {
    season,
    round,
    raceName: gp?.name ?? "",
    officialName: race?.officialName ?? "",
    date: race?.date ?? "",
    results,
  };
}

export async function getCalendar(season: string): Promise<CalendarResponse> {
  const ds = await dataset();
  const year = Number(season);
  const races: CalendarRace[] = ds.races
    .filter((r) => r.year === year)
    .sort((a, b) => a.round - b.round)
    .map((r) => {
      const gp = ds.grandsPrix.get(r.grandPrixId);
      const circuit = ds.circuits.get(r.circuitId);
      const winner = ds.winnerByRace.get(`${year}:${r.round}`);
      const winnerDriver = winner ? ds.drivers.get(winner.driverId) : undefined;
      const winnerTeam = winner
        ? ds.constructors.get(winner.constructorId)
        : undefined;
      return {
        round: r.round,
        grandPrixId: r.grandPrixId,
        name: gp?.name ?? r.grandPrixId,
        officialName: r.officialName,
        date: r.date,
        circuitId: r.circuitId,
        circuitName: circuit?.name ?? r.circuitId,
        placeName: circuit?.placeName ?? "",
        nationality: demonym(ds, gp?.countryId),
        countryCode: alpha2(ds, gp?.countryId),
        winnerDriverId: winner?.driverId ?? null,
        winnerName: winnerDriver
          ? `${winnerDriver.firstName} ${winnerDriver.lastName}`
          : null,
        winnerConstructorId: winner?.constructorId ?? null,
        winnerConstructorName: winnerTeam?.name ?? null,
        // f1db has no sprint dates for some seasons (e.g. 2023) but does have
        // the sprint results, so either marks a sprint weekend.
        isSprint:
          r.sprintRaceDate != null || ds.sprintResultsByRace.has(`${year}:${r.round}`),
        sessions: raceSessions(r),
      };
    });
  return { season, races };
}

export async function getDriverProfile(
  driverId: string
): Promise<DriverProfile | null> {
  const ds = await dataset();
  const career = ds.driverCareer.get(driverId);
  if (!career) return null;

  const d = ds.drivers.get(driverId);
  const rawSeasons = ds.driverStandings
    .filter((s) => s.driverId === driverId)
    .sort((a, b) => a.year - b.year);

  const seasons: DriverSeasonEntry[] = rawSeasons.map((s) => {
    const constructorId =
      ds.teamByYearDriver.get(`${s.year}:${driverId}`) ?? "";
    const c = ds.constructors.get(constructorId);
    return {
      season: s.year,
      constructorId,
      constructorName: c?.name ?? "",
      position: s.positionNumber ?? s.positionDisplayOrder,
      points: s.points,
      wins: ds.winsByYear.get(s.year)?.drivers.get(driverId) ?? 0,
    };
  });

  return {
    driverId,
    givenName: d?.firstName ?? "",
    familyName: d?.lastName ?? driverId,
    nationality: demonym(ds, d?.nationalityCountryId),
    countryCode: alpha2(ds, d?.nationalityCountryId),
    permanentNumber:
      d?.permanentNumber != null ? String(d.permanentNumber) : null,
    code: d?.abbreviation ?? null,
    firstSeason: career.firstSeason,
    lastSeason: career.lastSeason,
    championships: rawSeasons.filter((s) => s.positionNumber === 1).length,
    wins: seasons.reduce((sum, s) => sum + s.wins, 0),
    podiums: career.podiums,
    points: rawSeasons.reduce((sum, s) => sum + s.points, 0),
    races: career.races,
    seasons,
  };
}

export async function getConstructorProfile(
  constructorId: string
): Promise<ConstructorProfile | null> {
  const ds = await dataset();
  const career = ds.constructorCareer.get(constructorId);
  if (!career) return null;

  const c = ds.constructors.get(constructorId);
  const rawSeasons = ds.constructorStandings
    .filter((s) => s.constructorId === constructorId)
    .sort((a, b) => a.year - b.year);

  const seasons: ConstructorSeasonEntry[] = rawSeasons.map((s) => ({
    season: s.year,
    position: s.positionNumber ?? s.positionDisplayOrder,
    points: s.points,
    wins: ds.winsByYear.get(s.year)?.constructors.get(constructorId) ?? 0,
  }));

  return {
    constructorId,
    name: c?.name ?? constructorId,
    nationality: demonym(ds, c?.countryId),
    countryCode: alpha2(ds, c?.countryId),
    firstSeason: career.firstSeason,
    lastSeason: career.lastSeason,
    championships: rawSeasons.filter((s) => s.positionNumber === 1).length,
    wins: seasons.reduce((sum, s) => sum + s.wins, 0),
    podiums: career.podiums,
    points: rawSeasons.reduce((sum, s) => sum + s.points, 0),
    races: career.races,
    seasons,
  };
}

// Retirement reasons that read as an on-track incident (for the "notable crash"
// highlight), rather than a mechanical/technical DNF.
const CRASH_REASON = /collision|accident|crash|spun|spin|contact|damage/i;

function driverName(ds: Dataset, driverId: string): string {
  const d = ds.drivers.get(driverId);
  return d ? `${d.firstName} ${d.lastName}` : driverId;
}

// Dynamic home-page highlights derived from the latest completed race in the
// in-memory dataset — no external call. Colours stay client-side.
export async function getHomeHighlights(): Promise<HomeHighlights> {
  const ds = await dataset();
  const season = Math.max(...ds.races.map((r) => r.year));
  const seasonRaces = ds.races
    .filter((r) => r.year === season)
    .sort((a, b) => a.round - b.round);

  // Latest completed round = highest round that has a recorded winner.
  let latestRound = 0;
  for (const r of seasonRaces) {
    if (ds.winnerByRace.has(`${season}:${r.round}`) && r.round > latestRound) {
      latestRound = r.round;
    }
  }

  let latestRace: HomeHighlights["latestRace"] = null;
  let notableRetirement: NotableRetirement | null = null;

  if (latestRound > 0) {
    const race = seasonRaces.find((r) => r.round === latestRound);
    const gp = race ? ds.grandsPrix.get(race.grandPrixId) : undefined;
    const rows = (ds.resultsByRace.get(`${season}:${latestRound}`) ?? [])
      .slice()
      .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder);

    const podium: PodiumEntry[] = rows
      .filter((r) => r.positionNumber != null && r.positionNumber <= 3)
      .map((r) => {
        const c = ds.constructors.get(r.constructorId);
        const d = ds.drivers.get(r.driverId);
        return {
          position: r.positionNumber as number,
          driverId: r.driverId,
          driverName: driverName(ds, r.driverId),
          driverCode: d?.abbreviation ?? null,
          constructorId: r.constructorId,
          constructorName: c?.name ?? r.constructorId,
          countryCode: alpha2(ds, d?.nationalityCountryId),
        };
      });

    // Prefer the best-classified driver who retired due to an incident.
    const crash = rows.find(
      (r) => r.reasonRetired != null && CRASH_REASON.test(r.reasonRetired),
    );
    if (crash?.reasonRetired) {
      notableRetirement = {
        driverId: crash.driverId,
        driverName: driverName(ds, crash.driverId),
        constructorId: crash.constructorId,
        reason: crash.reasonRetired,
      };
    }

    latestRace = {
      season,
      round: latestRound,
      grandPrixName: gp?.name ?? race?.grandPrixId ?? "",
      date: race?.date ?? "",
      countryCode: alpha2(ds, gp?.countryId),
      podium,
    };
  }

  // Championship leader from this season's driver standings (display order 1).
  const leaderRow = ds.driverStandings
    .filter((s) => s.year === season)
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder)[0];
  let championshipLeader: HomeHighlights["championshipLeader"] = null;
  if (leaderRow) {
    const constructorId =
      ds.teamByYearDriver.get(`${season}:${leaderRow.driverId}`) ?? "";
    championshipLeader = {
      driverId: leaderRow.driverId,
      driverName: driverName(ds, leaderRow.driverId),
      constructorId,
      constructorName: ds.constructors.get(constructorId)?.name ?? "",
      points: leaderRow.points,
    };
  }

  // Next race = first upcoming round after the latest completed one.
  const upcoming = seasonRaces.find((r) => r.round > latestRound);
  let nextRace: HomeHighlights["nextRace"] = null;
  if (upcoming) {
    const gp = ds.grandsPrix.get(upcoming.grandPrixId);
    nextRace = {
      round: upcoming.round,
      grandPrixName: gp?.name ?? upcoming.grandPrixId,
      date: upcoming.date,
      countryCode: alpha2(ds, gp?.countryId),
    };
  }

  return { season, latestRace, notableRetirement, championshipLeader, nextRace };
}

// Per-round title-race chart: cumulative points across the season for the top
// drivers. Uses the `races-driver-standings` table (points after each round).
export async function getSeasonProgression(
  season: string,
  topN = 6,
): Promise<SeasonProgression> {
  const ds = await dataset();
  const year = Number(season);
  const rows = ds.racesDriverStandings.filter((s) => s.year === year);

  const rounds = [...new Set(rows.map((r) => r.round))].sort((a, b) => a - b);

  // Short GP label per round, for the x-axis.
  const grandPrixNames = rounds.map((round) => {
    const race = ds.races.find((r) => r.year === year && r.round === round);
    const gp = race ? ds.grandsPrix.get(race.grandPrixId) : undefined;
    return gp?.name ?? `R${round}`;
  });

  if (rounds.length === 0) {
    return { season: year, rounds: [], grandPrixNames: [], series: [] };
  }

  // Rank drivers by their standing after the final available round.
  const lastRound = rounds[rounds.length - 1];
  const topDrivers = rows
    .filter((r) => r.round === lastRound)
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder)
    .slice(0, topN)
    .map((r) => r.driverId);

  // points[driverId][round] lookup for fast alignment + carry-forward.
  const byDriverRound = new Map<string, Map<number, number>>();
  for (const r of rows) {
    let m = byDriverRound.get(r.driverId);
    if (!m) {
      m = new Map();
      byDriverRound.set(r.driverId, m);
    }
    m.set(r.round, r.points);
  }

  const series: ProgressionSeries[] = topDrivers.map((driverId, i) => {
    const roundPoints = byDriverRound.get(driverId) ?? new Map<number, number>();
    let carried = 0;
    const points = rounds.map((round) => {
      const p = roundPoints.get(round);
      if (p != null) carried = p;
      return carried; // carry the last known total across missed rounds
    });
    const d = ds.drivers.get(driverId);
    return {
      driverId,
      driverName: driverName(ds, driverId),
      driverCode: d?.abbreviation ?? null,
      constructorId: ds.teamByYearDriver.get(`${year}:${driverId}`) ?? "",
      finalPosition: i + 1,
      points,
    };
  });

  return { season: year, rounds, grandPrixNames, series };
}

// All drivers who ever started a race, most-recent first — for the comparison
// pickers.
export async function getAllDrivers(): Promise<DriverListItem[]> {
  const ds = await dataset();
  const list: DriverListItem[] = [];
  for (const [driverId, career] of ds.driverCareer) {
    const d = ds.drivers.get(driverId);
    list.push({
      driverId,
      name: driverName(ds, driverId),
      nationality: demonym(ds, d?.nationalityCountryId),
      countryCode: alpha2(ds, d?.nationalityCountryId),
      firstSeason: career.firstSeason,
      lastSeason: career.lastSeason,
      races: career.races,
      podiums: career.podiums,
    });
  }
  return list.sort(
    (a, b) => b.lastSeason - a.lastSeason || a.name.localeCompare(b.name),
  );
}

export async function getAllConstructors(): Promise<ConstructorListItem[]> {
  const ds = await dataset();
  const list: ConstructorListItem[] = [];
  for (const [constructorId, career] of ds.constructorCareer) {
    const c = ds.constructors.get(constructorId);
    list.push({
      constructorId,
      name: c?.name ?? constructorId,
      nationality: demonym(ds, c?.countryId),
      countryCode: alpha2(ds, c?.countryId),
      firstSeason: career.firstSeason,
      lastSeason: career.lastSeason,
      races: career.races,
      podiums: career.podiums,
    });
  }
  return list.sort(
    (a, b) => b.lastSeason - a.lastSeason || a.name.localeCompare(b.name),
  );
}

// id/name/fullName for every constructor that has raced — fullName ("Scuderia
// Ferrari") resolves to the right Wikipedia article far more reliably than the
// short name. Used by the team-image lookup (logos/car photos).
export async function getConstructorDirectory(): Promise<
  { id: string; name: string; fullName: string }[]
> {
  const ds = await dataset();
  const out: { id: string; name: string; fullName: string }[] = [];
  for (const id of ds.constructorCareer.keys()) {
    const c = ds.constructors.get(id);
    out.push({ id, name: c?.name ?? id, fullName: c?.fullName || c?.name || id });
  }
  return out;
}

// Head-to-head: two drivers' career profiles plus their race-by-race record in
// events both contested (lower finishing order = ahead; DNFs still ranked by
// the classification order).
export async function getDriverComparison(
  idA: string,
  idB: string,
): Promise<DriverComparison | null> {
  const [a, b] = await Promise.all([
    getDriverProfile(idA),
    getDriverProfile(idB),
  ]);
  if (!a || !b) return null;

  const ds = await dataset();
  const sharedSeasons = new Set<number>();
  let racesTogether = 0;
  let aheadA = 0;
  let aheadB = 0;

  for (const [raceKey, rows] of ds.resultsByRace) {
    const ra = rows.find((r) => r.driverId === idA);
    const rb = rows.find((r) => r.driverId === idB);
    if (!ra || !rb) continue;
    racesTogether += 1;
    sharedSeasons.add(Number(raceKey.split(":")[0]));
    if (ra.positionDisplayOrder < rb.positionDisplayOrder) aheadA += 1;
    else if (rb.positionDisplayOrder < ra.positionDisplayOrder) aheadB += 1;
  }

  const headToHead: HeadToHead = {
    sharedSeasons: [...sharedSeasons].sort((x, y) => x - y),
    racesTogether,
    aheadA,
    aheadB,
  };
  return { a, b, headToHead };
}

// Two drivers compared within a single season: each driver's season totals
// (championship position, points, wins, podiums, poles, fastest laps, best
// finish) plus their head-to-head record across that season's races.
export async function getSeasonComparison(
  idA: string,
  idB: string,
  season: number,
): Promise<SeasonComparison | null> {
  const ds = await dataset();
  const dA = ds.drivers.get(idA);
  const dB = ds.drivers.get(idB);
  if (!dA || !dB) return null;

  const inSeason = (raceKey: string) =>
    Number(raceKey.split(":")[0]) === season;

  const statsFor = (driverId: string): SeasonDriverStats => {
    const d = ds.drivers.get(driverId);
    const standing = ds.driverStandings.find(
      (s) => s.year === season && s.driverId === driverId,
    );
    const constructorId = ds.teamByYearDriver.get(`${season}:${driverId}`) ?? "";

    let wins = 0;
    let podiums = 0;
    let races = 0;
    let bestFinish: number | null = null;
    for (const [key, rows] of ds.resultsByRace) {
      if (!inSeason(key)) continue;
      const r = rows.find((x) => x.driverId === driverId);
      if (!r) continue;
      races += 1;
      if (r.positionNumber === 1) wins += 1;
      if (r.positionNumber !== null && r.positionNumber <= 3) podiums += 1;
      if (r.positionNumber !== null) {
        bestFinish =
          bestFinish === null ? r.positionNumber : Math.min(bestFinish, r.positionNumber);
      }
    }

    let poles = 0;
    for (const [key, quali] of ds.qualifyingByRace) {
      if (!inSeason(key)) continue;
      if (quali.some((q) => q.driverId === driverId && q.position === 1)) poles += 1;
    }

    let fastestLaps = 0;
    for (const [key, h] of ds.fastestLapByRace) {
      if (!inSeason(key)) continue;
      if (h.driverId === driverId) fastestLaps += 1;
    }

    return {
      driverId,
      givenName: d?.firstName ?? "",
      familyName: d?.lastName ?? driverId,
      nationality: demonym(ds, d?.nationalityCountryId),
      countryCode: alpha2(ds, d?.nationalityCountryId),
      constructorId,
      constructorName: ds.constructors.get(constructorId)?.name ?? "",
      raced: races > 0 || standing != null,
      championshipPosition: standing?.positionNumber ?? null,
      points: standing?.points ?? 0,
      wins,
      podiums,
      poles,
      fastestLaps,
      bestFinish,
      races,
    };
  };

  let racesTogether = 0;
  let aheadA = 0;
  let aheadB = 0;
  for (const [key, rows] of ds.resultsByRace) {
    if (!inSeason(key)) continue;
    const ra = rows.find((r) => r.driverId === idA);
    const rb = rows.find((r) => r.driverId === idB);
    if (!ra || !rb) continue;
    racesTogether += 1;
    if (ra.positionDisplayOrder < rb.positionDisplayOrder) aheadA += 1;
    else if (rb.positionDisplayOrder < ra.positionDisplayOrder) aheadB += 1;
  }

  return {
    season,
    a: statsFor(idA),
    b: statsFor(idB),
    headToHead: { racesTogether, aheadA, aheadB },
  };
}

// Full race-weekend detail: qualifying, race (with grid → finish delta),
// fastest lap and driver of the day. Returns null for an unknown race.
export async function getRaceWeekend(
  season: string,
  round: string,
): Promise<RaceWeekend | null> {
  const ds = await dataset();
  const key = `${season}:${round}`;
  const race = ds.races.find(
    (r) => r.year === Number(season) && r.round === Number(round),
  );
  if (!race) return null;
  const gp = ds.grandsPrix.get(race.grandPrixId);

  const nameOf = (id: string) => driverName(ds, id);
  const teamOf = (id: string) => ds.constructors.get(id)?.name ?? id;
  const codeOf = (id: string) => ds.drivers.get(id)?.abbreviation ?? null;

  const toQualifying = (rows: QualiRow[] | undefined): QualifyingEntry[] =>
    (rows ?? []).map((q) => ({
      position: q.position,
      driverId: q.driverId,
      driverName: nameOf(q.driverId),
      driverCode: codeOf(q.driverId),
      constructorId: q.constructorId,
      constructorName: teamOf(q.constructorId),
      q1: q.q1,
      q2: q.q2,
      q3: q.q3,
    }));
  const qualifying = toQualifying(ds.qualifyingByRace.get(key));
  const sprintQualifying = toQualifying(ds.sprintQualifyingByRace.get(key));

  const practices: PracticeSession[] = [1, 2, 3, 4]
    .map((n) => ({
      number: n,
      results: (ds.practiceByRace.get(`${key}:${n}`) ?? []).map((p) => ({
        positionText: p.position,
        driverId: p.driverId,
        driverName: nameOf(p.driverId),
        driverCode: codeOf(p.driverId),
        constructorId: p.constructorId,
        constructorName: teamOf(p.constructorId),
        time: p.time,
        gap: p.gap,
        laps: p.laps,
      })),
    }))
    .filter((p) => p.results.length > 0);

  const grid = ds.gridByRace.get(key);
  const rows = (ds.resultsByRace.get(key) ?? [])
    .slice()
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder);
  const results: WeekendResult[] = rows.map((r) => {
    const gridPosition = grid?.get(r.driverId) ?? null;
    const gained =
      gridPosition != null && r.positionNumber != null
        ? gridPosition - r.positionNumber
        : null;
    return {
      positionText: r.positionText,
      driverId: r.driverId,
      driverName: nameOf(r.driverId),
      driverCode: codeOf(r.driverId),
      nationality: demonym(ds, ds.drivers.get(r.driverId)?.nationalityCountryId),
      countryCode: alpha2(ds, ds.drivers.get(r.driverId)?.nationalityCountryId),
      constructorId: r.constructorId,
      constructorName: teamOf(r.constructorId),
      timeDisplay: formatResultTime(r),
      laps: r.laps ?? null,
      points: r.points ?? 0,
      gridPosition,
      positionsGained: gained,
    };
  });

  // Sprint race (sprint weekends only). f1db already carries grid + gained.
  const sprintResults: WeekendResult[] = (ds.sprintResultsByRace.get(key) ?? [])
    .slice()
    .sort((a, b) => a.positionDisplayOrder - b.positionDisplayOrder)
    .map((r) => ({
      positionText: r.positionText,
      driverId: r.driverId,
      driverName: nameOf(r.driverId),
      driverCode: codeOf(r.driverId),
      nationality: demonym(ds, ds.drivers.get(r.driverId)?.nationalityCountryId),
      countryCode: alpha2(ds, ds.drivers.get(r.driverId)?.nationalityCountryId),
      constructorId: r.constructorId,
      constructorName: teamOf(r.constructorId),
      timeDisplay: formatResultTime(r),
      laps: r.laps ?? null,
      points: r.points ?? 0,
      gridPosition: r.gridPositionNumber ?? null,
      positionsGained: r.positionsGained ?? null,
    }));

  const toHighlight = (h: HighlightRow | undefined): WeekendHighlight | null =>
    h
      ? {
          driverId: h.driverId,
          driverName: nameOf(h.driverId),
          constructorId: h.constructorId,
          constructorName: teamOf(h.constructorId),
          detail: h.detail,
        }
      : null;

  return {
    season,
    round: Number(round),
    grandPrixName: gp?.name ?? race.grandPrixId,
    officialName: race.officialName,
    date: race.date,
    countryCode: alpha2(ds, gp?.countryId),
    circuitId: race.circuitId,
    circuitName: ds.circuits.get(race.circuitId)?.fullName ?? race.circuitId,
    qualifying,
    results,
    sprintResults,
    sprintQualifying,
    practices,
    sessions: raceSessions(race),
    fastestLap: toHighlight(ds.fastestLapByRace.get(key)),
    driverOfTheDay: toHighlight(ds.driverOfDayByRace.get(key)),
  };
}

// ---------- Circuits ----------

// The newest season present in the race table (the current calendar).
function latestSeason(ds: Dataset): number {
  return ds.races.reduce((m, r) => Math.max(m, r.year), 0);
}

function circuitSummary(ds: Dataset, c: RawCircuit): CircuitSummary {
  const held = ds.races.filter((r) => r.circuitId === c.id);
  const years = held.map((r) => r.year);
  const current = latestSeason(ds);
  return {
    circuitId: c.id,
    name: c.fullName ?? c.name,
    placeName: c.placeName,
    countryCode: alpha2(ds, c.countryId),
    nationality: demonym(ds, c.countryId),
    type: c.type ?? "RACE",
    racesHeld: c.totalRacesHeld ?? held.length,
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    onCurrentCalendar: held.some((r) => r.year === current),
  };
}

export async function getCircuits(): Promise<CircuitSummary[]> {
  const ds = await dataset();
  return [...ds.circuits.values()]
    .map((c) => circuitSummary(ds, c))
    .sort(
      (a, b) =>
        Number(b.onCurrentCalendar) - Number(a.onCurrentCalendar) ||
        (b.lastYear ?? 0) - (a.lastYear ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

function tally(counts: Map<string, number>, nameOf: (id: string) => string, n = 5): CircuitTally[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0])))
    .slice(0, n)
    .map(([id, count]) => ({ id, name: nameOf(id), count }));
}

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export async function getCircuitProfile(circuitId: string): Promise<CircuitProfile | null> {
  const ds = await dataset();
  const c = ds.circuits.get(circuitId);
  if (!c) return null;

  const driverName = (id: string) => {
    const d = ds.drivers.get(id);
    return d ? `${d.firstName} ${d.lastName}` : id;
  };
  const teamName = (id: string) => ds.constructors.get(id)?.name ?? id;
  const gpName = (id: string) => ds.grandsPrix.get(id)?.name ?? id;

  const held = ds.races
    .filter((r) => r.circuitId === circuitId)
    .sort((a, b) => a.year - b.year || a.round - b.round);
  const done = held.filter((r) => ds.winnerByRace.has(`${r.year}:${r.round}`));

  // Layouts in the order they were used.
  const layoutMap = new Map<string, { firstYear: number; lastYear: number; races: number }>();
  for (const r of held) {
    if (!r.circuitLayoutId) continue;
    const l = layoutMap.get(r.circuitLayoutId);
    if (l) {
      l.lastYear = r.year;
      l.races += 1;
    } else {
      layoutMap.set(r.circuitLayoutId, { firstYear: r.year, lastYear: r.year, races: 1 });
    }
  }
  const layouts = [...layoutMap.entries()].map(([layoutId, l]) => {
    const raw = ds.circuitLayouts.get(layoutId);
    return { layoutId, length: raw?.length ?? null, turns: raw?.turns ?? null, ...l };
  });
  const currentLayoutId = held.length ? held[held.length - 1].circuitLayoutId : null;

  // Race lap record: the fastest race lap set on the current layout.
  let lapRecord: CircuitProfile["lapRecord"] = null;
  let bestMs = Infinity;
  for (const r of done) {
    if (currentLayoutId && r.circuitLayoutId !== currentLayoutId) continue;
    const f = ds.fastestLapByRace.get(`${r.year}:${r.round}`);
    if (!f?.timeMillis || !f.time || f.timeMillis >= bestMs) continue;
    bestMs = f.timeMillis;
    lapRecord = {
      time: f.time,
      year: r.year,
      driverId: f.driverId,
      driverName: driverName(f.driverId),
      constructorId: f.constructorId,
      constructorName: teamName(f.constructorId),
    };
  }

  const driverWins = new Map<string, number>();
  const teamWins = new Map<string, number>();
  const poles = new Map<string, number>();
  const races: CircuitRace[] = [];
  for (const r of done) {
    const key = `${r.year}:${r.round}`;
    const w = ds.winnerByRace.get(key);
    const pole = ds.qualifyingByRace.get(key)?.find((q) => q.position === 1);
    if (w) {
      bump(driverWins, w.driverId);
      bump(teamWins, w.constructorId);
    }
    if (pole) bump(poles, pole.driverId);
    races.push({
      year: r.year,
      round: r.round,
      grandPrixName: gpName(r.grandPrixId),
      winnerDriverId: w?.driverId ?? null,
      winnerName: w ? driverName(w.driverId) : null,
      winnerConstructorId: w?.constructorId ?? null,
      winnerConstructorName: w ? teamName(w.constructorId) : null,
      poleDriverName: pole ? driverName(pole.driverId) : null,
    });
  }
  races.reverse();

  const upcoming = held.find((r) => !ds.winnerByRace.has(`${r.year}:${r.round}`));
  const current = layouts.find((l) => l.layoutId === currentLayoutId);

  return {
    ...circuitSummary(ds, c),
    shortName: c.name,
    previousNames: c.previousNames ?? null,
    direction: c.direction ?? null,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    length: current?.length ?? c.length ?? null,
    turns: current?.turns ?? c.turns ?? null,
    grandsPrix: [...new Set(held.map((r) => gpName(r.grandPrixId)))],
    layouts,
    lapRecord,
    topDrivers: tally(driverWins, driverName),
    topConstructors: tally(teamWins, teamName),
    topPoles: tally(poles, driverName),
    races,
    nextRace: upcoming
      ? {
          season: upcoming.year,
          round: upcoming.round,
          date: upcoming.date,
          grandPrixName: gpName(upcoming.grandPrixId),
        }
      : null,
  };
}

// Race-day and sprint-day dates for one round (for matching OpenF1 sessions).
export async function getRaceDates(
  season: string,
  round: string
): Promise<{ date: string; sprintDate: string | null } | null> {
  const ds = await dataset();
  const r = ds.races.find((x) => x.year === Number(season) && x.round === Number(round));
  if (!r) return null;
  // Without a stored sprint date, a sprint that ran was on the Saturday.
  let sprintDate = r.sprintRaceDate;
  if (!sprintDate && ds.sprintResultsByRace.has(`${r.year}:${r.round}`)) {
    sprintDate = new Date(Date.parse(`${r.date}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  return { date: r.date, sprintDate };
}
