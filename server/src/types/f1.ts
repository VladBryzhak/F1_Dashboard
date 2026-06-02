// Normalized F1 domain types returned by our backend to the client.
// These intentionally flatten the verbose Jolpica/Ergast response shapes.

export interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driverId: string;
  givenName: string;
  familyName: string;
  nationality: string;
  permanentNumber: string | null;
  code: string | null;
  constructorId: string;
  constructorName: string;
}

export interface ConstructorStanding {
  position: number;
  points: number;
  wins: number;
  constructorId: string;
  name: string;
  nationality: string;
}

export interface StandingsResponse<T> {
  season: string;
  round: string;
  standings: T[];
}

export interface CalendarRace {
  round: number;
  grandPrixId: string;
  name: string;
  officialName: string;
  date: string; // ISO yyyy-mm-dd
  circuitName: string;
  placeName: string;
  nationality: string; // GP country demonym (for flag lookup)
  winnerDriverId: string | null;
  winnerName: string | null;
  winnerConstructorId: string | null;
  winnerConstructorName: string | null;
}

export interface CalendarResponse {
  season: string;
  races: CalendarRace[];
}
