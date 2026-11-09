import { describe, expect, it, vi } from "vitest";

vi.mock("./f1db", () => ({}));
vi.mock("./articles", () => ({ TAG_LABEL: {} }));
vi.mock("./racePreview", () => ({}));
vi.mock("./provisional", () => ({}));

import { driverFacts as serverFacts } from "./snapshot";
import { driverFacts as clientFacts } from "../../../client/src/lib/summaries";
import { CURRENT_SEASON } from "../../../client/src/lib/seasons";
import type { DriverProfile } from "../types/f1";

const s = (season: number, constructorName: string, position: number) => ({ season, constructorId: "x", constructorName, position, points: 0, wins: 0 });
const hamilton = {
  firstSeason: 2007, lastSeason: CURRENT_SEASON, championships: 7, wins: 106, podiums: 209, poles: 104, races: 400, bestResult: 1, bestChampionship: 1,
  seasons: [s(2007, "McLaren", 2), s(2008, "McLaren", 1), s(2014, "Mercedes", 1), s(2015, "Mercedes", 1), s(2017, "Mercedes", 1), s(2018, "Mercedes", 1), s(2019, "Mercedes", 1), s(2020, "Mercedes", 1), s(CURRENT_SEASON, "Ferrari", 4)],
} as unknown as DriverProfile;
const whiteaway = {
  firstSeason: 1955, lastSeason: 1955, championships: 0, wins: 0, podiums: 0, poles: 0, races: 1, bestResult: null, bestChampionship: null,
  seasons: [s(1955, "HWM", 0)],
} as unknown as DriverProfile;

describe("driver quick facts", () => {
  it("answers the searched questions", () => {
    expect(serverFacts(hamilton, "Льюїс Хемілтон", true, CURRENT_SEASON)).toEqual([
      { q: "Скільки перемог має Льюїс Хемілтон?", a: "106 перемог у Гран-прі; стартів у кар'єрі: 400." },
      { q: "Скільки титулів чемпіона світу має Льюїс Хемілтон?", a: "7: 2008, 2014, 2015, 2017, 2018, 2019, 2020." },
      { q: "Скільки сезонів у Формулі-1 має Льюїс Хемілтон?", a: `9, з 2007 року. Команди: McLaren, Mercedes і Ferrari.` },
      { q: "Скільки поулів і подіумів має Льюїс Хемілтон?", a: "Поул-позицій: 104, подіумів: 209." },
    ]);
    expect(serverFacts(whiteaway, "Ted Whiteaway", false, CURRENT_SEASON).map((f) => f.a)).toEqual([
      "No Grand Prix wins from 1 race start.",
      "None.",
      "1 season, in 1955, with HWM.",
    ]);
  });

  it("says the same on the page as in the crawler text", () => {
    for (const p of [hamilton, whiteaway]) {
      for (const uk of [true, false]) {
        expect(clientFacts(p, "Name", uk ? "uk" : "en")).toEqual(serverFacts(p, "Name", uk, CURRENT_SEASON));
      }
    }
  });
});
