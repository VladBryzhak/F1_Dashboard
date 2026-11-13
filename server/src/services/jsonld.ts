import { getArticle } from "./articles";
import { getCircuitProfile, getConstructorProfile, getDriverProfile, getRaceWeekend } from "./f1db";
import { gpTitle, type Lang } from "./gpNames";
import type { Article, CircuitProfile, ConstructorProfile, DriverProfile, RaceWeekend } from "../types/f1";
import { driverName } from "./ukNames";

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
  // the page's preview card in Google's three article shapes
  const cards = (path: string) => {
    const png = siteUrl + (uk ? "/og/uk" : "/og") + `${path}.png`;
    return [png, `${png}?r=4x3`, `${png}?r=1x1`];
  };
  // a section's list page (and its season version): Home › Section [› season]
  const listPage = (name: Crumb["name"], path: string, season?: string) =>
    [crumbs([home, { name, path }, ...(season ? [{ name: season, path: `${path}/${season}` }] : [])])];
  const L = (en: string, ukName: string) => (uk ? ukName : en);

  let parts: string[];
  try {
    parts = pagePath.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  const [section, a, b] = parts;

  switch (section) {
    case undefined:
      return siteLd(siteUrl, uk);

    case "standings":
      return listPage(L("Standings", "Залік"), "/standings", isSeason(a) ? a : undefined);

    case "records":
      return listPage(L("Formula 1 records", "Рекорди Формули-1"), "/records");

    case "compare":
      return listPage(L("Compare", "Порівняння"), "/compare");

    case "seasons":
      return isSeason(a) ? [crumbs([home, { name: uk ? `Сезон ${a}` : `${a} season`, path: `/seasons/${a}` }])] : null;

    case "drivers": {
      if (!a || isSeason(a)) return listPage(L("Drivers", "Пілоти"), "/drivers", a);
      const p = await getDriverProfile(a).catch(() => null);
      if (!p) return null;
      const path = `/drivers/${p.driverId}`;
      return [
        driverLd(p, url(path), uk),
        crumbs([home, { name: uk ? "Пілоти" : "Drivers", path: "/drivers" }, { name: driverName(p.driverId, p.givenName, p.familyName, uk), path }]),
      ];
    }

    case "teams": {
      if (!a || isSeason(a)) return listPage(L("Teams", "Команди"), "/teams", a);
      const p = await getConstructorProfile(a).catch(() => null);
      if (!p) return null;
      const path = `/teams/${p.constructorId}`;
      return [teamLd(p, url(path)), crumbs([home, { name: uk ? "Команди" : "Teams", path: "/teams" }, { name: p.name, path }])];
    }

    case "calendar": {
      if (!a || (isSeason(a) && !b)) return listPage(L("Calendar", "Календар"), "/calendar", a);
      if (!isSeason(a) || !b || !/^\d+$/.test(b)) return null;
      const w = await getRaceWeekend(a!, b).catch(() => null);
      if (!w) return null;
      const path = `/calendar/${w.season}/${w.round}`;
      return [
        raceLd(w, url(path), cards(path), lang, (id) => url(`/teams/${id}`)),
        crumbs([
          home,
          { name: uk ? "Календар" : "Calendar", path: "/calendar" },
          { name: `${gpTitle(w.grandPrixName, lang)} ${w.season}`, path },
        ]),
      ];
    }

    case "circuits": {
      if (!a) return listPage(L("Circuits", "Траси"), "/circuits");
      const c = await getCircuitProfile(a).catch(() => null);
      if (!c) return null;
      const path = `/circuits/${c.circuitId}`;
      return [circuitLd(c), crumbs([home, { name: uk ? "Траси" : "Circuits", path: "/circuits" }, { name: c.name, path }])];
    }

    case "articles": {
      if (!a) return listPage(L("Articles", "Статті"), "/articles");
      const art = await getArticle(a, lang).catch(() => null);
      if (!art) return null;
      const path = `/articles/${art.slug}`;
      return [
        articleLd(art, url(path), cards(path), siteUrl, url("/about")),
        crumbs([home, { name: uk ? "Статті" : "Articles", path: "/articles" }, { name: art.title, path }]),
      ];
    }

    default:
      return null;
  }
}

// An article's day as a full date-time, which Google's article checks ask for:
// the start of that day in Kyiv, with its offset (+02:00, or +03:00 in summer).
export function articleTime(date: string): string {
  const at = new Date(`${date}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")
    ?.value.replace("GMT", "");
  return `${date}T00:00:00${off || "+00:00"}`;
}

// An article of ours as a schema.org NewsArticle (client/src/lib/jsonld.ts
// articleLd builds the same).
function articleLd(a: Article, pageUrl: string, images: string[], siteUrl: string, aboutUrl: string): object {
  const org = { "@type": "Organization", name: "Paddock Times", url: siteUrl };
  return {
    "@context": CTX,
    "@type": "NewsArticle",
    headline: a.title,
    description: a.description,
    datePublished: articleTime(a.date),
    dateModified: articleTime(a.date),
    image: images,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    author: { ...org, url: aboutUrl },
    publisher: { ...org, logo: { "@type": "ImageObject", url: `${siteUrl}/apple-touch-icon.png` } },
  };
}

// Site-wide identity, on the home page.
export const TELEGRAM_CHANNEL_URL = "https://t.me/paddocktimes";
const SITE_DESCRIPTION = {
  en: "Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and telemetry.",
  uk: "Турнірна таблиця, календар і результати Формули-1, статистика пілотів і команд, порівняння й телеметрія.",
};

function siteLd(siteUrl: string, uk = false): object[] {
  const description = uk ? SITE_DESCRIPTION.uk : SITE_DESCRIPTION.en;
  return [
    {
      "@context": CTX,
      "@type": "Organization",
      name: "Paddock Times",
      alternateName: "Paddock Times F1",
      url: siteUrl,
      logo: `${siteUrl}/apple-touch-icon.png`,
      description,
      sameAs: [TELEGRAM_CHANNEL_URL],
    },
    {
      "@context": CTX,
      "@type": "WebSite",
      name: "Paddock Times",
      alternateName: "Paddock Times F1",
      url: siteUrl,
      inLanguage: ["en", "uk"],
      description,
    },
  ];
}

// On a Ukrainian page the name is the Ukrainian spelling, the Latin one its alternateName.
function driverLd(p: DriverProfile, pageUrl: string, uk = false): object {
  const latin = `${p.givenName} ${p.familyName}`;
  const name = driverName(p.driverId, p.givenName, p.familyName, uk);
  return {
    "@context": CTX,
    "@type": "Person",
    name,
    ...(name !== latin && { alternateName: latin }),
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

// The weekend from its first session to about two hours after the race start
// (dates alone when f1db has no times). Google's event guidelines want the
// address, start and end, a description and an image.
export function eventSpan(w: Pick<RaceWeekend, "date" | "sessions">): { start: string; end: string } {
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const sessions = w.sessions ?? [];
  const known = sessions.filter((s) => s.timeKnown).map((s) => Date.parse(s.start)).filter((t) => !Number.isNaN(t));
  const race = sessions.find((s) => s.kind === "RACE" && s.timeKnown);
  const first = sessions.map((s) => s.start.slice(0, 10)).sort()[0];
  return {
    start: known.length ? iso(Math.min(...known)) : first ?? w.date,
    end: race ? iso(Date.parse(race.start) + 2 * 3600_000) : w.date,
  };
}

export function eventDescription(w: Pick<RaceWeekend, "round" | "season" | "sessions">, uk: boolean): string {
  const sprint = (w.sessions ?? []).some((s) => s.kind === "SPRINT");
  return uk
    ? `${w.round}-й етап чемпіонату світу Формули-1 ${w.season} року: практики, ${sprint ? "спринт, " : ""}кваліфікація й гонка.`
    : `Round ${w.round} of the ${w.season} FIA Formula One World Championship: practice, ${sprint ? "the sprint, " : ""}qualifying and the race.`;
}

function raceLd(w: RaceWeekend, pageUrl: string, images: string[], lang: Lang, teamUrl: (id: string) => string): object {
  const uk = lang === "uk";
  const { start, end } = eventSpan(w);
  return {
    "@context": CTX,
    "@type": "SportsEvent",
    name: uk ? `${gpTitle(w.grandPrixName, "uk")} ${w.season}` : `${w.grandPrixName} Grand Prix ${w.season}`,
    description: eventDescription(w, uk),
    sport: "Formula One",
    startDate: start,
    endDate: end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: w.circuitName,
      address: {
        "@type": "PostalAddress",
        ...(w.placeName && { addressLocality: w.placeName }),
        ...(w.countryCode && { addressCountry: w.countryCode.toUpperCase() }),
      },
    },
    image: images,
    organizer: { "@type": "Organization", name: "Formula 1", url: "https://www.formula1.com" },
    ...(w.teams?.length && { performer: w.teams.map((t) => ({ "@type": "SportsTeam", name: t.name, url: teamUrl(t.id) })) }),
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
