import { describe, expect, it, vi } from "vitest";

vi.mock("./f1db", () => ({ getRaceWeekend: async () => null, getSeasonDrivers: async () => [] }));
vi.mock("./live", () => ({ LIVE_MARGIN_MS: 0, endOf: () => 0, getReplay: async () => null, getYearSessions: async () => [] }));
vi.mock("./openf1", () => ({ rawDrivers: async () => [] }));

import { classify } from "./provisional";

const who = (num: number) => ({
  driverId: `d${num}`, driverName: `Driver ${num}`, driverCode: `D${num}`, nationality: "", countryCode: null,
  constructorId: "t", constructorName: "Team",
});
const row = (driver_number: number, position: number | null, extra: object = {}) => ({
  driver_number, position, number_of_laps: 71, points: 0, duration: null, gap_to_leader: null, ...extra,
});

describe("classify", () => {
  it("orders the classified cars, then retirements by laps, then non-starters, as f1db writes them", () => {
    const rows = classify(
      [
        row(77, null, { dns: true, number_of_laps: 0 }),
        row(3, 2, { gap_to_leader: 14.602, points: 18 }),
        row(18, null, { dnf: true, number_of_laps: 30 }),
        row(1, 1, { duration: 5723.504, points: 25 }),
        row(44, 9, { gap_to_leader: "+1 LAP" }),
        row(30, 7, { gap_to_leader: 75.402 }),
      ],
      who,
      new Map([[1, 1], [3, 21], [44, 18], [18, 15]]),
    );
    expect(rows.map((r) => [r.positionText, r.driverCode, r.timeDisplay])).toEqual([
      ["1", "D1", "1:35:23.504"],
      ["2", "D3", "+14.602"],
      ["7", "D30", "+1:15.402"],
      ["9", "D44", "+1 lap"],
      ["DNF", "D18", "Retired"],
      ["DNS", "D77", "DNS"],
    ]);
    expect(rows[1]).toMatchObject({ gridPosition: 21, positionsGained: 19, points: 18 });
    expect(rows[4]).toMatchObject({ gridPosition: 15, positionsGained: null, laps: 30 });
  });
});
