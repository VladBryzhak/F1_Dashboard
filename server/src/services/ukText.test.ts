import { describe, expect, it } from "vitest";
import { intParam } from "../routes/params";
import { completeSeasonsOf } from "./f1db";
import { UK, ukCountry, ukPlural } from "./ukText";

describe("ukPlural", () => {
  it("picks the Ukrainian form for the number", () => {
    expect(ukPlural(1, UK.wins)).toBe("1 перемога в Гран-прі");
    expect(ukPlural(3, UK.wins)).toBe("3 перемоги в Гран-прі");
    expect(ukPlural(5, UK.wins)).toBe("5 перемог у Гран-прі");
    expect(ukPlural(11, UK.races)).toBe("11 гонок");
    expect(ukPlural(21, UK.races)).toBe("21 гонка");
    expect(ukPlural(22, UK.races)).toBe("22 гонки");
    expect(ukPlural(0, UK.titles)).toBe("0 титулів чемпіона світу");
  });

  it("writes fractions with a comma and the 'other' form", () => {
    expect(ukPlural(1.5, UK.points)).toBe("1,5 очка");
  });
});

describe("ukCountry", () => {
  it("names a country in Ukrainian from its code", () => {
    expect(ukCountry("nl")).toBe("Нідерланди");
    expect(ukCountry(null)).toBe("");
  });
});

describe("intParam", () => {
  it("accepts whole numbers in range only", () => {
    expect(intParam("2024", 2023, 2027)).toBe(2024);
    expect(intParam("2022", 2023, 2027)).toBeNull();
    expect(intParam("12abc", 1, 99)).toBeNull();
    expect(intParam("-1", 0, 99)).toBeNull();
    expect(intParam(undefined, 0, 99)).toBeNull();
    expect(intParam("99999999", 0, 999_999_999)).toBeNull(); // over 7 digits
  });
});

describe("completeSeasonsOf (titles count only finished seasons)", () => {
  it("leaves out a season with a round still to run", () => {
    const races = [
      { year: 2025, round: 1 },
      { year: 2025, round: 2 },
      { year: 2026, round: 1 },
      { year: 2026, round: 2 },
    ];
    const winners = new Set(["2025:1", "2025:2", "2026:1"]);
    expect([...completeSeasonsOf(races, (k) => winners.has(k))]).toEqual([2025]);
  });
});
