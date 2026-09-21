import AdmZip from "adm-zip";
import type {
  CalendarRace,
  CalendarResponse,
  ConstructorProfile,
  ConstructorSeasonEntry,
  ConstructorStanding,
  DriverProfile,
  DriverSeasonEntry,
  DriverStanding,
  HomeHighlights,
  NotableRetirement,
  PodiumEntry,
  ProgressionSeries,
  RaceResult,
  RaceResultResponse,
  SeasonProgression,
  StandingsResponse,
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
  // `${year}:${driverId}` -> constructorId the driver raced most rounds for
  teamByYearDriver: Map<string, string>;
  winsByYear: Map<number, WinCounts>;
  // `${year}:${round}` -> winner (P1 finisher)
  winnerByRace: Map<string, RaceWinner>;
  // `${year}:${round}` -> full classification (all finishers/retirements)
  resultsByRace: Map<string, RawRaceResult[]>;
  // career totals for profile pages, keyed by driverId / constructorId
  driverCareer: Map<string, CareerAgg>;
  constructorCareer: Map<string, CareerAgg>;
  // per-round cumulative driver standings (for the title-race chart)
  racesDriverStandings: RawRaceDriverStanding[];
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
    teamByYearDriver,
    winsByYear,
    winnerByRace,
    resultsByRace,
    driverCareer,
    constructorCareer,
    racesDriverStandings,
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
