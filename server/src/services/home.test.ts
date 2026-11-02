import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeHighlights, SessionHero } from "../types/f1";

// f1db has the United States GP (round 18); Mexico (round 19) is the next race.
const state = vi.hoisted(() => ({ session: null as SessionHero | null }));
const highlights = (): HomeHighlights => ({
  season: 2026,
  seasonOver: false,
  latestRace: {
    season: 2026,
    round: 18,
    grandPrixName: "United States",
    date: "2026-10-25",
    countryCode: "us",
    podium: [
      {
        position: 1,
        driverId: "kimi-antonelli",
        driverName: "Kimi Antonelli",
        driverCode: "ANT",
        number: "12",
        constructorId: "mercedes",
        constructorName: "Mercedes",
        countryCode: "it",
        time: "1:35:16.650",
        points: 25,
      },
    ],
  },
  notableRetirement: null,
  championshipLeader: null,
  champion: null,
  nextRace: { season: 2026, round: 19, grandPrixName: "Mexico", date: "2026-11-01", countryCode: "mx", circuitId: "mexico-city", placeName: "Mexico City", outline: null },
});

vi.mock("./f1db", () => ({
  getHomeHighlights: async () => highlights(),
  getDriverStandings: async () => ({ standings: [] }),
  getRaceAfter: async () => ({ season: 2026, round: 20, grandPrixName: "Brazil", date: "2026-11-08", countryCode: "br", circuitId: "interlagos", placeName: "São Paulo", outline: null }),
}));
vi.mock("./news", () => ({ getNews: async () => [] }));
vi.mock("./articles", () => ({ homeArticle: async () => null }));
vi.mock("./sessionHero", () => ({ sessionHeroWithin: async () => state.session }));

import { homePayload } from "./home";

const hero = (kind: SessionHero["kind"], round: number, sprint = false): SessionHero => ({
  kind,
  sessionName: kind === "practice" ? "Practice 3" : kind === "qualifying" ? "Qualifying" : sprint ? "Sprint" : "Race",
  sprint,
  segment: null,
  season: 2026,
  round,
  grandPrixName: "Mexico",
  top: [1, 2, 3].map((position) => ({
    position,
    driverId: position === 1 ? "lando-norris" : null,
    driverName: "Lando Norris",
    driverCode: "NOR",
    number: "1",
    constructorId: position === 1 ? "mclaren" : null,
    constructorName: "McLaren",
    time: null,
    laps: null,
    headshot: null,
  })),
});

beforeEach(() => {
  state.session = null;
});

describe("homePayload: the hero follows the weekend", () => {
  it("shows a practice's top three, with P1's photo as the hero image", async () => {
    state.session = hero("practice", 19);
    const home = await homePayload();
    expect(home.session?.kind).toBe("practice");
    expect(home.heroImage).toContain("/2026/mclaren/lannor01/");
    expect(home.highlights.nextRace?.round).toBe(19);
  });

  it("shows a race f1db hasn't published, and moves the next race on", async () => {
    state.session = hero("race", 19);
    const home = await homePayload();
    expect(home.session?.round).toBe(19);
    expect(home.highlights.nextRace?.grandPrixName).toBe("Brazil");
  });

  it("goes back to f1db's race once it has it", async () => {
    state.session = hero("race", 18);
    const home = await homePayload();
    expect(home.session).toBeNull();
    expect(home.heroImage).toContain("/2026/mercedes/andant01/");
  });

  it("keeps the race weekend's next race after a sprint", async () => {
    state.session = hero("race", 19, true);
    const home = await homePayload();
    expect(home.session?.sprint).toBe(true);
    expect(home.highlights.nextRace?.round).toBe(19);
  });
});
