import AdmZip from "adm-zip";
import type {
  ConstructorStanding,
  DriverStanding,
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
  positionNumber: number | null;
  driverId: string;
  constructorId: string;
}

interface WinCounts {
  drivers: Map<string, number>;
  constructors: Map<string, number>;
}

interface Dataset {
  version: string;
  driverStandings: RawSeasonDriverStanding[];
  constructorStandings: RawSeasonConstructorStanding[];
  drivers: Map<string, RawDriver>;
  constructors: Map<string, RawConstructor>;
  countries: Map<string, RawCountry>;
  // `${year}:${driverId}` -> constructorId the driver raced most rounds for
  teamByYearDriver: Map<string, string>;
  winsByYear: Map<number, WinCounts>;
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

  // Win counts per season from race results (P1 finishes).
  const winsByYear = new Map<number, WinCounts>();
  for (const r of read<RawRaceResult>("f1db-races-race-results.json")) {
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
  }

  return {
    version,
    driverStandings,
    constructorStandings,
    drivers,
    constructors,
    countries,
    teamByYearDriver,
    winsByYear,
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
      };
    });
  return { season, round: "final", standings };
}
