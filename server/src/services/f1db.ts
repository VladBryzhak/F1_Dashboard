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
  RaceResult,
  RaceResultResponse,
  StandingsResponse,
} from "../types/f1";

// f1db ships its data as downloadable release artifacts (no live API to time
// out). We fetch the latest "splitted JSON" zip once, unzip it in memory, and
// join the normalized tables into the flat shapes our client expects.
//
// Data: https://github.com/f1db/f1db (CC-BY 4.0).

const RELEASE_API = "https://api.github.com/repos/f1db/f1db/releases/latest";
const ASSET_NAME = "f1db-json-splitted.zip";

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
}

let datasetPromise: Promise<Dataset> | null = null;

async function fetchLatestZip(): Promise<{ version: string; zip: AdmZip }> {
  const relRes = await fetch(RELEASE_API, {
    headers: { "User-Agent": "f1-dashboard", Accept: "application/json" },
  });
  if (!relRes.ok) throw new Error(`f1db release lookup failed: ${relRes.status}`);
  const rel = (await relRes.json()) as {
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
  };
  const asset = rel.assets.find((a) => a.name === ASSET_NAME);
  if (!asset) throw new Error(`f1db asset ${ASSET_NAME} not found`);
  const zipRes = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": "f1-dashboard" },
  });
  if (!zipRes.ok) throw new Error(`f1db download failed: ${zipRes.status}`);
  const buf = Buffer.from(await zipRes.arrayBuffer());
  return { version: rel.tag_name, zip: new AdmZip(buf) };
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
  };
}

// Single in-flight load; cached for the process lifetime (restart to refresh).
function dataset(): Promise<Dataset> {
  if (!datasetPromise) {
    datasetPromise = loadDataset().catch((err) => {
      datasetPromise = null; // allow retry on next request
      throw err;
    });
  }
  return datasetPromise;
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
