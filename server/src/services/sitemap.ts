import { cached } from "../cache/cache";
import {
  getCalendar,
  getCircuits,
  getConstructorStandings,
  getCurrentSeason,
  getDriverStandings,
} from "./f1db";
import { SITE_URL } from "./pageHtml";

// /sitemap.xml, built from the dataset instead of a hand-kept file, so it
// follows the season: race pages appear as races are run, the current grid's
// drivers and teams are always in. It lists the pages worth a search result
// (profiles, races, circuits, standings and calendars of recent seasons) and
// leaves out the per-year driver/team lists, which repeat the standings, and
// /<section>/<current year>, which is the same page as /<section>.

const RECENT_SEASONS = 10; // standings + calendar pages per year
const RACE_SEASONS = 2; // seasons whose race pages are listed
const GRID_SEASONS = 3; // drivers/teams of the last N seasons

interface Entry {
  path: string;
  lastmod?: string; // yyyy-mm-dd
}

const STATIC_PAGES = ["/", "/standings", "/calendar", "/drivers", "/teams", "/circuits", "/compare", "/live", "/telemetry", "/about", "/privacy"];

async function entries(): Promise<Entry[]> {
  const current = await getCurrentSeason();
  const out: Entry[] = [];
  const seen = new Set<string>();
  const add = (path: string, lastmod?: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, lastmod });
  };

  // The latest race run (the date the current-season pages last changed).
  const currentCal = await getCalendar(String(current));
  const done = currentCal.races.filter((r) => r.winnerDriverId);
  const lastRun = done.length ? done[done.length - 1].date : undefined;

  for (const p of STATIC_PAGES) add(p, ["/", "/standings", "/calendar", "/drivers", "/teams"].includes(p) ? lastRun : undefined);

  for (let y = current - 1; y > current - RECENT_SEASONS; y--) {
    add(`/standings/${y}`);
    add(`/calendar/${y}`);
  }

  // Race pages: every round run in the current and previous seasons.
  for (let y = current; y > current - RACE_SEASONS; y--) {
    const cal = y === current ? currentCal : await getCalendar(String(y));
    for (const r of cal.races) if (r.winnerDriverId) add(`/calendar/${y}/${r.round}`, r.date);
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
  drivers.forEach((id) => add(`/drivers/${id}`));
  teams.forEach((id) => add(`/teams/${id}`));

  // Circuits: the current calendar and the classic tracks the site draws.
  for (const c of await getCircuits()) {
    if (c.onCurrentCalendar || c.outline) add(`/circuits/${c.circuitId}`);
  }
  return out;
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
