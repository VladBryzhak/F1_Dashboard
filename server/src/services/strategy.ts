import { cached } from "../cache/cache";
import type { RaceStrategy, StrategyDriver } from "../types/f1";
import { getRaceDates } from "./f1db";
import { getReplay, getReplaySessions } from "./live";

const DAY = 86_400_000;

// Lap chart and tyre strategy for a past race or sprint, built from the same
// OpenF1 data as the replay. OpenF1 only covers 2023 onwards.
export async function getRaceStrategy(
  season: string,
  round: string,
  kind: "race" | "sprint"
): Promise<RaceStrategy | null> {
  const dates = await getRaceDates(season, round);
  const day = kind === "sprint" ? dates?.sprintDate : dates?.date;
  if (!day || Number(season) < 2023) return null;

  return cached(`strategy:${season}:${round}:${kind}`, 6 * 3600, async () => {
    // Match the f1db round to an OpenF1 session by date. f1db stores the
    // local race day, OpenF1 a UTC start, so allow a day either side.
    const target = Date.parse(`${day}T12:00:00Z`);
    const wanted = kind === "sprint" ? "Sprint" : "Race";
    const candidates = (await getReplaySessions()).filter(
      (r) => r.year === Number(season) && r.sessionName === wanted
    );
    let best: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      const diff = Math.abs(Date.parse(c.date) - target);
      if (diff <= 1.5 * DAY && (!best || diff < Math.abs(Date.parse(best.date) - target))) {
        best = c;
      }
    }
    if (!best) throw new Error("No OpenF1 session found for this race");

    const replay = await getReplay(best.sessionKey);

    // Position after lap k = order in which cars crossed the line to end it.
    // A lap ends when the next one starts; the final lap ends at start + duration.
    const byDriver = new Map<number, Map<number, { t: number; d: number | null }>>();
    for (const l of replay.laps) {
      let m = byDriver.get(l.num);
      if (!m) byDriver.set(l.num, (m = new Map()));
      m.set(l.lap, { t: l.t, d: l.d });
    }
    const crossings = new Map<number, Map<number, number>>(); // num -> lap -> end time
    let totalLaps = 0;
    for (const [num, laps] of byDriver) {
      const ends = new Map<number, number>();
      for (const [lap, { t, d }] of laps) {
        const next = laps.get(lap + 1);
        const end = next ? next.t : d != null ? t + d * 1000 : null;
        if (end != null) {
          ends.set(lap, end);
          totalLaps = Math.max(totalLaps, lap);
        }
      }
      crossings.set(num, ends);
    }

    const positions = new Map<number, (number | null)[]>();
    for (const d of replay.drivers) positions.set(d.num, new Array(totalLaps + 1).fill(null));
    for (let lap = 1; lap <= totalLaps; lap++) {
      const order = [...crossings.entries()]
        .filter(([, ends]) => ends.has(lap))
        .sort((a, b) => a[1].get(lap)! - b[1].get(lap)!);
      order.forEach(([num], i) => {
        const arr = positions.get(num);
        if (arr) arr[lap] = i + 1;
      });
    }

    // Grid = each car's first reported position.
    const grid = new Map<number, number>();
    for (const p of [...replay.pos].sort((a, b) => a.t - b.t)) {
      if (!grid.has(p.num)) grid.set(p.num, p.p);
    }

    // The chequered flag falls when the leader completes the final lap; a car
    // whose last crossing came before that stopped early (retired), while a
    // lapped car still crosses the line after it.
    let chequer = Infinity;
    for (const ends of crossings.values()) {
      const t = ends.get(totalLaps);
      if (t != null) chequer = Math.min(chequer, t);
    }

    const lastLapOf = new Map<number, number>();
    const drivers: StrategyDriver[] = replay.drivers.map((d) => {
      const pos = positions.get(d.num) ?? [];
      pos[0] = grid.get(d.num) ?? null;
      let lastLap = 0;
      for (let i = pos.length - 1; i > 0; i--) {
        if (pos[i] != null) {
          lastLap = i;
          break;
        }
      }
      lastLapOf.set(d.num, lastLap);
      return {
        num: d.num,
        code: d.code,
        name: d.name,
        colour: d.colour,
        grid: pos[0],
        positions: pos,
        finish: lastLap ? pos[lastLap] : null,
        retired: (crossings.get(d.num)?.get(lastLap) ?? 0) < chequer,
      };
    });

    // Classified order: more laps first, then position on the last lap.
    drivers.sort(
      (a, b) =>
        (lastLapOf.get(b.num) ?? 0) - (lastLapOf.get(a.num) ?? 0) ||
        (a.finish ?? 99) - (b.finish ?? 99)
    );

    return {
      sessionKey: best.sessionKey,
      kind,
      totalLaps,
      drivers,
      stints: replay.stints.map((s) => ({
        num: s.num,
        compound: s.compound,
        start: s.start,
        end: Math.min(s.end, totalLaps || s.end),
      })),
    };
  });
}
