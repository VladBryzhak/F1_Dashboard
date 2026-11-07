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
  getSeasonReview,
  hasSeasonReview,
} from "./f1db";
import { getArticle, listArticles, TAG_LABEL } from "./articles";
import { getRacePreview } from "./racePreview";
import { gpTitle, type Lang } from "./gpNames";
import { UK, ukCountry, ukDate, ukPlural } from "./ukText";

// Plain-HTML snapshot of a page for search-engine crawlers. The app renders
// in the browser, so the raw HTML a crawler fetches first was an empty
// <div id="root"> with no text and no links; Google then only knew our pages
// from the sitemap and put them at the back of its crawl queue. This builds
// the page's heading, a sentence or two, its key data and links to related
// pages from the same dataset the app uses, in the page's language (English
// at /…, Ukrainian at /uk/…, with links that stay in that language). It goes
// inside #root, which the app replaces when it starts (createRoot), so a
// crawler that runs our JavaScript ends up with the same page people see.

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isSeason = (s: string | undefined) => !!s && /^\d{4}$/.test(s);
const enDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const enPlural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "a, b and c" / "a, b і c".
const joinAnd = (items: string[], and: string) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;

function table(head: string[], rows: string[][]): string {
  if (!rows.length) return "";
  const th = head.map((h) => `<th>${esc(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");

// One page build: its language, and links that keep that language (and give
// the current season's pages their bare address: /standings, not
// /standings/2026, which redirects there).
interface Ctx {
  uk: boolean;
  a: (href: string, text: string) => string;
  date: (iso: string) => string;
}

const SEASON_PAGE = /^\/(standings|calendar|drivers|teams)\/(\d{4})$/;

function ctx(lang: Lang, current?: number): Ctx {
  const uk = lang === "uk";
  const bare = (path: string) => {
    const m = SEASON_PAGE.exec(path);
    return m && Number(m[2]) === current ? `/${m[1]}` : path;
  };
  const href = (path: string) => {
    const p = bare(path);
    return uk ? (p === "/" ? "/uk" : `/uk${p}`) : p;
  };
  return {
    uk,
    a: (path, text) => `<a href="${esc(href(path))}">${esc(text)}</a>`,
    date: uk ? ukDate : enDate,
  };
}

const NAV: [string, string, string][] = [
  ["/", "Home", "Головна"],
  ["/articles", "Articles", "Статті"],
  ["/standings", "Standings", "Залік"],
  ["/calendar", "Calendar", "Календар"],
  ["/drivers", "Drivers", "Пілоти"],
  ["/teams", "Teams", "Команди"],
  ["/circuits", "Circuits", "Траси"],
  ["/compare", "Compare drivers", "Порівняння пілотів"],
  ["/live", "Live timing", "Live-таймінг"],
  ["/telemetry", "Telemetry", "Телеметрія"],
];

function frame(c: Ctx, body: string): string {
  const nav = NAV.map(([href, en, uk]) => `<li>${c.a(href, c.uk ? uk : en)}</li>`).join("");
  return (
    `<header><nav aria-label="${c.uk ? "Розділи" : "Sections"}"><ul>${nav}</ul></nav></header>` +
    `<main>${body}</main>` +
    `<footer><p>${c.a("/about", c.uk ? "Про Paddock Times" : "About Paddock Times")} ${c.a("/privacy", c.uk ? "Конфіденційність" : "Privacy")} ${c.a("/feedback", c.uk ? "Відгук" : "Feedback")}</p>` +
    `<p>${c.uk ? "Дані: f1db (CC BY 4.0) і OpenF1. Не пов'язано з Formula 1." : "Data: f1db (CC BY 4.0) and OpenF1. Not affiliated with Formula 1."}</p></footer>`
  );
}

// Links to the seasons around this one (and the latest), for season pages.
function seasonNav(c: Ctx, base: string, season: number, current: number): string {
  const years: number[] = [];
  for (let y = Math.min(current, season + 3); y >= Math.max(1950, season - 3); y--) years.push(y);
  if (!years.includes(current)) years.unshift(current);
  return `<nav aria-label="${c.uk ? "Сезони" : "Seasons"}"><p>${c.uk ? "Інші сезони" : "Other seasons"}: ${years
    .filter((y) => y !== season)
    .map((y) => c.a(`${base}/${y}`, String(y)))
    .join(", ")}</p></nav>`;
}

async function home(c: Ctx): Promise<string> {
  const h = await getHomeHighlights();
  const st = await getDriverStandings(String(h.season)).catch(() => null);
  const gp = (name: string) => (c.uk ? gpTitle(name, "uk") : `${name} Grand Prix`);
  let body = c.uk
    ? `<h1>Paddock Times: залік Ф1, календар і статистика Формули-1</h1>` +
      `<p>Залік Формули-1, календар гонок з розкладом вікендів, повні результати гонок, путівники трасами, ` +
      `історія пілотів і команд з 1950 року, порівняння пілотів, телеметрія, live-таймінг і повтори гонок.</p>`
    : `<h1>Paddock Times: Formula 1 standings, calendar and stats</h1>` +
      `<p>Formula 1 championship standings, the race calendar with weekend schedules, full race results, ` +
      `circuit guides, driver and team histories since 1950, head-to-head comparisons, telemetry, live timing and race replays.</p>`;
  const race = h.latestRace;
  if (race) {
    const winner = race.podium.find((p) => p.position === 1);
    body +=
      `<h2>${c.uk ? "Остання гонка" : "Latest race"}: ${c.a(`/calendar/${race.season}/${race.round}`, `${gp(race.grandPrixName)} ${race.season}`)}</h2>` +
      (winner
        ? c.uk
          ? `<p>Перемога: ${c.a(`/drivers/${winner.driverId}`, winner.driverName)} (${c.a(`/teams/${winner.constructorId}`, winner.constructorName)}).</p>`
          : `<p>${c.a(`/drivers/${winner.driverId}`, winner.driverName)} won for ${c.a(`/teams/${winner.constructorId}`, winner.constructorName)}.</p>`
        : "") +
      list(race.podium.map((p) => `P${p.position} ${c.a(`/drivers/${p.driverId}`, p.driverName)} (${c.a(`/teams/${p.constructorId}`, p.constructorName)})`));
  }
  if (h.nextRace) {
    const n = h.nextRace;
    body += c.uk
      ? `<h2>Наступна гонка</h2><p>${esc(gp(n.grandPrixName))}, ${esc(c.date(n.date))}, траса ${c.a(`/circuits/${n.circuitId}`, n.placeName || n.circuitId)}. ${c.a(`/calendar/${n.season}`, `Календар ${n.season}`)}.</p>`
      : `<h2>Next race</h2><p>${esc(gp(n.grandPrixName))}, ${esc(c.date(n.date))}, at ${c.a(`/circuits/${n.circuitId}`, n.placeName || n.circuitId)}. ${c.a(`/calendar/${n.season}`, `${n.season} calendar`)}.</p>`;
  }
  const top = (st?.standings ?? []).slice(0, 10);
  if (top.length) {
    body +=
      `<h2>${c.a(`/standings/${h.season}`, c.uk ? `Чемпіонат ${h.season}` : `${h.season} championship`)}</h2>` +
      table(
        c.uk ? ["Поз.", "Пілот", "Команда", "Очки"] : ["Pos", "Driver", "Team", "Points"],
        top.map((d) => [String(d.position), c.a(`/drivers/${d.driverId}`, `${d.givenName} ${d.familyName}`), c.a(`/teams/${d.constructorId}`, d.constructorName), String(d.points)]),
      );
  }
  return body;
}

async function standings(c: Ctx, season: number, current: number): Promise<string> {
  const [drv, con] = await Promise.all([
    getDriverStandings(String(season)).catch(() => null),
    getConstructorStandings(String(season)).catch(() => null),
  ]);
  const leader = drv?.standings[0];
  const leaderName = leader ? `${leader.givenName} ${leader.familyName}` : "";
  let body = c.uk
    ? `<h1>Залік Формули-1 ${season}</h1>` +
      `<p>Залік пілотів і Кубок конструкторів сезону ${season}: очки, перемоги та відставання від лідера.` +
      (leader ? ` ${season < current ? "Чемпіон" : "Лідер"}: ${esc(leaderName)} (${esc(leader.constructorName)}), ${esc(ukPlural(leader.points, UK.points))}.` : "") +
      `</p>`
    : `<h1>${season} Formula 1 championship standings</h1>` +
      `<p>Drivers' and constructors' standings for the ${season} season: points, wins and the gap to the leader.` +
      (leader ? ` ${season < current ? "Champion" : "Leader"}: ${esc(leaderName)} (${esc(leader.constructorName)}), ${leader.points} points.` : "") +
      `</p>`;
  body +=
    `<h2>${c.uk ? "Пілоти" : "Drivers"}</h2>` +
    table(
      c.uk ? ["Поз.", "Пілот", "Команда", "Перемоги", "Очки"] : ["Pos", "Driver", "Team", "Wins", "Points"],
      (drv?.standings ?? []).map((d) => [String(d.position), c.a(`/drivers/${d.driverId}`, `${d.givenName} ${d.familyName}`), c.a(`/teams/${d.constructorId}`, d.constructorName), String(d.wins), String(d.points)]),
    );
  body +=
    `<h2>${c.uk ? "Конструктори" : "Constructors"}</h2>` +
    table(
      c.uk ? ["Поз.", "Команда", "Перемоги", "Очки"] : ["Pos", "Team", "Wins", "Points"],
      (con?.standings ?? []).map((t) => [String(t.position), c.a(`/teams/${t.constructorId}`, t.name), String(t.wins), String(t.points)]),
    );
  return (
    body +
    `<p>${c.a(`/calendar/${season}`, c.uk ? `Календар і результати ${season}` : `${season} race calendar and results`)}</p>` +
    seasonNav(c, "/standings", season, current)
  );
}

async function calendar(c: Ctx, season: number, current: number): Promise<string> {
  const cal = await getCalendar(String(season)).catch(() => null);
  const races = cal?.races ?? [];
  let body = c.uk
    ? `<h1>Календар Формули-1 ${season}: гонки й результати</h1>` +
      `<p>${ukPlural(races.length, UK.grandsPrix)} у сезоні ${season}: дати, траси, переможці та повні результати кожного вікенду.</p>`
    : `<h1>${season} Formula 1 race calendar and results</h1>` +
      `<p>${enPlural(races.length, "Grand Prix", "Grands Prix")} in the ${season} season, with dates, circuits, winners and full results for each race weekend.</p>`;
  body += table(
    c.uk ? ["Етап", "Гран-прі", "Дата", "Траса", "Переможець"] : ["Round", "Grand Prix", "Date", "Circuit", "Winner"],
    races.map((r) => [
      String(r.round),
      c.a(`/calendar/${season}/${r.round}`, c.uk ? gpTitle(r.name, "uk") : `${r.name} Grand Prix`),
      esc(c.date(r.date)),
      c.a(`/circuits/${r.circuitId}`, r.circuitName),
      r.winnerDriverId
        ? `${c.a(`/drivers/${r.winnerDriverId}`, r.winnerName ?? "")}${r.winnerConstructorId ? ` (${c.a(`/teams/${r.winnerConstructorId}`, r.winnerConstructorName ?? "")})` : ""}`
        : "",
    ]),
  );
  return (
    body +
    `<p>${c.a(`/standings/${season}`, c.uk ? `Залік ${season}` : `${season} championship standings`)}</p>` +
    seasonNav(c, "/calendar", season, current)
  );
}

const SESSION_NAME: Record<string, [string, string]> = {
  FP1: ["Practice 1", "Практика 1"],
  FP2: ["Practice 2", "Практика 2"],
  FP3: ["Practice 3", "Практика 3"],
  SQ: ["Sprint Qualifying", "Спринт-кваліфікація"],
  SPRINT: ["Sprint", "Спринт"],
  Q: ["Qualifying", "Кваліфікація"],
  RACE: ["Race", "Гонка"],
};

// An upcoming race's preview (services/racePreview.ts): the schedule, the
// forecast, the last races at the circuit and who has won there.
async function racePreviewHtml(c: Ctx, season: string, round: string): Promise<string> {
  const p = await getRacePreview(season, round).catch(() => null);
  if (!p) return "";
  const time = (iso: string, known: boolean) =>
    known ? `${esc(c.date(iso))}, ${esc(new Date(iso).toISOString().slice(11, 16))} UTC` : esc(c.date(iso));
  let html =
    `<h2>${c.uk ? "Розклад" : "Schedule"}</h2>` +
    list(p.race.sessions.map((s) => `${esc(SESSION_NAME[s.kind]?.[c.uk ? 1 : 0] ?? s.kind)}: ${time(s.start, s.timeKnown)}`));
  if (p.weather?.length) {
    html +=
      `<h2>${c.uk ? "Прогноз погоди" : "Weather forecast"}</h2>` +
      list(
        p.weather.map((d) =>
          c.uk
            ? `${esc(c.date(d.date))}: ${d.tMax}° / ${d.tMin}°, ймовірність дощу ${d.rain}%`
            : `${esc(c.date(d.date))}: ${d.tMax}° / ${d.tMin}°, ${d.rain}% chance of rain`,
        ),
      ) +
      `<p>${c.uk ? "Прогноз" : "Forecast"}: <a href="https://open-meteo.com/">Open-Meteo</a></p>`;
  }
  if (p.history.length) {
    html +=
      `<h2>${c.uk ? "Останні гонки на цій трасі" : "Last races at this circuit"}</h2>` +
      table(
        c.uk ? ["Рік", "Переможець", "Команда", "Поул"] : ["Year", "Winner", "Team", "Pole"],
        p.history.map((r) => [
          c.a(`/calendar/${r.year}/${r.round}`, String(r.year)),
          c.a(`/drivers/${r.winnerId}`, r.winnerName),
          c.a(`/teams/${r.winnerConstructorId}`, r.winnerConstructorName),
          esc(r.poleName),
        ]),
      );
  }
  const facts: string[] = [];
  if (p.topWinners.length) {
    const top = p.topWinners.map((w) => `${c.a(`/drivers/${w.id}`, w.name)} (${w.count})`);
    facts.push(c.uk ? `Найбільше перемог тут: ${top.join(", ")}.` : `Most wins here: ${top.join(", ")}.`);
  }
  if (p.circuit.lapRecord) {
    const r = p.circuit.lapRecord;
    facts.push(
      c.uk
        ? `Рекорд кола: ${esc(r.time)}, ${c.a(`/drivers/${r.driverId}`, r.driverName)}, ${r.year}.`
        : `Lap record: ${esc(r.time)}, ${c.a(`/drivers/${r.driverId}`, r.driverName)}, ${r.year}.`,
    );
  }
  facts.push(c.uk ? `Гонок на цій трасі: ${p.circuit.racesHeld}.` : `Races held at this circuit: ${p.circuit.racesHeld}.`);
  return html + `<p>${facts.join(" ")}</p>`;
}

async function race(c: Ctx, season: string, round: string): Promise<string | null> {
  const w = await getRaceWeekend(season, round).catch(() => null);
  if (!w) return null;
  const ahead = !w.results.length;
  const winner = w.results.find((r) => r.positionText === "1");
  const pole = w.qualifying.find((q) => q.position === 1);
  const gp = c.uk ? gpTitle(w.grandPrixName, "uk") : `${w.grandPrixName} Grand Prix`;
  const circuit = c.a(`/circuits/${w.circuitId}`, w.circuitName);
  let body: string;
  if (c.uk) {
    const start = winner?.gridPosition === 1 ? ", старт із поул-позиції" : winner?.gridPosition ? `, старт із P${winner.gridPosition}` : "";
    body =
      `<h1>${esc(gp)} ${esc(w.season)}: ${ahead ? "анонс" : "результати"}</h1>` +
      `<p>Етап ${w.round} сезону ${esc(w.season)}, ${esc(c.date(w.date))}, траса ${circuit}.` +
      (winner ? ` Перемога: ${c.a(`/drivers/${winner.driverId}`, winner.driverName)} (${c.a(`/teams/${winner.constructorId}`, winner.constructorName)})${start}.` : "") +
      (pole && pole.driverId !== winner?.driverId ? ` Поул-позиція: ${c.a(`/drivers/${pole.driverId}`, pole.driverName)}.` : "") +
      (w.fastestLap ? ` Найшвидше коло: ${c.a(`/drivers/${w.fastestLap.driverId}`, w.fastestLap.driverName)}, ${esc(w.fastestLap.detail.replace(/\(lap (\d+)\)/, "($1-е коло)"))}.` : "") +
      `</p>`;
  } else {
    body =
      `<h1>${esc(gp)} ${esc(w.season)}: ${ahead ? "preview" : "results"}</h1>` +
      `<p>Round ${w.round} of the ${esc(w.season)} season, ${esc(c.date(w.date))}, at ${circuit}.` +
      (winner ? ` ${c.a(`/drivers/${winner.driverId}`, winner.driverName)} won for ${c.a(`/teams/${winner.constructorId}`, winner.constructorName)}${winner.gridPosition === 1 ? " from pole position" : winner.gridPosition ? ` from P${winner.gridPosition} on the grid` : ""}.` : "") +
      (pole && pole.driverId !== winner?.driverId ? ` ${c.a(`/drivers/${pole.driverId}`, pole.driverName)} took pole position.` : "") +
      (w.fastestLap ? ` Fastest lap: ${c.a(`/drivers/${w.fastestLap.driverId}`, w.fastestLap.driverName)}, ${esc(w.fastestLap.detail)}.` : "") +
      `</p>`;
  }
  if (ahead) body += await racePreviewHtml(c, season, round);
  if (w.results.length) {
    body +=
      `<h2>${c.uk ? "Результат гонки" : "Race result"}</h2>` +
      table(
        c.uk ? ["Поз.", "Пілот", "Команда", "Час", "Очки"] : ["Pos", "Driver", "Team", "Time", "Points"],
        w.results.map((r) => [esc(r.positionText), c.a(`/drivers/${r.driverId}`, r.driverName), c.a(`/teams/${r.constructorId}`, r.constructorName), esc(r.timeDisplay), String(r.points)]),
      );
  }
  if (w.qualifying.length) {
    body +=
      `<h2>${c.uk ? "Кваліфікація" : "Qualifying"}</h2>` +
      table(
        c.uk ? ["Поз.", "Пілот", "Команда", "Найкращий час"] : ["Pos", "Driver", "Team", "Best time"],
        w.qualifying.map((q) => [String(q.position ?? ""), c.a(`/drivers/${q.driverId}`, q.driverName), esc(q.constructorName), esc(q.q3 ?? q.q2 ?? q.q1 ?? "")]),
      );
  }
  // Every race at this circuit, so each race page links the circuit's history.
  const others = w.atCircuit.filter((r) => !(r.year === Number(season) && r.round === Number(round)));
  if (others.length) {
    body +=
      `<h2>${c.uk ? "Ця траса в інші роки" : "This circuit in other years"}</h2>` +
      `<p>${others
        .map((r) => c.a(`/calendar/${r.year}/${r.round}`, `${c.uk ? gpTitle(r.grandPrixName, "uk") : `${r.grandPrixName} Grand Prix`} ${r.year}`))
        .join(" · ")}</p>`;
  }
  const n = Number(round);
  const rounds = (await getCalendar(season).catch(() => null))?.races.length ?? 0;
  const links = [
    n > 1 ? c.a(`/calendar/${season}/${n - 1}`, c.uk ? "Попередній етап" : "Previous round") : "",
    n < rounds ? c.a(`/calendar/${season}/${n + 1}`, c.uk ? "Наступний етап" : "Next round") : "",
    c.a(`/calendar/${season}`, c.uk ? `Календар ${season}` : `${season} calendar`),
    c.a(`/standings/${season}`, c.uk ? `Залік ${season}` : `${season} standings`),
  ].filter(Boolean);
  return body + `<p>${links.join(" | ")}</p>`;
}

// A season's review (services/f1db.ts getSeasonReview): champion or leader,
// every round's winner, first wins and the teammate duels.
async function seasonReview(c: Ctx, season: number, current: number): Promise<string | null> {
  const r = await getSeasonReview(season).catch(() => null);
  if (!r) return null;
  const pts = (n: number) => ukPlural(n, ["очко", "очки", "очок", "очка"]);
  const gp = (name: string) => (c.uk ? gpTitle(name, "uk") : `${name} Grand Prix`);
  const team = (id: string | null, name: string | null) => (id && name ? c.a(`/teams/${id}`, name) : "");
  let body = c.uk ? `<h1>Сезон Ф1 ${season}: підсумки</h1>` : `<h1>F1 ${season} season review</h1>`;
  if (!r.final) {
    body += c.uk
      ? `<p>Попередні підсумки: етапів проведено ${r.held} із ${r.rounds}.</p>`
      : `<p>Provisional: ${r.held} of ${r.rounds} rounds run.</p>`;
  }
  const d = r.driver;
  if (d) {
    const link = c.a(`/drivers/${d.id}`, d.name);
    const by = d.constructorName;
    body += c.uk
      ? `<p>${r.driverDecided ? `Титул чемпіона світу: ${link}` : `Лідерство в чемпіонаті: ${link}`}${by ? ` (${esc(by)})` : ""}, ${pts(d.points)}, перемог: ${d.wins}.` +
        (r.decidedAt ? ` Титул вирішено на етапі ${r.decidedAt.round}, ${esc(gp(r.decidedAt.grandPrixName))}.` : "") +
        (r.runnerUp ? ` Друге місце: ${c.a(`/drivers/${r.runnerUp.id}`, r.runnerUp.name)}, ${pts(r.runnerUp.points)}.` : "") +
        `</p>`
      : `<p>${link} ${r.driverDecided ? "won the title" : "leads the championship"}${by ? ` with ${esc(by)}` : ""}: ${d.points} points, ${enPlural(d.wins, "win")}.` +
        (r.decidedAt ? ` The title was settled at round ${r.decidedAt.round}, the ${esc(gp(r.decidedAt.grandPrixName))}.` : "") +
        (r.runnerUp ? ` Runner-up: ${c.a(`/drivers/${r.runnerUp.id}`, r.runnerUp.name)}, ${r.runnerUp.points} points.` : "") +
        `</p>`;
  }
  if (r.team) {
    const link = c.a(`/teams/${r.team.id}`, r.team.name);
    body += c.uk
      ? `<p>${r.final ? "Кубок конструкторів" : "Лідерство серед конструкторів"}: ${link}, ${pts(r.team.points)}, перемог: ${r.team.wins}.</p>`
      : `<p>Constructors' ${r.final ? "champion" : "leader"}: ${link}, ${r.team.points} points, ${enPlural(r.team.wins, "win")}.</p>`;
  }
  body += c.uk
    ? `<p>Гонок: ${r.held}. Різних переможців: ${r.wins.length}. Команд із перемогами: ${r.winningTeams}.</p>`
    : `<p>${enPlural(r.held, "race")}, ${enPlural(r.wins.length, "different winner")}, ${enPlural(r.winningTeams, "winning team")}.</p>`;
  body +=
    `<h2>${c.uk ? "Переможці за етапами" : "Winners by round"}</h2>` +
    table(
      c.uk ? ["Етап", "Гран-прі", "Переможець", "Команда"] : ["Round", "Grand Prix", "Winner", "Team"],
      r.winners.map((w) => [
        String(w.round),
        c.a(`/calendar/${season}/${w.round}`, gp(w.grandPrixName)),
        w.winnerId ? c.a(`/drivers/${w.winnerId}`, w.winnerName!) : esc(c.uk ? "ще попереду" : "to come"),
        team(w.constructorId, w.constructorName),
      ]),
    );
  if (r.firstWins.length) {
    body +=
      `<h2>${c.uk ? "Перші перемоги в кар'єрі" : "First career wins"}</h2>` +
      list(r.firstWins.map((f) => `${c.a(`/drivers/${f.id}`, f.name)}: ${c.a(`/calendar/${season}/${f.round}`, gp(f.grandPrixName))}`));
  }
  if (r.duels.length) {
    body +=
      `<h2>${c.uk ? "Дуелі напарників" : "Teammate battles"}</h2>` +
      list(
        r.duels.map((x) =>
          c.uk
            ? `${c.a(`/teams/${x.constructorId}`, x.constructorName)}: ${esc(x.a.name)} проти ${esc(x.b.name)}, кваліфікації ${x.quali.a}:${x.quali.b}, гонки ${x.race.a}:${x.race.b}`
            : `${c.a(`/teams/${x.constructorId}`, x.constructorName)}: ${esc(x.a.name)} vs ${esc(x.b.name)}, qualifying ${x.quali.a}-${x.quali.b}, races ${x.race.a}-${x.race.b}`,
        ),
      );
  }
  const links = [
    season > 1950 ? c.a(`/seasons/${season - 1}`, c.uk ? `Сезон ${season - 1}` : `${season - 1} season`) : "",
    season < current ? c.a(`/seasons/${season + 1}`, c.uk ? `Сезон ${season + 1}` : `${season + 1} season`) : "",
    c.a(`/standings/${season}`, c.uk ? `Залік ${season}` : `${season} standings`),
    c.a(`/calendar/${season}`, c.uk ? `Календар ${season}` : `${season} calendar`),
  ].filter(Boolean);
  return body + `<p>${links.join(" | ")}</p>`;
}

// "Season review" link under a season's standings and calendar.
async function reviewLink(c: Ctx, season: number): Promise<string> {
  if (!(await hasSeasonReview(season).catch(() => false))) return "";
  return `<p>${c.a(`/seasons/${season}`, c.uk ? `Підсумки сезону ${season}` : `${season} season review`)}</p>`;
}

async function driverList(c: Ctx, season: number, current: number): Promise<string> {
  const st = await getDriverStandings(String(season)).catch(() => null);
  return (
    (c.uk
      ? `<h1>Пілоти Формули-1 ${season}</h1>` +
        `<p>Усі пілоти сезону ${season} з посиланнями на повну статистику кар'єри: титули, перемоги, подіуми й кожен сезон.</p>`
      : `<h1>${season} Formula 1 drivers</h1>` +
        `<p>Every driver on the ${season} grid, with links to full career profiles: titles, wins, podiums and every season.</p>`) +
    list((st?.standings ?? []).map((d) => `${c.a(`/drivers/${d.driverId}`, `${d.givenName} ${d.familyName}`)}, ${c.a(`/teams/${d.constructorId}`, d.constructorName)}`)) +
    seasonNav(c, "/drivers", season, current)
  );
}

async function teamList(c: Ctx, season: number, current: number): Promise<string> {
  const st = await getConstructorStandings(String(season)).catch(() => null);
  return (
    (c.uk
      ? `<h1>Команди Формули-1 ${season}</h1>` +
        `<p>Усі конструктори сезону ${season} з посиланнями на повну історію кожної команди: титули, перемоги й кожен сезон.</p>`
      : `<h1>${season} Formula 1 teams</h1>` +
        `<p>Every constructor on the ${season} grid, with links to full team histories: titles, wins and every season.</p>`) +
    list((st?.standings ?? []).map((t) => c.a(`/teams/${t.constructorId}`, t.name))) +
    seasonNav(c, "/teams", season, current)
  );
}

async function driver(c: Ctx, id: string, current: number): Promise<string | null> {
  const p = await getDriverProfile(id).catch(() => null);
  if (!p) return null;
  const name = `${p.givenName} ${p.familyName}`;
  const teams = [...new Map(p.seasons.map((s) => [s.constructorId, s.constructorName])).entries()].map(([tid, tn]) =>
    c.a(`/teams/${tid}`, tn),
  );
  const active = p.lastSeason >= current;
  let body: string;
  if (c.uk) {
    const country = ukCountry(p.countryCode);
    const span = active ? `з ${p.firstSeason} року` : p.firstSeason === p.lastSeason ? `у ${p.firstSeason} році` : `у ${p.firstSeason}-${p.lastSeason} роках`;
    body =
      `<h1>${esc(name)}: статистика кар'єри у Формулі-1</h1>` +
      `<p>${esc(name)}${country ? ` (${esc(country)})` : ""}: виступи в чемпіонаті світу FIA Формули-1 ${span}.` +
      (teams.length ? ` ${teams.length === 1 ? "Команда" : "Команди"}: ${joinAnd(teams, "і")}.` : "") +
      ` За ${esc(ukPlural(p.races, UK.starts))}: ${esc(ukPlural(p.championships, UK.titles))}, ${esc(ukPlural(p.wins, UK.wins))}, ${esc(ukPlural(p.podiums, UK.podiums))}, ${esc(ukPlural(p.poles, UK.poles))} і ${esc(ukPlural(p.points, UK.points))}.</p>`;
  } else {
    body =
      `<h1>${esc(name)}: Formula 1 career stats</h1>` +
      `<p>${esc(name)} (${esc(p.nationality)}) ${active ? `has raced in the FIA Formula One World Championship since ${p.firstSeason}` : `raced in the FIA Formula One World Championship from ${p.firstSeason} to ${p.lastSeason}`}` +
      (teams.length ? `, driving for ${joinAnd(teams, "and")}` : "") +
      `. ${enPlural(p.championships, "world title")}, ${enPlural(p.wins, "win")}, ${enPlural(p.podiums, "podium")}, ${enPlural(p.poles, "pole position")} and ${p.points} points from ${enPlural(p.races, "race start")}.</p>`;
  }
  body +=
    `<h2>${c.uk ? "По сезонах" : "Season by season"}</h2>` +
    table(
      c.uk ? ["Сезон", "Команда", "Місце", "Перемоги", "Очки"] : ["Season", "Team", "Position", "Wins", "Points"],
      p.seasons
        .slice()
        .reverse()
        .map((s) => [c.a(`/standings/${s.season}`, String(s.season)), c.a(`/teams/${s.constructorId}`, s.constructorName), s.position > 0 ? `P${s.position}` : "", String(s.wins), String(s.points)]),
    );
  return (
    body +
    `<p>${c.a("/compare", c.uk ? "Порівняти з іншим пілотом" : "Compare with another driver")} | ${c.a("/drivers", c.uk ? "Усі пілоти" : "All drivers")}</p>`
  );
}

async function team(c: Ctx, id: string, current: number): Promise<string | null> {
  const p = await getConstructorProfile(id).catch(() => null);
  if (!p) return null;
  const active = p.lastSeason >= current;
  let body: string;
  if (c.uk) {
    const country = ukCountry(p.countryCode);
    const span = active ? `з ${p.firstSeason} року` : p.firstSeason === p.lastSeason ? `у ${p.firstSeason} році` : `у ${p.firstSeason}-${p.lastSeason} роках`;
    body =
      `<h1>${esc(p.name)}: історія, титули й перемоги у Формулі-1</h1>` +
      `<p>${esc(p.name)}${country ? ` (${esc(country)})` : ""}: ${active ? "команда" : "колишня команда"} чемпіонату світу FIA Формули-1 ${span}. ` +
      `За ${esc(ukPlural(p.races, UK.starts))}: ${esc(ukPlural(p.championships, UK.ctitles))}, ${esc(ukPlural(p.wins, UK.wins))}, ${esc(ukPlural(p.podiums, UK.podiums))} і ${esc(ukPlural(p.points, UK.points))}.</p>`;
  } else {
    body =
      `<h1>${esc(p.name)}: Formula 1 history, titles and wins</h1>` +
      `<p>${esc(p.name)} (${esc(p.nationality)}) ${active ? `has competed in the FIA Formula One World Championship since ${p.firstSeason}` : `competed in the FIA Formula One World Championship from ${p.firstSeason} to ${p.lastSeason}`}: ` +
      `${enPlural(p.championships, "constructors' title")}, ${enPlural(p.wins, "win")}, ${enPlural(p.podiums, "podium")} and ${p.points} points from ${enPlural(p.races, "race entry", "race entries")}.</p>`;
  }
  if (p.lineage.length > 1) {
    body += `<p>${c.uk ? "Назви команди" : "Raced as"}: ${p.lineage
      .map((l) => `${c.a(`/teams/${l.constructorId}`, l.name)} (${l.yearFrom}-${l.yearTo ?? (c.uk ? "сьогодні" : "today")})`)
      .join(", ")}.</p>`;
  }
  body +=
    `<h2>${c.uk ? "По сезонах" : "Season by season"}</h2>` +
    table(
      c.uk ? ["Сезон", "Місце", "Перемоги", "Очки", "Пілоти"] : ["Season", "Position", "Wins", "Points", "Drivers"],
      p.seasons
        .slice()
        .reverse()
        .map((s) => [
          c.a(`/standings/${s.season}`, String(s.season)),
          s.position > 0 ? `P${s.position}` : "",
          String(s.wins),
          String(s.points),
          s.drivers.map((d) => c.a(`/drivers/${d.driverId}`, d.name)).join(", "),
        ]),
    );
  return body + `<p>${c.a("/teams", c.uk ? "Усі команди" : "All teams")}</p>`;
}

async function circuitList(c: Ctx): Promise<string> {
  const all = await getCircuits().catch(() => []);
  const current = all.filter((t) => t.onCurrentCalendar);
  const historic = all.filter((t) => !t.onCurrentCalendar && t.outline);
  const item = (t: (typeof all)[number]) =>
    `${c.a(`/circuits/${t.circuitId}`, t.name)}, ${esc(t.placeName)} (${c.uk ? ukPlural(t.racesHeld, UK.grandsPrix) : enPlural(t.racesHeld, "Grand Prix", "Grands Prix")})`;
  return c.uk
    ? `<h1>Траси Формули-1</h1>` +
        `<p>Схеми трас, довжина, повороти, рекорди кола в гонці та всі переможці на кожній.</p>` +
        `<h2>У поточному календарі</h2>${list(current.map(item))}` +
        `<h2>Історичні траси</h2>${list(historic.map(item))}`
    : `<h1>Formula 1 circuits</h1>` +
        `<p>Track maps, length, turns, race lap records and every winner at each venue.</p>` +
        `<h2>On the current calendar</h2>${list(current.map(item))}` +
        `<h2>Historic circuits</h2>${list(historic.map(item))}`;
}

async function circuit(c: Ctx, id: string): Promise<string | null> {
  const t = await getCircuitProfile(id).catch(() => null);
  if (!t) return null;
  const rec = t.lapRecord;
  let body: string;
  if (c.uk) {
    const facts = [
      t.length != null ? `${String(t.length).replace(".", ",")} км` : "",
      t.turns != null ? ukPlural(t.turns, UK.turns) : "",
      ukPlural(t.racesHeld, UK.grandsPrix) + (t.firstYear ? ` з ${t.firstYear} року` : ""),
    ].filter(Boolean);
    const country = ukCountry(t.countryCode);
    body =
      `<h1>${esc(t.name)}: траса, рекорд кола й переможці</h1>` +
      `<p>${esc(t.name)}, ${esc(t.placeName)}${country ? ` (${esc(country)})` : ""}: ${esc(facts.join(", "))}.` +
      (rec ? ` Рекорд кола в гонці: ${esc(rec.time)}, ${c.a(`/drivers/${rec.driverId}`, rec.driverName)} (${c.a(`/teams/${rec.constructorId}`, rec.constructorName)}, ${rec.year}).` : "") +
      (t.nextRace ? ` Наступна гонка тут: ${c.a(`/calendar/${t.nextRace.season}/${t.nextRace.round}`, gpTitle(t.nextRace.grandPrixName, "uk"))}, ${esc(c.date(t.nextRace.date))}.` : "") +
      `</p>`;
  } else {
    const facts = [t.length != null ? `${t.length} km` : "", t.turns != null ? `${t.turns} turns` : "", enPlural(t.racesHeld, "Grand Prix", "Grands Prix") + (t.firstYear ? ` since ${t.firstYear}` : "")].filter(Boolean);
    body =
      `<h1>${esc(t.name)}: circuit guide, lap record and winners</h1>` +
      `<p>${esc(t.name)} in ${esc(t.placeName)}: ${esc(facts.join(", "))}.` +
      (rec ? ` Race lap record: ${esc(rec.time)} by ${c.a(`/drivers/${rec.driverId}`, rec.driverName)} (${c.a(`/teams/${rec.constructorId}`, rec.constructorName)}, ${rec.year}).` : "") +
      (t.nextRace ? ` Next race here: ${c.a(`/calendar/${t.nextRace.season}/${t.nextRace.round}`, `${t.nextRace.grandPrixName} Grand Prix`)}, ${esc(c.date(t.nextRace.date))}.` : "") +
      `</p>`;
  }
  if (t.topDrivers.length) {
    body += `<h2>${c.uk ? "Найбільше перемог" : "Most wins"}</h2>` + list(t.topDrivers.map((d) => `${c.a(`/drivers/${d.id}`, d.name)}: ${d.count}`));
  }
  if (t.topConstructors.length) {
    body += `<h2>${c.uk ? "Найбільше перемог: команди" : "Most wins by team"}</h2>` + list(t.topConstructors.map((d) => `${c.a(`/teams/${d.id}`, d.name)}: ${d.count}`));
  }
  if (t.races.length) {
    body +=
      `<h2>${c.uk ? "Переможці" : "Winners"}</h2>` +
      table(
        c.uk ? ["Рік", "Гран-прі", "Переможець", "Команда"] : ["Year", "Grand Prix", "Winner", "Team"],
        t.races.map((r) => [
          c.a(`/calendar/${r.year}/${r.round}`, String(r.year)),
          esc(c.uk ? gpTitle(r.grandPrixName, "uk") : r.grandPrixName),
          r.winnerDriverId ? c.a(`/drivers/${r.winnerDriverId}`, r.winnerName ?? "") : "",
          r.winnerConstructorId ? c.a(`/teams/${r.winnerConstructorId}`, r.winnerConstructorName ?? "") : "",
        ]),
      );
  }
  return body + `<p>${c.a("/circuits", c.uk ? "Усі траси" : "All circuits")}</p>`;
}

// Short pages: their heading, a line, and the site's sections (in the frame).
const STATIC: Record<string, { en: [string, string]; uk: [string, string] }> = {
  compare: {
    en: ["Compare Formula 1 drivers head to head", "Championships, wins, podiums, points and race-by-race record of any two drivers, over a career or a single season."],
    uk: ["Порівняння пілотів Ф1", "Титули, перемоги, подіуми, очки та очні дуелі двох будь-яких пілотів за кар'єру або окремий сезон."],
  },
  live: {
    en: ["Formula 1 live timing and race replays", "Positions, gaps, lap times, sectors and tyres during a session, and replays of every session since 2023 with a track map."],
    uk: ["Live-таймінг і повтори гонок Формули-1", "Позиції, відставання, час кіл, сектори й шини під час сесії та повтори кожної сесії з 2023 року з мапою траси."],
  },
  telemetry: {
    en: ["Formula 1 telemetry", "Speed, throttle, brake, gear and DRS traces lap by lap, from 2023 onward."],
    uk: ["Телеметрія Формули-1", "Швидкість, газ, гальма, передача та DRS по колах, з 2023 року."],
  },
  about: {
    en: ["About Paddock Times", "An independent, fan-made Formula 1 statistics site. Data from f1db (CC BY 4.0), OpenF1 and Wikimedia Commons."],
    uk: ["Про Paddock Times", "Незалежний фанатський сайт зі статистикою Формули-1. Дані з f1db (CC BY 4.0), OpenF1 і Wikimedia Commons."],
  },
  privacy: {
    en: ["Privacy policy", "How Paddock Times handles data: analytics with consent, what is stored in your browser, the feedback form and hosting."],
    uk: ["Політика конфіденційності", "Як Paddock Times працює з даними: аналітика за згодою, що зберігається у браузері, форма відгуку та хостинг."],
  },
  support: {
    en: ["Support Paddock Times", "Paddock Times is free, with no ads and no accounts. Donations help pay for hosting and development."],
    uk: ["Підтримати Paddock Times", "Сайт Paddock Times безкоштовний, без реклами й облікових записів. Донати допомагають оплачувати хостинг і розробку."],
  },
  feedback: {
    en: ["Feedback", "Report a bug or suggest a feature for Paddock Times."],
    uk: ["Відгук", "Повідомте про помилку чи запропонуйте функцію для Paddock Times."],
  },
};

async function articleList(c: Ctx): Promise<string> {
  const lang: Lang = c.uk ? "uk" : "en";
  const items = (await listArticles(lang)).map(
    (a) => `${c.a(`/articles/${a.slug}`, a.title)}. ${esc(c.date(a.date))}. ${esc(a.description)}`,
  );
  return (
    `<h1>${c.uk ? "Статті про Формулу-1" : "Formula 1 articles"}</h1>` +
    `<p>${c.uk ? "Розбори кожного дня гоночного вікенду, аналітика і матеріали між етапами." : "A look at every day of the race weekend, analysis and stories between rounds."}</p>` +
    list(items)
  );
}

// The whole article: crawlers get the same text people read.
async function article(c: Ctx, slug: string): Promise<string | null> {
  const lang: Lang = c.uk ? "uk" : "en";
  const a = await getArticle(slug, lang);
  if (!a) return null;
  const gp = a.grandPrixName && a.round ? c.a(`/calendar/${a.season}/${a.round}`, gpTitle(a.grandPrixName, lang)) : "";
  return (
    `<article><h1>${esc(a.title)}</h1>` +
    `<p>${esc(TAG_LABEL[lang][a.tag])}. ${esc(c.date(a.date))}.${gp ? ` ${gp}.` : ""}</p>` +
    `<p>${esc(a.description)}</p>${a.html}</article>` +
    (a.related.length
      ? `<h2>${c.uk ? "Читайте також" : "Read next"}</h2>` + list(a.related.map((r) => c.a(`/articles/${r.slug}`, r.title)))
      : "")
  );
}

// The "not found" page (an address that leads nowhere, sent with status 404):
// what happened and the way back to the site's sections.
export function notFoundSnapshot(lang: Lang): string {
  const c = ctx(lang);
  return frame(
    c,
    c.uk
      ? `<h1>Сторінку не знайдено</h1><p>За цією адресою на Paddock Times нічого немає. Можливо, в ній помилка або сторінку перенесли.</p>`
      : `<h1>Page not found</h1><p>There is no page at this address on Paddock Times. It may be mistyped, or the page has moved.</p>`,
  );
}

// The snapshot for a page path (without the /uk prefix) in the given
// language, or "" when there is nothing to show (an unknown path, or data
// that failed to load).
export async function pageSnapshot(rawPath: string, lang: Lang = "en"): Promise<string> {
  const parts = rawPath.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  const [section, x, y] = parts;
  const current = await getCurrentSeason();
  const c = ctx(lang, current);
  const seasonOf = (s: string | undefined) => (isSeason(s) ? Number(s) : current);
  let body: string | null = null;
  switch (section) {
    case undefined:
      body = await home(c);
      break;
    case "standings":
      body = (await standings(c, seasonOf(x), current)) + (await reviewLink(c, seasonOf(x)));
      break;
    case "seasons":
      body = isSeason(x) ? await seasonReview(c, Number(x), current) : null;
      break;
    case "calendar":
      body =
        isSeason(x) && y && /^\d+$/.test(y)
          ? await race(c, x!, y)
          : (await calendar(c, seasonOf(x), current)) + (await reviewLink(c, seasonOf(x)));
      break;
    case "drivers":
      body = x && !isSeason(x) ? await driver(c, x, current) : await driverList(c, seasonOf(x), current);
      break;
    case "teams":
      body = x && !isSeason(x) ? await team(c, x, current) : await teamList(c, seasonOf(x), current);
      break;
    case "circuits":
      body = x ? await circuit(c, x) : await circuitList(c);
      break;
    case "articles":
      body = x ? await article(c, x) : await articleList(c);
      break;
    default:
      if (section && STATIC[section] && !x) {
        const [h, p] = STATIC[section][c.uk ? "uk" : "en"];
        body = `<h1>${esc(h)}</h1><p>${esc(p)}</p>`;
      }
  }
  return body ? frame(c, body) : "";
}
