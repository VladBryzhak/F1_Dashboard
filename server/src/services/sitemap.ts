import { cached } from "../cache/cache";
import {
  getAllConstructors,
  getAllDrivers,
  getCalendar,
  getCircuits,
  getConstructorStandings,
  getCurrentSeason,
  getDriverStandings,
} from "./f1db";
import { listArticles } from "./articles";
import { SITE_URL } from "./pageHtml";

// /sitemap.xml, built from the dataset instead of a hand-kept file, so it
// follows the season: race pages appear as races are run, the current grid's
// drivers and teams are always in. It lists the pages worth a search result
// (profiles, races, circuits, standings and calendars) and leaves out the
// per-year driver/team lists, which repeat the standings, and
// /<section>/<current year>, which is the same page as /<section>.
// History goes in by waves, so a young site's crawl isn't spread too thin:
// every season's standings and calendar, the races from RACES_FROM on, and
// the drivers and teams with a podium. Search already showed old profiles
// and seasons, and in Ukrainian these pages have little competition, so
// they are listed in both languages (the pages pair them with hreflang).

const FIRST_SEASON = 1950;
const RACES_FROM = 2010; // race pages listed from this season on (wave 1)
const GRID_SEASONS = 3; // drivers/teams of the last N seasons, podium or not

interface Entry {
  path: string;
  lastmod?: string; // yyyy-mm-dd
}

const STATIC_PAGES = ["/", "/articles", "/standings", "/calendar", "/drivers", "/teams", "/circuits", "/records", "/compare", "/live", "/telemetry", "/about", "/privacy"];

async function entries(): Promise<Entry[]> {
  const current = await getCurrentSeason();
  const out: Entry[] = [];
  const seen = new Set<string>();
  const add = (path: string, lastmod?: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, lastmod });
  };
  const ukPaths: Entry[] = [];
  const addUk = (path: string, lastmod?: string) => {
    const uk = path === "/" ? "/uk" : `/uk${path}`;
    if (seen.has(uk)) return;
    seen.add(uk);
    ukPaths.push({ path: uk, lastmod });
  };

  // The latest race run (the date the current-season pages last changed).
  const currentCal = await getCalendar(String(current));
  const done = currentCal.races.filter((r) => r.winnerDriverId);
  const lastRun = done.length ? done[done.length - 1].date : undefined;

  // Our articles, newest first (each is written in both languages).
  const articles = await listArticles("en");
  const newestArticle = articles[0]?.date;
  for (const p of STATIC_PAGES) {
    const lastmod =
      p === "/articles" ? newestArticle : ["/", "/standings", "/calendar", "/drivers", "/teams"].includes(p) ? lastRun : undefined;
    add(p, lastmod);
    addUk(p, lastmod);
  }

  for (const a of articles) {
    add(`/articles/${a.slug}`, a.date);
    addUk(`/articles/${a.slug}`, a.date);
  }

  // Every finished season's standings and calendar.
  for (let y = current - 1; y >= FIRST_SEASON; y--) {
    for (const p of [`/standings/${y}`, `/calendar/${y}`]) {
      add(p);
      addUk(p);
    }
  }

  // Every season's review, this one too once a race has run.
  for (let y = current; y >= FIRST_SEASON; y--) {
    if (y === current && !done.length) continue;
    const lastmod = y === current ? lastRun : undefined;
    add(`/seasons/${y}`, lastmod);
    addUk(`/seasons/${y}`, lastmod);
  }

  // Race pages: every round run from RACES_FROM on, and this season's next
  // race (its page is the preview until it has run).
  for (let y = current; y >= RACES_FROM; y--) {
    const cal = y === current ? currentCal : await getCalendar(String(y)).catch(() => null);
    if (!cal) continue;
    const next = y === current ? cal.races.find((r) => !r.winnerDriverId) : undefined;
    for (const r of cal.races) {
      if (!r.winnerDriverId && r !== next) continue;
      add(`/calendar/${y}/${r.round}`, r.winnerDriverId ? r.date : undefined);
      addUk(`/calendar/${y}/${r.round}`, r.winnerDriverId ? r.date : undefined);
    }
  }

  // Drivers and teams: the recent grids, then every champion.
  const drivers = new Set<string>();
  const teams = new Set<string>();
  for (let y = current; y > current - GRID_SEASONS; y--) {
    const [d, c] = await Promise.all([getDriverStandings(String(y)), getConstructorStandings(String(y))]);
    d.standings.forEach((s) => drivers.add(s.driverId));
    c.standings.forEach((s) => teams.add(s.constructorId));
  }
  for (let y = 1950; y < current; y++) {
    const [d, c] = await Promise.all([
      getDriverStandings(String(y)).catch(() => null),
      y >= 1958 ? getConstructorStandings(String(y)).catch(() => null) : Promise.resolve(null),
    ]);
    const champ = d?.standings.find((s) => s.position === 1);
    if (champ) drivers.add(champ.driverId);
    const cChamp = c?.standings.find((s) => s.position === 1);
    if (cChamp) teams.add(cChamp.constructorId);
  }
  // Everyone who has stood on a podium.
  const [allDrivers, allTeams] = await Promise.all([getAllDrivers(), getAllConstructors()]);
  allDrivers.filter((d) => d.podiums > 0).forEach((d) => drivers.add(d.driverId));
  allTeams.filter((c) => c.podiums > 0).forEach((c) => teams.add(c.constructorId));
  drivers.forEach((id) => {
    add(`/drivers/${id}`);
    addUk(`/drivers/${id}`);
  });
  teams.forEach((id) => {
    add(`/teams/${id}`);
    addUk(`/teams/${id}`);
  });

  // Circuits: the current calendar and the classic tracks the site draws.
  for (const c of await getCircuits()) {
    if (c.onCurrentCalendar || c.outline) add(`/circuits/${c.circuitId}`);
    if (c.onCurrentCalendar || c.outline) addUk(`/circuits/${c.circuitId}`);
  }
  return [...out, ...ukPaths];
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function sitemapXml(): Promise<string> {
  return cached("sitemap:xml", 6 * 3600, async () => {
    const urls = (await entries())
      .map(
        (e) =>
          `  <url><loc>${xmlEsc(SITE_URL + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`,
      )
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  });
}
