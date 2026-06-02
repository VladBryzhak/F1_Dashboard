import { cached } from "../cache/cache";
import type {
  ConstructorStanding,
  DriverStanding,
  StandingsResponse,
} from "../types/f1";

const BASE = "https://api.jolpi.ca/ergast/f1";

// Raw Ergast/Jolpica shapes (only the fields we use).
interface RawDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
}
interface RawConstructor {
  constructorId: string;
  name: string;
  nationality: string;
}
interface RawDriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: RawDriver;
  Constructors: RawConstructor[];
}
interface RawConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: RawConstructor;
}
interface RawStandingsList {
  season: string;
  round: string;
  DriverStandings?: RawDriverStanding[];
  ConstructorStandings?: RawConstructorStanding[];
}
interface RawErgast {
  MRData: {
    StandingsTable: { StandingsLists: RawStandingsList[] };
  };
}

const REQUEST_TIMEOUT_MS = 6_000;

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        `Jolpica ${path} timed out after ${REQUEST_TIMEOUT_MS}ms (the API may be down)`
      );
    }
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Jolpica ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getDriverStandings(
  season: string
): Promise<StandingsResponse<DriverStanding>> {
  return cached(`driverStandings:${season}`, 60 * 60, async () => {
    const data = await getJson<RawErgast>(`/${season}/driverStandings.json`);
    const list = data.MRData.StandingsTable.StandingsLists[0];
    if (!list) return { season, round: "0", standings: [] };
    const standings: DriverStanding[] = (list.DriverStandings ?? []).map((s) => {
      const c = s.Constructors[s.Constructors.length - 1];
      return {
        position: Number(s.position),
        points: Number(s.points),
        wins: Number(s.wins),
        driverId: s.Driver.driverId,
        givenName: s.Driver.givenName,
        familyName: s.Driver.familyName,
        nationality: s.Driver.nationality,
        permanentNumber: s.Driver.permanentNumber ?? null,
        code: s.Driver.code ?? null,
        constructorId: c?.constructorId ?? "",
        constructorName: c?.name ?? "",
      };
    });
    return { season: list.season, round: list.round, standings };
  });
}

export async function getConstructorStandings(
  season: string
): Promise<StandingsResponse<ConstructorStanding>> {
  return cached(`constructorStandings:${season}`, 60 * 60, async () => {
    const data = await getJson<RawErgast>(
      `/${season}/constructorStandings.json`
    );
    const list = data.MRData.StandingsTable.StandingsLists[0];
    if (!list) return { season, round: "0", standings: [] };
    const standings: ConstructorStanding[] = (list.ConstructorStandings ?? []).map(
      (s) => ({
        position: Number(s.position),
        points: Number(s.points),
        wins: Number(s.wins),
        constructorId: s.Constructor.constructorId,
        name: s.Constructor.name,
        nationality: s.Constructor.nationality,
      })
    );
    return { season: list.season, round: list.round, standings };
  });
}
