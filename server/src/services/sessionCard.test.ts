import { describe, expect, it, vi } from "vitest";

vi.mock("./og", () => ({ teamColor: () => "#ff8000" }));
vi.mock("./provisional", () => ({ getRaceWeekendNow: async () => null }));

import { cardData, cardSvg } from "./sessionCard";
import type { RaceWeekend } from "../types/f1";

const res = (pos: string, id: string, name: string, time: string, grid: number | null, gained: number | null) => ({
  positionText: pos, driverId: id, driverName: name, driverCode: null, nationality: "", countryCode: null,
  constructorId: "mclaren", constructorName: "McLaren", timeDisplay: time, laps: 71, points: 0, gridPosition: grid, positionsGained: gained,
});
const wk = {
  season: "2026", round: 20, grandPrixName: "São Paulo",
  results: [
    res("1", "lando-norris", "Lando Norris", "1:35:23.504", 1, 0),
    res("2", "max-verstappen", "Max Verstappen", "+14.602", 21, 19),
    res("3", "isack-hadjar", "Isack Hadjar", "+24.485", 5, 2),
    res("9", "lewis-hamilton", "Lewis Hamilton", "+1 lap", 20, 11),
    res("10", "ted-whiteaway", "Ted Whiteaway", "+2 laps", 4, -6),
  ],
  sprintResults: [],
  qualifying: [
    { position: 1, driverId: "lando-norris", driverName: "Lando Norris", driverCode: null, constructorId: "mclaren", constructorName: "McLaren", q1: "1:30.939", q2: "1:29.207", q3: "1:27.470" },
    { position: 2, driverId: "george-russell", driverName: "George Russell", driverCode: null, constructorId: "mercedes", constructorName: "Mercedes", q1: "1:31.206", q2: "1:26.745", q3: "1:27.674" },
    { position: 3, driverId: "kimi-antonelli", driverName: "Kimi Antonelli", driverCode: null, constructorId: "mercedes", constructorName: "Mercedes", q1: "1:32.229", q2: "1:29.302", q3: null },
  ],
  sprintQualifying: [],
  practices: [],
} as unknown as RaceWeekend;

describe("session card", () => {
  it("tells a race in Ukrainian: laps, the biggest climb", () => {
    const d = cardData(wk, "Race")!;
    expect(d).toMatchObject({ kicker: "ГОНКА", title: "ГРАН-ПРІ САН-ПАУЛУ 2026", note: "Найбільший прогрес: Ферстаппен, з 21-го на 2-ге" });
    expect(d.rows.map((r) => r.right)).toEqual(["1:35:23.504", "+14.602", "+24.485", "+1 коло", "+2 кола"]);
  });

  it("gives qualifying each driver's best part and the pole lap", () => {
    const d = cardData(wk, "Qualifying")!;
    expect(d.note).toBe("Поул: Норріс, 1:27.470");
    expect(d.rows.map((r) => r.right)).toEqual(["1:27.470", "1:27.674", "1:29.302"]);
  });

  it("has no card for a session without a result", () => {
    expect(cardData(wk, "Practice 1")).toBeNull();
    expect(cardData(wk, "Sprint")).toBeNull();
  });

  it("draws the podium with surnames, Latin for a driver the map doesn't know", () => {
    const svg = cardSvg(cardData(wk, "Race")!, {});
    expect(svg).toContain(">НОРРІС<");
    expect(svg).toContain(">ФЕРСТАППЕН<");
    expect(svg).toContain(">WHITEAWAY<");
    expect(svg).not.toContain("<image");
  });
});
