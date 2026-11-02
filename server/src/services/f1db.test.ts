import { describe, expect, it } from "vitest";
import { titleDecided } from "./f1db";

// Standings after each round run: [leader, second] points.
const table = (rows: Record<number, [number, number]>) =>
  new Map(
    Object.entries(rows).map(([round, [a, b]]) => [
      Number(round),
      [
        { driverId: "a", points: a, positionDisplayOrder: 1 },
        { driverId: "b", points: b, positionDisplayOrder: 2 },
      ],
    ]),
  );

const season = (n: number, sprints: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({ round: i + 1, sprint: sprints.includes(i + 1) }));

describe("titleDecided (the round the title can no longer change hands)", () => {
  it("is the first round the lead beats the points still to be won", () => {
    // Five rounds; after round 3 two races are left (50 points).
    expect(titleDecided(season(5), table({ 1: [25, 18], 2: [50, 36], 3: [100, 49] }))).toEqual({ round: 3, driverId: "a" });
  });

  it("isn't decided while second place could still draw level", () => {
    expect(titleDecided(season(5), table({ 3: [100, 50] }))).toBeNull();
  });

  it("counts a sprint win among the points left", () => {
    // Round 5 is a sprint weekend: 33 points left after round 4.
    expect(titleDecided(season(5, [5]), table({ 4: [100, 70] }))).toBeNull();
    expect(titleDecided(season(5, [5]), table({ 4: [100, 66] }))).toEqual({ round: 4, driverId: "a" });
  });

  it("ends with the leader after the last round, even on equal points", () => {
    expect(titleDecided(season(2), table({ 1: [25, 18], 2: [43, 43] }))).toEqual({ round: 2, driverId: "a" });
  });
});
