import {
  getCalendar,
  getCircuitProfile,
  getCircuits,
  getConstructorProfile,
  getConstructorStandings,
  getCurrentSeason,
  getDriverProfile,
  getDriverStandings,
  getHomeHighlights,
  getRaceWeekend,
} from "./f1db";

// Plain-HTML snapshot of a page for search-engine crawlers. The app renders
// in the browser, so the raw HTML a crawler fetches first was an empty
// <div id="root"> with no text and no links; Google then only knew our pages
// from the sitemap and put them at the back of its crawl queue. This builds
// the page's heading, a sentence or two, its key data and links to related
// pages from the same dataset the app uses. It goes inside #root, which the
// app replaces when it starts (createRoot), so a crawler that runs our
// JavaScript ends up with the same page people see.

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const a = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`;
const isSeason = (s: string | undefined) => !!s && /^\d{4}$/.test(s);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function table(head: string[], rows: string[][]): string {
  if (!rows.length) return "";
  const th = head.map((h) => `<th>${esc(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

// "a, b and c".
const andList = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");

const NAV: [string, string][] = [
  ["/", "Home"],
  ["/standings", "Standings"],
  ["/calendar", "Calendar"],
  ["/drivers", "Drivers"],
  ["/teams", "Teams"],
  ["/circuits", "Circuits"],
  ["/compare", "Compare drivers"],
  ["/live", "Live timing"],
  ["/telemetry", "Telemetry"],
];

function frame(body: string): string {
  const nav = NAV.map(([href, text]) => `<li>${a(href, text)}</li>`).join("");
  return (
    `<header><nav aria-label="Sections"><ul>${nav}</ul></nav></header>` +
    `<main>${body}</main>` +
    `<footer><p>${a("/about", "About F1 Dashboard")} ${a("/privacy", "Privacy")} ${a("/feedback", "Feedback")}</p>` +
    `<p>Data: f1db (CC BY 4.0) and OpenF1. Not affiliated with Formula 1.</p></footer>`
  );
}

// Links to the seasons around this one (and the latest), for season pages.
function seasonNav(base: string, season: number, current: number): string {
  const years: number[] = [];
  for (let y = Math.min(current, season + 3); y >= Math.max(1950, season - 3); y--) years.push(y);
  if (!years.includes(current)) years.unshift(current);
  return `<nav aria-label="Seasons"><p>Other seasons: ${years
    .filter((y) => y !== season)
    .map((y) => a(`${base}/${y}`, String(y)))
    .join(", ")}</p></nav>`;
}

async function home(): Promise<string> {
  const h = await getHomeHighlights();
  const st = await getDriverStandings(String(h.season)).catch(() => null);
  let body =
    `<h1>F1 Dashboard: Formula 1 standings, calendar and stats</h1>` +
    `<p>Formula 1 championship standings, the race calendar with weekend schedules, full race results, ` +
    `circuit guides, driver and team histories since 1950, head-to-head comparisons, telemetry, live timing and race replays.</p>`;
  const race = h.latestRace;
  if (race) {
    const winner = race.podium.find((p) => p.position === 1);
    body +=
      `<h2>Latest race: ${a(`/calendar/${race.season}/${race.round}`, `${race.grandPrixName} Grand Prix ${race.season}`)}</h2>` +
      (winner ? `<p>${a(`/drivers/${winner.driverId}`, winner.driverName)} won for ${a(`/teams/${winner.constructorId}`, winner.constructorName)}.</p>` : "") +
      list(race.podium.map((p) => `P${p.position} ${a(`/drivers/${p.driverId}`, p.driverName)} (${a(`/teams/${p.constructorId}`, p.constructorName)})`));
  }
  if (h.nextRace) {
    const n = h.nextRace;
    body += `<h2>Next race</h2><p>${esc(n.grandPrixName)} Grand Prix, ${esc(fmtDate(n.date))}, at ${a(`/circuits/${n.circuitId}`, n.placeName || n.circuitId)}. ${a(`/calendar/${h.season}`, `${h.season} calendar`)}.</p>`;
  }
  const top = (st?.standings ?? []).slice(0, 10);
  if (top.length) {
    body +=
      `<h2>${a(`/standings/${h.season}`, `${h.season} championship`)}</h2>` +
      table(
        ["Pos", "Driver", "Team", "Points"],
        top.map((d) => [String(d.position), a(`/drivers/${d.driverId}`, `${d.givenName} ${d.familyName}`), a(`/teams/${d.constructorId}`, d.constructorName), String(d.points)]),
      );
  }
  return body;
}

async function standings(season: number, current: number): Promise<string> {
  const [drv, con] = await Promise.all([
    getDriverStandings(String(season)).catch(() => null),
    getConstructorStandings(String(season)).catch(() => null),
  ]);
  const leader = drv?.standings[0];
  let body =
    `<h1>${season} Formula 1 championship standings</h1>` +
    `<p>Drivers' and constructors' standings for the ${season} season: points, wins and the gap to the leader.` +
    (leader ? ` ${season < current ? "Champion" : "Leader"}: ${esc(`${leader.givenName} ${leader.familyName}`)} (${esc(leader.constructorName)}), ${leader.points} points.` : "") +
    `</p>`;
  body +=
    `<h2>Drivers</h2>` +
    table(
      ["Pos", "Driver", "Team", "Wins", "Points"],
      (drv?.standings ?? []).map((d) => [String(d.position), a(`/drivers/${d.driverId}`, `${d.givenName} ${d.familyName}`), a(`/teams/${d.constructorId}`, d.constructorName), String(d.wins), String(d.points)]),
    );
  body +=
    `<h2>Constructors</h2>` +
    table(
      ["Pos", "Team", "Wins", "Points"],
      (con?.standings ?? []).map((c) => [String(c.position), a(`/teams/${c.constructorId}`, c.name), String(c.wins), String(c.points)]),
    );
  return body + `<p>${a(`/calendar/${season}`, `${season} race calendar and results`)}</p>` + seasonNav("/standings", season, current);
}

async function calendar(season: number, current: number): Promise<string> {
  const cal = await getCalendar(String(season)).catch(() => null);
  const races = cal?.races ?? [];
  let body =
    `<h1>${season} Formula 1 race calendar and results</h1>` +
    `<p>${plural(races.length, "Grand Prix", "Grands Prix")} in the ${season} season, with dates, circuits, winners and full results for each race weekend.</p>`;
  body += table(
    ["Round", "Grand Prix", "Date", "Circuit", "Winner"],
    races.map((r) => [
      String(r.round),
      a(`/calendar/${season}/${r.round}`, `${r.name} Grand Prix`),
      esc(fmtDate(r.date)),
      a(`/circuits/${r.circuitId}`, r.circuitName),
      r.winnerDriverId ? `${a(`/drivers/${r.winnerDriverId}`, r.winnerName ?? "")}${r.winnerConstructorId ? ` (${a(`/teams/${r.winnerConstructorId}`, r.winnerConstructorName ?? "")})` : ""}` : "",
    ]),
  );
  return body + `<p>${a(`/standings/${season}`, `${season} championship standings`)}</p>` + seasonNav("/calendar", season, current);
}

async function race(season: string, round: string): Promise<string | null> {
  const w = await getRaceWeekend(season, round).catch(() => null);
  if (!w) return null;
  const winner = w.results.find((r) => r.positionText === "1");
  const pole = w.qualifying.find((q) => q.position === 1);
  let body =
    `<h1>${esc(w.grandPrixName)} Grand Prix ${esc(w.season)}: results</h1>` +
    `<p>Round ${w.round} of the ${esc(w.season)} season, ${esc(fmtDate(w.date))}, at ${a(`/circuits/${w.circuitId}`, w.circuitName)}.` +
    (winner ? ` ${a(`/drivers/${winner.driverId}`, winner.driverName)} won for ${a(`/teams/${winner.constructorId}`, winner.constructorName)}${winner.gridPosition === 1 ? " from pole position" : winner.gridPosition ? ` from P${winner.gridPosition} on the grid` : ""}.` : "") +
    (pole && pole.driverId !== winner?.driverId ? ` ${a(`/drivers/${pole.driverId}`, pole.driverName)} took pole position.` : "") +
    (w.fastestLap ? ` Fastest lap: ${a(`/drivers/${w.fastestLap.driverId}`, w.fastestLap.driverName)} (${esc(w.fastestLap.detail)}).` : "") +
    `</p>`;
  if (w.results.length) {
    body +=
      `<h2>Race result</h2>` +
      table(
        ["Pos", "Driver", "Team", "Time", "Points"],
        w.results.map((r) => [esc(r.positionText), a(`/drivers/${r.driverId}`, r.driverName), a(`/teams/${r.constructorId}`, r.constructorName), esc(r.timeDisplay), String(r.points)]),
      );
  }
  if (w.qualifying.length) {
    body +=
      `<h2>Qualifying</h2>` +
      table(
        ["Pos", "Driver", "Team", "Best time"],
        w.qualifying.map((q) => [String(q.position ?? ""), a(`/drivers/${q.driverId}`, q.driverName), esc(q.constructorName), esc(q.q3 ?? q.q2 ?? q.q1 ?? "")]),
      );
  }
  const n = Number(round);
  const rounds = (await getCalendar(season).catch(() => null))?.races.length ?? 0;
  const links = [
    n > 1 ? a(`/calendar/${season}/${n - 1}`, "Previous round") : "",
    n < rounds ? a(`/calendar/${season}/${n + 1}`, "Next round") : "",
    a(`/calendar/${season}`, `${season} calendar`),
    a(`/standings/${season}`, `${season} standings`),
  ].filter(Boolean);
  return body + `<p>${links.join(" | ")}</p>`;
}

async function driverList(season: number, current: number): Promise<string> {
  const st = await getDriverStandings(String(season)).catch(() => null);
  return (
    `<h1>${season} Formula 1 drivers</h1>` +
    `<p>Every driver on the ${season} grid, with links to full career profiles: titles, wins, podiums and every season.</p>` +
    list((st?.standings ?? []).map((d) => `${a(`/drivers/${d.driverId}`, `${d.givenName} ${d.familyName}`)}, ${a(`/teams/${d.constructorId}`, d.constructorName)}`)) +
    seasonNav("/drivers", season, current)
  );
}

async function teamList(season: number, current: number): Promise<string> {
  const st = await getConstructorStandings(String(season)).catch(() => null);
  return (
    `<h1>${season} Formula 1 teams</h1>` +
    `<p>Every constructor on the ${season} grid, with links to full team histories: titles, wins and every season.</p>` +
    list((st?.standings ?? []).map((c) => a(`/teams/${c.constructorId}`, c.name))) +
    seasonNav("/teams", season, current)
  );
}

async function driver(id: string, current: number): Promise<string | null> {
  const p = await getDriverProfile(id).catch(() => null);
  if (!p) return null;
  const name = `${p.givenName} ${p.familyName}`;
  const teams = [...new Map(p.seasons.map((s) => [s.constructorId, s.constructorName])).entries()];
  let body =
    `<h1>${esc(name)}: Formula 1 career stats</h1>` +
    `<p>${esc(name)} (${esc(p.nationality)}) ${p.lastSeason >= current ? `has raced in the FIA Formula One World Championship since ${p.firstSeason}` : `raced in the FIA Formula One World Championship from ${p.firstSeason} to ${p.lastSeason}`}` +
    (teams.length ? `, driving for ${andList(teams.map(([tid, tn]) => a(`/teams/${tid}`, tn)))}` : "") +
    `. ${plural(p.championships, "world title")}, ${plural(p.wins, "win")}, ${plural(p.podiums, "podium")}, ${plural(p.poles, "pole position")} and ${p.points} points from ${plural(p.races, "race start")}.</p>`;
  body +=
    `<h2>Season by season</h2>` +
    table(
      ["Season", "Team", "Position", "Wins", "Points"],
      p.seasons
        .slice()
        .reverse()
        .map((s) => [a(`/standings/${s.season}`, String(s.season)), a(`/teams/${s.constructorId}`, s.constructorName), s.position > 0 ? `P${s.position}` : "", String(s.wins), String(s.points)]),
    );
  return body + `<p>${a("/compare", "Compare with another driver")} | ${a("/drivers", "All drivers")}</p>`;
}

async function team(id: string, current: number): Promise<string | null> {
  const p = await getConstructorProfile(id).catch(() => null);
  if (!p) return null;
  let body =
    `<h1>${esc(p.name)}: Formula 1 history, titles and wins</h1>` +
    `<p>${esc(p.name)} (${esc(p.nationality)}) ${p.lastSeason >= current ? `has competed in the FIA Formula One World Championship since ${p.firstSeason}` : `competed in the FIA Formula One World Championship from ${p.firstSeason} to ${p.lastSeason}`}: ` +
    `${plural(p.championships, "constructors' title")}, ${plural(p.wins, "win")}, ${plural(p.podiums, "podium")} and ${p.points} points from ${plural(p.races, "race entry", "race entries")}.</p>`;
  if (p.lineage.length > 1) {
    body += `<p>Raced as: ${p.lineage.map((l) => `${a(`/teams/${l.constructorId}`, l.name)} (${l.yearFrom}-${l.yearTo ?? "today"})`).join(", ")}.</p>`;
  }
  body +=
    `<h2>Season by season</h2>` +
    table(
      ["Season", "Position", "Wins", "Points", "Drivers"],
      p.seasons
        .slice()
        .reverse()
        .map((s) => [
          a(`/standings/${s.season}`, String(s.season)),
          s.position > 0 ? `P${s.position}` : "",
          String(s.wins),
          String(s.points),
          s.drivers.map((d) => a(`/drivers/${d.driverId}`, d.name)).join(", "),
        ]),
    );
  return body + `<p>${a("/teams", "All teams")}</p>`;
}

async function circuitList(): Promise<string> {
  const all = await getCircuits().catch(() => []);
  const current = all.filter((c) => c.onCurrentCalendar);
  const historic = all.filter((c) => !c.onCurrentCalendar && c.outline);
  const item = (c: (typeof all)[number]) => `${a(`/circuits/${c.circuitId}`, c.name)}, ${esc(c.placeName)} (${plural(c.racesHeld, "Grand Prix", "Grands Prix")})`;
  return (
    `<h1>Formula 1 circuits</h1>` +
    `<p>Track maps, length, turns, race lap records and every winner at each venue.</p>` +
    `<h2>On the current calendar</h2>${list(current.map(item))}` +
    `<h2>Historic circuits</h2>${list(historic.map(item))}`
  );
}

async function circuit(id: string): Promise<string | null> {
  const c = await getCircuitProfile(id).catch(() => null);
  if (!c) return null;
  const facts = [c.length != null ? `${c.length} km` : "", c.turns != null ? `${c.turns} turns` : "", plural(c.racesHeld, "Grand Prix", "Grands Prix") + (c.firstYear ? ` since ${c.firstYear}` : "")].filter(Boolean);
  let body =
    `<h1>${esc(c.name)}: circuit guide, lap record and winners</h1>` +
    `<p>${esc(c.name)} in ${esc(c.placeName)}: ${esc(facts.join(", "))}.` +
    (c.lapRecord ? ` Race lap record: ${esc(c.lapRecord.time)} by ${a(`/drivers/${c.lapRecord.driverId}`, c.lapRecord.driverName)} (${a(`/teams/${c.lapRecord.constructorId}`, c.lapRecord.constructorName)}, ${c.lapRecord.year}).` : "") +
    (c.nextRace ? ` Next race here: ${a(`/calendar/${c.nextRace.season}/${c.nextRace.round}`, `${c.nextRace.grandPrixName} Grand Prix`)}, ${esc(fmtDate(c.nextRace.date))}.` : "") +
    `</p>`;
  if (c.topDrivers.length) {
    body += `<h2>Most wins</h2>` + list(c.topDrivers.map((t) => `${a(`/drivers/${t.id}`, t.name)}: ${t.count}`));
  }
  if (c.topConstructors.length) {
    body += `<h2>Most wins by team</h2>` + list(c.topConstructors.map((t) => `${a(`/teams/${t.id}`, t.name)}: ${t.count}`));
  }
  if (c.races.length) {
    body +=
      `<h2>Winners</h2>` +
      table(
        ["Year", "Grand Prix", "Winner", "Team"],
        c.races.map((r) => [
          a(`/calendar/${r.year}/${r.round}`, String(r.year)),
          esc(r.grandPrixName),
          r.winnerDriverId ? a(`/drivers/${r.winnerDriverId}`, r.winnerName ?? "") : "",
          r.winnerConstructorId ? a(`/teams/${r.winnerConstructorId}`, r.winnerConstructorName ?? "") : "",
        ]),
      );
  }
  return body + `<p>${a("/circuits", "All circuits")}</p>`;
}

// Short pages: their heading, a line, and the site's sections (in the frame).
const STATIC: Record<string, [string, string]> = {
  compare: ["Compare Formula 1 drivers head to head", "Championships, wins, podiums, points and race-by-race record of any two drivers, over a career or a single season."],
  live: ["Formula 1 live timing and race replays", "Positions, gaps, lap times, sectors and tyres during a session, and replays of every session since 2023 with a track map."],
  telemetry: ["Formula 1 telemetry", "Speed, throttle, brake, gear and DRS traces lap by lap, from 2023 onward."],
  about: ["About F1 Dashboard", "An independent, fan-made Formula 1 statistics site. Data from f1db (CC BY 4.0), OpenF1 and Wikimedia Commons."],
  privacy: ["Privacy policy", "How F1 Dashboard handles data: analytics with consent, what is stored in your browser, the feedback form and hosting."],
  support: ["Support F1 Dashboard", "F1 Dashboard is free, with no ads and no accounts. Donations help pay for hosting and development."],
  feedback: ["Feedback", "Report a bug or suggest a feature for F1 Dashboard."],
};

// The snapshot for a page path, or "" when there is nothing to show (an
// unknown path, or data that failed to load).
export async function pageSnapshot(rawPath: string): Promise<string> {
  const parts = rawPath.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  const [section, x, y] = parts;
  const current = await getCurrentSeason();
  const seasonOf = (s: string | undefined) => (isSeason(s) ? Number(s) : current);
  let body: string | null = null;
  switch (section) {
    case undefined:
      body = await home();
      break;
    case "standings":
      body = await standings(seasonOf(x), current);
      break;
    case "calendar":
      body = isSeason(x) && y && /^\d+$/.test(y) ? await race(x!, y) : await calendar(seasonOf(x), current);
      break;
    case "drivers":
      body = x && !isSeason(x) ? await driver(x, current) : await driverList(seasonOf(x), current);
      break;
    case "teams":
      body = x && !isSeason(x) ? await team(x, current) : await teamList(seasonOf(x), current);
      break;
    case "circuits":
      body = x ? await circuit(x) : await circuitList();
      break;
    default:
      if (section && STATIC[section] && !x) {
        const [h, p] = STATIC[section];
        body = `<h1>${esc(h)}</h1><p>${esc(p)}</p>`;
      }
  }
  return body ? frame(body) : "";
}
