import { describe, expect, it } from "vitest";
import { longestRuns } from "./f1db";

describe("runs of wins", () => {
  it("keeps each driver's longest run, across seasons, and a run still going", () => {
    const races = [
      { year: 2012, winners: ["vettel"] },
      { year: 2013, winners: ["vettel"] },
      { year: 2013, winners: ["vettel"] },
      { year: 2013, winners: ["alonso"] },
      { year: 2013, winners: ["vettel"] },
      { year: 2013, winners: ["vettel"] },
      { year: 2014, winners: ["hamilton"] },
      { year: 2014, winners: ["hamilton"] },
    ];
    const runs = longestRuns(races);
    expect(runs.get("vettel")).toEqual({ value: 3, from: 2012, to: 2013 });
    expect(runs.get("hamilton")).toEqual({ value: 2, from: 2014, to: 2014 });
    expect(runs.has("alonso")).toBe(false); // a single win is no run
  });

  it("counts a shared drive for both drivers", () => {
    const runs = longestRuns([
      { year: 1951, winners: ["fagioli", "fangio"] },
      { year: 1951, winners: ["fangio"] },
    ]);
    expect(runs.get("fangio")?.value).toBe(2);
    expect(runs.has("fagioli")).toBe(false);
  });
});
