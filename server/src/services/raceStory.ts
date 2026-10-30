import { cached } from "../cache/cache";
import type { RaceStory, StoryDriver, StoryEvent } from "../types/f1";
import { getChampionshipAround, getRaceWeekend } from "./f1db";
import { getRaceControl, getReplay } from "./live";
import { isOpenF1Unavailable, optional } from "./openf1Client";
import { getRaceStrategy } from "./strategy";

// The facts of how a race unfolded, for the race page's story text and key-
// moments timeline. Everything comes from data we already serve: results,
// grid and retirements from f1db; lap-by-lap order, tyre stints, weather and
// race-control messages (safety cars, penalties) from OpenF1 for 2023 on.
// The client turns these facts into sentences in the visitor's language.

const NUMERIC = /^\d+$/;

// "… - CAUSING A COLLISION (20:15:06)" -> "CAUSING A COLLISION"
const cleanReason = (s: string) => s.replace(/\s*\(\d{1,2}:\d{2}(:\d{2})?\)\s*$/, "").trim();

export async function getRaceStory(season: string, round: string): Promise<RaceStory | null> {
  const wk = await getRaceWeekend(season, round);
  if (!wk || !wk.results.length) return null;

  // A story built while OpenF1 was busy lacks its lap-by-lap part: keep it
  // a minute, so the next visitor gets the full one.
  let partial = false;
  return cached(`story:${season}:${round}`, () => (partial ? 60 : 6 * 3600), async () => {
    const results = wk.results;
    const byCode = new Map(results.filter((r) => r.driverCode).map((r) => [r.driverCode!, r]));
    const who = (r: { driverName: string; driverCode: string | null; constructorId: string }): StoryDriver => ({
      name: r.driverName,
      code: r.driverCode,
      constructorId: r.constructorId,
    });
    const finishers = results.filter((r) => NUMERIC.test(r.positionText));
    const winnerRow = results.find((r) => r.positionText === "1") ?? null;
    const p2 = results.find((r) => r.positionText === "2") ?? null;
    const p3 = results.find((r) => r.positionText === "3") ?? null;

    const story: RaceStory = {
      totalLaps: winnerRow?.laps ?? null,
      hasTiming: false,
      winner: winnerRow
        ? { ...who(winnerRow), team: winnerRow.constructorName, grid: winnerRow.gridPosition }
        : null,
      second: p2 ? who(p2) : null,
      third: p3 ? { ...who(p3), grid: p3.gridPosition } : null,
      margin: p2 && p2.timeDisplay.startsWith("+") ? p2.timeDisplay : null,
      lapsLed: [],
      leadChanges: 0,
      startMovers: [],
      neutralisations: [],
      stops: { winner: null, common: null },
      climbers: finishers
        .filter((r) => r.gridPosition != null && r.gridPosition > 0 && (r.positionsGained ?? 0) >= 4)
        .sort((a, b) => (b.positionsGained ?? 0) - (a.positionsGained ?? 0))
        .slice(0, 2)
        .map((r) => ({ ...who(r), grid: r.gridPosition!, finish: Number(r.positionText) })),
      retirements: results
        .filter((r) => r.positionText === "DNF")
        .map((r) => ({
          ...who(r),
          reason: r.timeDisplay,
          lap: r.laps != null ? r.laps + 1 : null,
        })),
      penalties: [],
      fastest: null,
      rain: false,
      championship: null,
      events: [],
    };

    if (wk.fastestLap) {
      const m = /^([\d:.]+)(?:\s*\(lap (\d+)\))?/.exec(wk.fastestLap.detail);
      const row = results.find((r) => r.driverId === wk.fastestLap!.driverId);
      story.fastest = {
        name: wk.fastestLap.driverName,
        code: row?.driverCode ?? null,
        constructorId: wk.fastestLap.constructorId,
        time: m?.[1] ?? wk.fastestLap.detail,
        lap: m?.[2] ? Number(m[2]) : null,
      };
    }

    const champ = await getChampionshipAround(Number(season), Number(round));
    if (champ) {
      const [lead, second] = champ.after;
      const leaderBefore = [...champ.before.entries()].find(([, p]) => p === 1)?.[0] ?? null;
      const winnerAfter = winnerRow ? champ.after.find((s) => s.driverId === winnerRow.driverId) : undefined;
      story.championship = {
        leader: { name: lead.name, code: lead.code, points: lead.points },
        second: second ? { name: second.name, code: second.code, points: second.points } : null,
        winnerPos: winnerAfter?.position ?? null,
        winnerPosBefore: winnerRow ? champ.before.get(winnerRow.driverId) ?? null : null,
        leaderChanged: leaderBefore != null && leaderBefore !== lead.driverId,
      };
    }

    // Lap-by-lap timing (OpenF1, 2023+). Best effort: without it the story
    // keeps the f1db facts.
    try {
      const strat = await getRaceStrategy(season, round, "race");
      if (strat) {
        story.hasTiming = true;
        story.totalLaps = strat.totalLaps || story.totalLaps;
        const total = strat.totalLaps;
        const drv = (code: string): StoryDriver => {
          const r = byCode.get(code);
          return r ? who(r) : { name: code, code };
        };

        // Leader after each lap: laps led and lead changes.
        const led = new Map<string, number>();
        let prevLeader: string | null = strat.drivers.find((d) => d.grid === 1)?.code ?? null;
        for (let lap = 1; lap <= total; lap++) {
          const leader = strat.drivers.find((d) => d.positions[lap] === 1)?.code;
          if (!leader) continue;
          led.set(leader, (led.get(leader) ?? 0) + 1);
          if (leader !== prevLeader) {
            if (lap > 1 || prevLeader != null) {
              story.events.push({ lap, kind: "lead", driver: drv(leader) });
              if (lap > 1) story.leadChanges += 1;
            }
            prevLeader = leader;
          }
        }
        story.lapsLed = [...led.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([code, laps]) => ({ ...drv(code), laps }));

        // The start: biggest gains from the grid to the end of lap 1.
        story.startMovers = strat.drivers
          .filter((d) => d.grid != null && d.positions[1] != null && d.grid - d.positions[1]! >= 3)
          .sort((a, b) => b.grid! - b.positions[1]! - (a.grid! - a.positions[1]!))
          .slice(0, 2)
          .map((d) => ({ ...drv(d.code), from: d.grid!, to: d.positions[1]! }));

        // Pit stops: count per driver; podium finishers' stops go on the timeline.
        const stintsOf = new Map<number, number[]>();
        for (const s of strat.stints) {
          const arr = stintsOf.get(s.num) ?? [];
          arr.push(s.start);
          stintsOf.set(s.num, arr);
        }
        const stopsOf = (num: number) => {
          const starts = [...new Set(stintsOf.get(num) ?? [])].sort((a, b) => a - b);
          return starts.filter((s) => s > 1);
        };
        const counts = new Map<number, number>();
        for (const d of strat.drivers) {
          const r = byCode.get(d.code);
          if (!r || !NUMERIC.test(r.positionText)) continue;
          const n = stopsOf(d.num).length;
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
        story.stops.common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        for (const pos of ["1", "2", "3"]) {
          const r = results.find((x) => x.positionText === pos);
          const d = r && strat.drivers.find((x) => x.code === r.driverCode);
          if (!d) continue;
          const stops = stopsOf(d.num);
          if (pos === "1") story.stops.winner = stops.length;
          stops.forEach((start, i) =>
            story.events.push({ lap: Math.max(1, start - 1), kind: "pit", driver: drv(d.code), stop: i + 1 }),
          );
        }

        // Race control: neutralisations and penalties.
        const rc = await getRaceControl(strat.sessionKey).catch(optional<Awaited<ReturnType<typeof getRaceControl>>>([]));
        let open: { kind: "sc" | "vsc" | "red"; from: number } | null = null;
        const close = (lap: number) => {
          if (open) story.neutralisations.push({ kind: open.kind, from: open.from, to: Math.max(open.from, lap) });
          open = null;
        };
        for (const m of rc) {
          const msg = m.message.toUpperCase();
          const lap = Math.min(m.lap ?? total, total || Infinity);
          if (m.category === "SafetyCar" || msg.includes("SAFETY CAR")) {
            const vsc = msg.includes("VIRTUAL") || /\bVSC\b/.test(msg);
            if (msg.includes("DEPLOYED")) {
              close(lap);
              open = { kind: vsc ? "vsc" : "sc", from: lap };
            } else if (msg.includes("ENDING") || msg.includes("IN THIS LAP")) {
              close(lap);
            }
          } else if (m.flag === "RED") {
            close(lap);
            open = { kind: "red", from: lap };
          } else if (open && (open as { kind: string }).kind === "red" && (m.flag === "GREEN" || msg.includes("RESUME"))) {
            close(lap);
          }

          if (msg.startsWith("FIA STEWARDS") && msg.includes("PENALTY") && !msg.includes("NO FURTHER") && !msg.includes("SERVED") && !msg.includes("UNDER INVESTIGATION") && !msg.includes("WILL BE INVESTIGATED")) {
            const car = /CAR \d+ \((\w+)\)/.exec(msg);
            const reason = cleanReason(msg.split(" - ").slice(1).join(" - "));
            const secs = /(\d+) SECOND TIME PENALTY/.exec(msg);
            const kind: StoryEvent["penalty"] = secs
              ? "time"
              : msg.includes("DRIVE THROUGH")
                ? "drive"
                : msg.includes("STOP/GO") || msg.includes("STOP AND GO")
                  ? "stopgo"
                  : msg.includes("GRID")
                    ? "grid"
                    : "other";
            if (car) {
              const ev: StoryEvent = {
                lap: Math.max(1, lap),
                kind: "penalty",
                driver: drv(car[1]),
                penalty: kind,
                seconds: secs ? Number(secs[1]) : null,
                reason,
              };
              story.penalties.push(ev);
              story.events.push(ev);
            }
          }
        }
        if (open) close(total);
        for (const n of story.neutralisations) {
          story.events.push({ lap: n.from, to: n.to, kind: n.kind });
        }

        const replay = await getReplay(strat.sessionKey).catch(optional(null));
        story.rain = !!replay?.weather.some((w) => w.rain);
      }
    } catch (err) {
      story.hasTiming = false;
      if (isOpenF1Unavailable(err)) partial = true;
    }

    for (const r of story.retirements) {
      if (r.lap != null) story.events.push({ lap: Math.min(r.lap, story.totalLaps ?? r.lap), kind: "dnf", driver: r, reason: r.reason });
    }
    if (story.fastest?.lap) story.events.push({ lap: story.fastest.lap, kind: "fastest", driver: story.fastest });

    story.events.sort((a, b) => a.lap - b.lap);
    return story;
  });
}
