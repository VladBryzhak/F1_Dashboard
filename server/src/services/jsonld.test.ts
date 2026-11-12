import { describe, expect, it, vi } from "vitest";

vi.mock("./f1db", () => ({
  getDriverProfile: async (id: string) =>
    id === "ayrton-senna"
      ? {
          driverId: "ayrton-senna",
          givenName: "Ayrton",
          familyName: "Senna",
          nationality: "Brazilian",
          championships: 3,
          dateOfBirth: "1960-03-21",
          dateOfDeath: "1994-05-01",
          placeOfBirth: "São Paulo",
          birthCountryCode: "br",
        }
      : null,
  getConstructorProfile: async () => null,
  getCircuitProfile: async () => null,
  getRaceWeekend: async (season: string, round: string) =>
    season === "2026" && round === "18"
      ? {
          season: "2026", round: 18, grandPrixName: "United States", date: "2026-10-25", circuitName: "Circuit of the Americas", placeName: "Austin", countryCode: "us",
          sessions: [
            { kind: "FP1", start: "2026-10-23T17:30:00Z", timeKnown: true },
            { kind: "SPRINT", start: "2026-10-24T17:00:00Z", timeKnown: true },
            { kind: "RACE", start: "2026-10-25T19:00:00Z", timeKnown: true },
          ],
        }
      : null,
}));

import { pageJsonLd } from "./jsonld";

const SITE = "https://example.test";

describe("pageJsonLd", () => {
  it("describes a driver as a Person with their facts and a breadcrumb", async () => {
    const ld = (await pageJsonLd(SITE, "/drivers/ayrton-senna", "en")) as Record<string, any>[];
    const [person, crumbs] = ld;
    expect(person["@type"]).toBe("Person");
    expect(person).toMatchObject({
      name: "Ayrton Senna",
      birthDate: "1960-03-21",
      deathDate: "1994-05-01",
      award: "3× Formula One World Champion",
      url: `${SITE}/drivers/ayrton-senna`,
    });
    expect(person.birthPlace.address.addressCountry).toBe("BR");
    expect(crumbs.itemListElement.map((i: any) => i.item)).toEqual([
      `${SITE}/`,
      `${SITE}/drivers`,
      `${SITE}/drivers/ayrton-senna`,
    ]);
  });

  it("names and links the Ukrainian pages in Ukrainian", async () => {
    const ld = (await pageJsonLd(SITE, "/calendar/2026/18", "uk")) as Record<string, any>[];
    expect(ld[0]).toMatchObject({ "@type": "SportsEvent", url: `${SITE}/uk/calendar/2026/18` });
    expect(ld[0].location).toMatchObject({ name: "Circuit of the Americas", address: { addressLocality: "Austin", addressCountry: "US" } });
    // what Google's event guidelines ask for: start and end with times, a description, images
    expect(ld[0]).toMatchObject({
      name: "Гран-прі США 2026",
      startDate: "2026-10-23T17:30:00Z",
      endDate: "2026-10-25T21:00:00Z",
      description: "18-й етап чемпіонату світу Формули-1 2026 року: практики, спринт, кваліфікація й гонка.",
      image: [`${SITE}/og/uk/calendar/2026/18.png`, `${SITE}/og/uk/calendar/2026/18.png?r=4x3`, `${SITE}/og/uk/calendar/2026/18.png?r=1x1`],
    });
    expect(ld[1].itemListElement.map((i: any) => i.name)).toEqual(["Головна", "Календар", "Гран-прі США 2026"]);
    expect(ld[1].itemListElement[0].item).toBe(`${SITE}/uk`);
  });

  it("gives the home page the site's identity, list pages a breadcrumb, and nothing to unknown pages", async () => {
    const home = (await pageJsonLd(SITE, "/", "en")) as Record<string, any>[];
    expect(home.map((x) => x["@type"])).toEqual(["Organization", "WebSite"]);
    expect(home[0].sameAs).toEqual(["https://t.me/paddocktimes"]);
    const st = (await pageJsonLd(SITE, "/standings/2025", "uk")) as Record<string, any>[];
    expect(st[0].itemListElement.map((i: any) => [i.name, i.item])).toEqual([
      ["Головна", `${SITE}/uk`],
      ["Залік", `${SITE}/uk/standings`],
      ["2025", `${SITE}/uk/standings/2025`],
    ]);
    expect(await pageJsonLd(SITE, "/drivers/nobody", "en")).toBeNull();
  });
});
