import { describe, expect, it, vi } from "vitest";

vi.mock("./f1db", () => ({}));
vi.mock("./openf1", () => ({}));

import { formatDuration, formatGap, matchDriver, pickSession, topThree } from "./sessionHero";
import type { RawSession } from "./live";
import type { RawDriver } from "./openf1";
import type { SeasonDriver } from "./f1db";

const session = (session_name: string, start: string, end: string, extra: Partial<RawSession> = {}): RawSession => ({
  session_key: Date.parse(start),
  meeting_key: 1,
  session_name,
  location: "Mexico City",
  country_name: "Mexico",
  year: 2026,
  date_start: start,
  date_end: end,
  ...extra,
});

const WEEKEND = [
  session("Day 1", "2026-02-11T08:00:00Z", "2026-02-11T17:00:00Z"),
  session("Practice 3", "2026-10-31T17:30:00Z", "2026-10-31T18:30:00Z"),
  session("Qualifying", "2026-10-31T21:00:00Z", "2026-10-31T22:00:00Z"),
  session("Race", "2026-11-01T20:00:00Z", "2026-11-01T22:00:00Z"),
];

describe("pickSession", () => {
  it("takes the latest session whose results are open (30 min after its end)", () => {
    expect(pickSession(WEEKEND, Date.parse("2026-10-31T19:05:00Z"))?.session_name).toBe("Practice 3");
    // Qualifying ended, but OpenF1 opens it only at 22:30.
    expect(pickSession(WEEKEND, Date.parse("2026-10-31T22:20:00Z"))?.session_name).toBe("Practice 3");
    expect(pickSession(WEEKEND, Date.parse("2026-10-31T22:31:00Z"))?.session_name).toBe("Qualifying");
    expect(pickSession(WEEKEND, Date.parse("2026-11-02T09:00:00Z"))?.session_name).toBe("Race");
  });

  it("skips testing and cancelled sessions", () => {
    expect(pickSession(WEEKEND, Date.parse("2026-03-01T00:00:00Z"))).toBeNull();
    const cancelled = [WEEKEND[1], { ...WEEKEND[2], is_cancelled: true }];
    expect(pickSession(cancelled, Date.parse("2026-11-01T00:00:00Z"))?.session_name).toBe("Practice 3");
  });
});

describe("formatting", () => {
  it("writes lap and race times as the timing screens do", () => {
    expect(formatDuration(77.6)).toBe("1:17.600");
    expect(formatDuration(76.514)).toBe("1:16.514");
    expect(formatDuration(5716.65)).toBe("1:35:16.650");
    expect(formatDuration(2388.162)).toBe("39:48.162");
  });

  it("writes gaps with a plus, and lapped cars as f1db does", () => {
    expect(formatGap(0.117)).toBe("+0.117");
    expect(formatGap("+1 LAP")).toBe("+1 lap");
    expect(formatGap("+2 LAPS")).toBe("+2 laps");
  });
});

const SEASON: SeasonDriver[] = [
  { driverId: "lewis-hamilton", firstName: "Lewis", lastName: "Hamilton", abbreviation: "HAM", constructorId: "ferrari", constructorName: "Ferrari" },
  { driverId: "george-russell", firstName: "George", lastName: "Russell", abbreviation: "RUS", constructorId: "mercedes", constructorName: "Mercedes" },
  { driverId: "nico-hulkenberg", firstName: "Nico", lastName: "Hülkenberg", abbreviation: "HUL", constructorId: "audi", constructorName: "Audi" },
];

const driver = (driver_number: number, full_name: string, name_acronym: string, team_name: string): RawDriver => ({
  driver_number,
  full_name,
  name_acronym,
  team_name,
  team_colour: null,
  headshot_url: `https://example.test/${name_acronym}.png`,
});

describe("matchDriver", () => {
  it("finds the f1db driver by code, then by surname without accents", () => {
    expect(matchDriver(driver(44, "Lewis HAMILTON", "HAM", "Ferrari"), SEASON)?.driverId).toBe("lewis-hamilton");
    expect(matchDriver(driver(27, "Nico HULKENBERG", "HLK", "Audi"), SEASON)?.driverId).toBe("nico-hulkenberg");
    expect(matchDriver(driver(97, "Robert SHWARTZMAN", "SHW", "Ferrari"), SEASON)).toBeNull();
  });
});

describe("topThree", () => {
  const drivers = [
    driver(44, "Lewis HAMILTON", "HAM", "Ferrari"),
    driver(63, "George RUSSELL", "RUS", "Mercedes"),
    driver(97, "Robert SHWARTZMAN", "SHW", "Ferrari"),
  ];

  it("takes qualifying times from the last part run", () => {
    const rows = topThree(
      [
        { position: 2, driver_number: 63, number_of_laps: 22, duration: [77.659, 77.027, 76.523], gap_to_leader: [0.318, 0.299, 0.009] },
        { position: 1, driver_number: 44, number_of_laps: 20, duration: [77.341, 76.953, 76.514], gap_to_leader: [0, 0.225, 0] },
        { position: 3, driver_number: 97, number_of_laps: 24, duration: [77.5, 76.9, 76.633], gap_to_leader: [0.1, 0.2, 0.119] },
        { position: 4, driver_number: 1, number_of_laps: 24, duration: [77.6, 77.0, 76.7], gap_to_leader: [0.2, 0.3, 0.2] },
      ],
      drivers,
      SEASON,
    );
    expect(rows.map((r) => [r.position, r.driverId, r.time])).toEqual([
      [1, "lewis-hamilton", "1:16.514"],
      [2, "george-russell", "+0.009"],
      [3, null, "+0.119"],
    ]);
    // A driver f1db doesn't list keeps OpenF1's name, team and headshot.
    expect(rows[2]).toMatchObject({ driverName: "Robert Shwartzman", constructorName: "Ferrari", headshot: "https://example.test/SHW.png" });
  });

  it("leaves out unclassified cars and writes lapped gaps", () => {
    const rows = topThree(
      [
        { position: null, driver_number: 97, number_of_laps: 30, duration: null, gap_to_leader: null },
        { position: 1, driver_number: 44, number_of_laps: 71, duration: 5716.65, gap_to_leader: 0 },
        { position: 2, driver_number: 63, number_of_laps: 71, duration: 5729.728, gap_to_leader: 13.078 },
        { position: 3, driver_number: 1, number_of_laps: 70, duration: null, gap_to_leader: "+1 LAP" },
      ],
      drivers,
      SEASON,
    );
    expect(rows.map((r) => r.time)).toEqual(["1:35:16.650", "+13.078", "+1 lap"]);
    expect(rows[2]).toMatchObject({ driverId: null, driverName: "#1", number: "1" });
  });
});
