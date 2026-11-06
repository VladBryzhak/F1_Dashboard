import { describe, expect, it } from "vitest";
import { forecastWindow, racesBefore, winsHere } from "./racePreview";
import type { CircuitRace } from "../types/f1";
import type { SeasonDriver } from "./f1db";

const race = (year: number, round: number, winnerDriverId: string, winnerName: string): CircuitRace => ({
  year,
  round,
  grandPrixName: "São Paulo",
  winnerDriverId,
  winnerName,
  winnerConstructorId: "x",
  winnerConstructorName: "X",
  poleDriverName: null,
});

describe("forecastWindow", () => {
  it("covers the race day and the two days before it", () => {
    expect(forecastWindow("2026-11-08", "2026-11-01")).toEqual({ start: "2026-11-06", end: "2026-11-08" });
  });

  it("starts today once the weekend is under way", () => {
    expect(forecastWindow("2026-11-08", "2026-11-07")).toEqual({ start: "2026-11-07", end: "2026-11-08" });
  });

  it("cuts the weekend at the forecast's last day", () => {
    expect(forecastWindow("2026-11-08", "2026-10-22")).toEqual({ start: "2026-11-06", end: "2026-11-06" });
  });

  it("has nothing for a race too far ahead or already past", () => {
    expect(forecastWindow("2026-12-06", "2026-11-06")).toBeNull();
    expect(forecastWindow("2026-11-01", "2026-11-06")).toBeNull();
  });
});

describe("races at the circuit", () => {
  const races = [race(2026, 20, "a", "A"), race(2025, 21, "b", "B"), race(2024, 21, "a", "A"), race(2023, 20, "c", "C")];

  it("keeps only the races before this one", () => {
    expect(racesBefore(races, 2026, 20).map((r) => r.year)).toEqual([2025, 2024, 2023]);
  });

  it("counts wins, most first, optionally among this season's drivers", () => {
    expect(winsHere(races)).toEqual([
      { id: "a", name: "A", count: 2 },
      { id: "b", name: "B", count: 1 },
      { id: "c", name: "C", count: 1 },
    ]);
    const grid = new Map([["c", {} as SeasonDriver]]);
    expect(winsHere(races, grid)).toEqual([{ id: "c", name: "C", count: 1 }]);
  });
});
