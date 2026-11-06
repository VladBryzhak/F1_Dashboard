import { cached } from "../cache/cache";
import { getCalendar, getCircuitProfile, getSeasonDrivers, type SeasonDriver } from "./f1db";
import type { CircuitRace, PreviewPastRace, PreviewWeatherDay, PreviewWins, RacePreview } from "../types/f1";

// The preview of a race that hasn't run yet (its page before the result):
// the weekend schedule, a weather forecast for the circuit, the last races
// there and who has won there. Built from f1db; the forecast comes from
// Open-Meteo (free, no key, CC BY 4.0: the page credits it).

const HISTORY = 6; // past races listed
const TOP = 4; // all-time winners listed
const FORECAST_DAYS = 16; // how far ahead Open-Meteo forecasts, today included
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// The weekend's days at the circuit (the race day and the two before it),
// cut to the ones a forecast made `today` reaches. Null when none is.
export function forecastWindow(raceDate: string, today: string): { start: string; end: string } | null {
  const race = Date.parse(raceDate);
  const first = race - 2 * DAY_MS;
  const now = Date.parse(today);
  const last = now + (FORECAST_DAYS - 1) * DAY_MS;
  if (race < now || first > last) return null;
  return { start: isoDay(Math.max(first, now)), end: isoDay(Math.min(race, last)) };
}

// Races at the circuit before this one, newest first.
export function racesBefore(races: CircuitRace[], season: number, round: number): CircuitRace[] {
  return races.filter((r) => r.year < season || (r.year === season && r.round < round));
}

// Wins here by driver, most first (ties by name), optionally only `among` them.
export function winsHere(races: CircuitRace[], among?: Map<string, SeasonDriver>): PreviewWins[] {
  const wins = new Map<string, PreviewWins>();
  for (const r of races) {
    if (!r.winnerDriverId || !r.winnerName) continue;
    if (among && !among.has(r.winnerDriverId)) continue;
    const w = wins.get(r.winnerDriverId) ?? { id: r.winnerDriverId, name: r.winnerName, count: 0 };
    w.count++;
    wins.set(r.winnerDriverId, w);
  }
  return [...wins.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

interface MeteoDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_probability_max: (number | null)[];
  weather_code: (number | null)[];
}

async function forecast(lat: number, lon: number, start: string, end: string): Promise<PreviewWeatherDay[] | null> {
  return cached(
    `preview:wx:${lat},${lon}:${start}:${end}`,
    (v: PreviewWeatherDay[] | null) => (v ? 3600 : 600),
    async () => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
          `&timezone=auto&start_date=${start}&end_date=${end}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "PaddockTimes/1.0 (https://paddocktimes.com)" },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return null;
        const d = ((await res.json()) as { daily?: MeteoDaily }).daily;
        if (!d?.time?.length) return null;
        const days: PreviewWeatherDay[] = [];
        d.time.forEach((date, i) => {
          const tMax = d.temperature_2m_max[i];
          const tMin = d.temperature_2m_min[i];
          if (tMax == null || tMin == null) return;
          days.push({
            date,
            tMax: Math.round(tMax),
            tMin: Math.round(tMin),
            rain: d.precipitation_probability_max[i] ?? 0,
            code: d.weather_code[i] ?? 0,
          });
        });
        return days.length ? days : null;
      } catch {
        return null; // no forecast is fine: the preview shows without it
      }
    },
  );
}

/** The preview of an upcoming race, or null when it has a result (or doesn't exist). */
export async function getRacePreview(
  season: string,
  round: string,
  today = isoDay(Date.now()),
): Promise<RacePreview | null> {
  const cal = await getCalendar(season);
  const race = cal.races.find((r) => r.round === Number(round));
  if (!race || race.winnerDriverId) return null;
  const circuit = await getCircuitProfile(race.circuitId);
  if (!circuit) return null;

  const before = racesBefore(circuit.races, Number(season), race.round);
  const grid = new Map((await getSeasonDrivers(Number(season))).map((d) => [d.driverId, d]));
  const history: PreviewPastRace[] = before
    .filter((r) => r.winnerDriverId && r.winnerName && r.winnerConstructorId && r.winnerConstructorName)
    .slice(0, HISTORY)
    .map((r) => ({
      year: r.year,
      round: r.round,
      winnerId: r.winnerDriverId!,
      winnerName: r.winnerName!,
      winnerConstructorId: r.winnerConstructorId!,
      winnerConstructorName: r.winnerConstructorName!,
      poleName: r.poleDriverName,
    }));

  const window = forecastWindow(race.date, today);
  const weather =
    window && circuit.latitude != null && circuit.longitude != null
      ? await forecast(circuit.latitude, circuit.longitude, window.start, window.end)
      : null;

  return {
    season,
    round: race.round,
    race,
    circuit: {
      id: circuit.circuitId,
      name: circuit.name,
      length: circuit.length,
      turns: circuit.turns,
      racesHeld: before.length,
      lapRecord: circuit.lapRecord,
    },
    weather,
    history,
    topWinners: winsHere(before).slice(0, TOP),
    gridWinners: winsHere(before, grid),
  };
}
