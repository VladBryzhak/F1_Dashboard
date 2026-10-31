import { getCircuitProfile, getConstructorProfile, getDriverProfile, getRaceWeekend } from "./f1db";
import { gpTitle, type Lang } from "./gpNames";
import type { CircuitProfile, ConstructorProfile, DriverProfile, RaceWeekend } from "../types/f1";

// schema.org JSON-LD for a page, written into the HTML by pageHtml, so search
// engines (and the ones that don't run JavaScript at all) see the page as an
// entity: a driver as a Person, a team as a SportsTeam, a race as a
// SportsEvent, a circuit as a place, plus the breadcrumb trail. The app sets
// the same through useSeo as people move between pages: keep this in step
// with client/src/lib/jsonld.ts.

const isSeason = (s: string | undefined) => !!s && /^\d{4}$/.test(s);
const CTX = "https://schema.org";

type Crumb = { name: string; path: string };

export async function pageJsonLd(siteUrl: string, pagePath: string, lang: Lang): Promise<object[] | null> {
  const uk = lang === "uk";
  const url = (path: string) => siteUrl + (uk ? (path === "/" ? "/uk" : `/uk${path}`) : path);
  const crumbs = (trail: Crumb[]) => ({
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: url(c.path) })),
  });
  const home: Crumb = { name: uk ? "Головна" : "Home", path: "/" };

  let parts: string[];
  try {
    parts = pagePath.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  const [section, a, b] = parts;

  switch (section) {
    case undefined:
      return siteLd(siteUrl);

    case "drivers": {
      if (!a || isSeason(a)) return null;
      const p = await getDriverProfile(a).catch(() => null);
      if (!p) return null;
      const path = `/drivers/${p.driverId}`;
      return [
        driverLd(p, url(path)),
        crumbs([home, { name: uk ? "Пілоти" : "Drivers", path: "/drivers" }, { name: `${p.givenName} ${p.familyName}`, path }]),
      ];
    }

    case "teams": {
      if (!a || isSeason(a)) return null;
      const p = await getConstructorProfile(a).catch(() => null);
      if (!p) return null;
      const path = `/teams/${p.constructorId}`;
      return [teamLd(p, url(path)), crumbs([home, { name: uk ? "Команди" : "Teams", path: "/teams" }, { name: p.name, path }])];
    }

    case "calendar": {
      if (!isSeason(a) || !b || !/^\d+$/.test(b)) return null;
      const w = await getRaceWeekend(a!, b).catch(() => null);
      if (!w) return null;
      const path = `/calendar/${w.season}/${w.round}`;
      return [
        raceLd(w, url(path)),
        crumbs([
          home,
          { name: uk ? "Календар" : "Calendar", path: "/calendar" },
          { name: `${gpTitle(w.grandPrixName, lang)} ${w.season}`, path },
        ]),
      ];
    }

    case "circuits": {
      if (!a) return null;
      const c = await getCircuitProfile(a).catch(() => null);
      if (!c) return null;
      const path = `/circuits/${c.circuitId}`;
      return [circuitLd(c), crumbs([home, { name: uk ? "Траси" : "Circuits", path: "/circuits" }, { name: c.name, path }])];
    }

    default:
      return null;
  }
}

// Site-wide identity, on the home page.
function siteLd(siteUrl: string): object[] {
  return [
    { "@context": CTX, "@type": "Organization", name: "Paddock Times", url: siteUrl, logo: `${siteUrl}/apple-touch-icon.png` },
    {
      "@context": CTX,
      "@type": "WebSite",
      name: "Paddock Times",
      url: siteUrl,
      description:
        "Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and telemetry.",
    },
  ];
}

function driverLd(p: DriverProfile, pageUrl: string): object {
  return {
    "@context": CTX,
    "@type": "Person",
    name: `${p.givenName} ${p.familyName}`,
    givenName: p.givenName,
    familyName: p.familyName,
    jobTitle: "Formula One Driver",
    nationality: p.nationality,
    ...(p.dateOfBirth && { birthDate: p.dateOfBirth }),
    ...(p.dateOfDeath && { deathDate: p.dateOfDeath }),
    ...(p.placeOfBirth && {
      birthPlace: {
        "@type": "Place",
        name: p.placeOfBirth,
        ...(p.birthCountryCode && { address: { "@type": "PostalAddress", addressCountry: p.birthCountryCode.toUpperCase() } }),
      },
    }),
    ...(p.championships > 0 && { award: `${p.championships}× Formula One World Champion` }),
    url: pageUrl,
  };
}

function teamLd(p: ConstructorProfile, pageUrl: string): object {
  return {
    "@context": CTX,
    "@type": "SportsTeam",
    name: p.name,
    sport: "Formula One",
    ...(p.championships > 0 && { award: `${p.championships}× Formula One Constructors' Champion` }),
    url: pageUrl,
  };
}

function raceLd(w: RaceWeekend, pageUrl: string): object {
  return {
    "@context": CTX,
    "@type": "SportsEvent",
    name: `${w.grandPrixName} Grand Prix ${w.season}`,
    sport: "Formula One",
    startDate: w.date,
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: w.circuitName,
      ...(w.countryCode && { address: { "@type": "PostalAddress", addressCountry: w.countryCode.toUpperCase() } }),
    },
    url: pageUrl,
  };
}

function circuitLd(c: CircuitProfile): object {
  return {
    "@context": CTX,
    "@type": "SportsActivityLocation",
    name: c.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: c.placeName,
      ...(c.countryCode && { addressCountry: c.countryCode.toUpperCase() }),
    },
    ...(c.latitude != null && c.longitude != null && {
      geo: { "@type": "GeoCoordinates", latitude: c.latitude, longitude: c.longitude },
    }),
  };
}
