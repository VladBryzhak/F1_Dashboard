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
      ? { season: "2026", round: 18, grandPrixName: "United States", date: "2026-10-25", circuitName: "Circuit of the Americas", countryCode: "us" }
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
    expect(ld[0].location).toMatchObject({ name: "Circuit of the Americas", address: { addressCountry: "US" } });
    expect(ld[1].itemListElement.map((i: any) => i.name)).toEqual(["Головна", "Календар", "Гран-прі США 2026"]);
    expect(ld[1].itemListElement[0].item).toBe(`${SITE}/uk`);
  });

  it("gives the home page the site's identity and nothing to pages without an entity", async () => {
    const home = (await pageJsonLd(SITE, "/", "en")) as Record<string, any>[];
    expect(home.map((x) => x["@type"])).toEqual(["Organization", "WebSite"]);
    expect(await pageJsonLd(SITE, "/standings", "en")).toBeNull();
    expect(await pageJsonLd(SITE, "/drivers/nobody", "en")).toBeNull();
  });
});
