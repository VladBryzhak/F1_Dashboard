import { beforeEach, describe, expect, it, vi } from "vitest";

// A small stand-in for the dataset: season 2026 is current, these drivers,
// teams, circuits and races exist.
const f1db = vi.hoisted(() => ({
  ready: true,
  getCurrentSeason: async () => 2026,
  isDatasetReady: () => f1db.ready,
  hasPageSubject: async (kind: string, id: string) =>
    ({ driver: ["max-verstappen"], team: ["mclaren"], circuit: ["monza"] } as Record<string, string[]>)[kind].includes(id),
  hasRace: async (season: string, round: string) => season === "2026" && Number(round) >= 1 && Number(round) <= 24,
}));
vi.mock("./f1db", () => f1db);

import { pageStatus } from "./pageRoutes";

const status = (path: string, checkData = true) => pageStatus(path, checkData);

beforeEach(() => {
  f1db.ready = true;
});

describe("pageStatus", () => {
  it("answers 200 for the pages the app has", async () => {
    for (const p of ["/", "/standings", "/standings/1998", "/calendar/2025", "/drivers", "/drivers/2025",
      "/drivers/max-verstappen", "/teams/mclaren", "/circuits", "/circuits/monza", "/calendar/2026/18",
      "/calendar/2026/018", "/compare", "/telemetry", "/live", "/about", "/privacy", "/support", "/feedback"]) {
      expect(await status(p), p).toEqual({ code: 200 });
    }
  });

  it("answers 404 for addresses that lead nowhere", async () => {
    for (const p of ["/nonexistent", "/about/x", "/calendar/2026/18/x", "/calendar/2026/99", "/calendar/abc/1",
      "/drivers/not-a-driver", "/drivers/1949", "/teams/nope", "/circuits/nope", "/circuits/monza/x", "/%E0%A4%A"]) {
      expect(await status(p), p).toEqual({ code: 404 });
    }
  });

  it("moves the current season and seasons the app doesn't have to the bare section", async () => {
    expect(await status("/standings/2026")).toEqual({ code: 301, location: "/standings" });
    expect(await status("/calendar/2026")).toEqual({ code: 301, location: "/calendar" });
    expect(await status("/drivers/2026")).toEqual({ code: 301, location: "/drivers" });
    expect(await status("/teams/2026")).toEqual({ code: 301, location: "/teams" });
    expect(await status("/standings/1800")).toEqual({ code: 301, location: "/standings" });
    expect(await status("/standings/abc")).toEqual({ code: 301, location: "/standings" });
  });

  it("ignores case in the section, as the app's router does", async () => {
    expect(await status("/STANDINGS")).toEqual({ code: 200 });
  });

  it("on a cold start settles only what the address's shape decides", async () => {
    f1db.ready = false;
    expect(await status("/drivers/not-a-driver", false)).toEqual({ code: 200 });
    expect(await status("/nonexistent", false)).toEqual({ code: 404 });
    expect(await status("/standings/abc", false)).toEqual({ code: 301, location: "/standings" });
  });
});
