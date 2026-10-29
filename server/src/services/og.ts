import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { circuitOutline } from "./circuitOutlines";
import {
  getCalendar,
  getCircuitProfile,
  getConstructorProfile,
  getCurrentSeason,
  getDriverProfile,
  getDriverStandings,
  getRaceWeekend,
} from "./f1db";
import type { CircuitOutline } from "../types/f1";
import { gpTitle, type Lang } from "./gpNames";
import { UK, ukCountry, ukPlural } from "./ukText";

// Link previews (Open Graph / Twitter cards). Social crawlers don't run our
// JavaScript, so the server works out each page's title, description and a
// 1200×630 preview image from the URL. `describePage` is shared by the HTML
// meta injection and the /og/<page path>.png image route.

export const SITE = "Paddock Times";
const DEFAULT_TITLE = `${SITE}: Formula 1 Standings, Calendar & Stats`;
const BASE_DESC =
  "Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and past-race telemetry — every season from 1950 to today.";

// Mirror of client/src/lib/f1meta.ts, keyed by f1db constructorId.
const TEAM_COLOR: Record<string, string> = {
  "red-bull": "#3671C6",
  ferrari: "#E8002D",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  "aston-martin": "#229971",
  alpine: "#0093CC",
  williams: "#64C4FF",
  rb: "#6692FF",
  "racing-bulls": "#6692FF",
  alphatauri: "#2B4562",
  "kick-sauber": "#52E252",
  sauber: "#52E252",
  "alfa-romeo": "#C92D4B",
  audi: "#BB0A30",
  haas: "#B6BABD",
  cadillac: "#C9B037",
};
const teamColor = (id: string) => TEAM_COLOR[id] ?? "#9a9aa8";

type Card =
  | { kind: "default"; title: string; subtitle: string; kicker?: string }
  | { kind: "circuit"; country: string; place: string; name: string; facts: string[]; record: string | null; outline: CircuitOutline | null }
  | { kind: "race"; kicker: string; title: string; podium: { pos: number; name: string; team: string; color: string }[]; note: string | null; outline: CircuitOutline | null }
  | { kind: "driver"; first: string; last: string; meta: string; number: string | null; color: string; stats: [string, string][] }
  | { kind: "team"; name: string; meta: string; color: string; stats: [string, string][] }
  | { kind: "standings"; heading: string; rows: { pos: number; name: string; points: number; color: string }[] };

export interface PageMeta {
  title: string; // full <title>
  description: string;
  card: Card;
}

const DEFAULT_TITLE_UK = `${SITE}: залік Ф1, календар і статистика Формули-1`;
const BASE_DESC_UK =
  "Залік Формули-1 (Ф1), календар гонок, статистика кар'єри пілотів і команд, порівняння та телеметрія: кожен сезон з 1950 року до сьогодні.";

// Titles and descriptions follow the page's language (Ukrainian pages live
// at /uk/…); the preview card's text stays English for now.
const page = (title: string | null, description: string, card: Card, lang: Lang = "en"): PageMeta => ({
  title: title ? `${title} · ${SITE}` : lang === "uk" ? DEFAULT_TITLE_UK : DEFAULT_TITLE,
  description,
  card,
});

const isSeason = (s: string | undefined) => !!s && /^\d{4}$/.test(s);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Page path → meta + preview card. Unknown paths get the site defaults.
export async function describePage(rawPath: string, lang: Lang = "en"): Promise<PageMeta> {
  const uk = lang === "uk";
  const pg = (title: string | null, description: string, card: Card) => page(title, description, card, lang);
  const parts = rawPath.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  const [section, a, b] = parts;
  const current = String(await getCurrentSeason());
  const generic = (title: string, description: string, subtitle = description) =>
    pg(title, description, { kind: "default", title, subtitle });

  switch (section) {
    case undefined:
      return pg(null, uk ? BASE_DESC_UK : BASE_DESC, {
        kind: "default",
        title: "Paddock Times",
        subtitle: uk
          ? "Залік, календар, статистика пілотів і команд, телеметрія та повтори гонок з 1950 року до сьогодні."
          : "Standings, calendar, driver & team stats, telemetry and race replays — 1950 to today.",
      });

    case "standings": {
      const season = isSeason(a) ? a! : current;
      const st = await getDriverStandings(season).catch(() => null);
      const rows = (st?.standings ?? []).slice(0, 5).map((d) => ({
        pos: d.position,
        name: `${d.givenName} ${d.familyName}`,
        points: d.points,
        color: teamColor(d.constructorId),
      }));
      const title = uk ? `Залік Ф1 ${season}: пілоти й конструктори Формули-1` : `${season} F1 Championship Standings`;
      const description = uk
        ? `Залік пілотів і Кубок конструкторів Формули-1 сезону ${season}: очки, перемоги та відставання від лідера.`
        : `Formula 1 drivers' and constructors' championship standings for the ${season} season: points, wins and gaps to the leader.`;
      return rows.length ? pg(title, description, { kind: "standings", heading: uk ? `Чемпіонат ${season}` : `${season} championship`, rows }) : generic(title, description);
    }

    case "calendar": {
      if (isSeason(a) && b && /^\d+$/.test(b)) {
        const w = await getRaceWeekend(a!, b).catch(() => null);
        if (w) {
          const outline = circuitOutline(w.circuitId);
          const podium = w.results
            .filter((r) => ["1", "2", "3"].includes(r.positionText))
            .map((r) => ({ pos: Number(r.positionText), name: r.driverName, team: r.constructorName, color: teamColor(r.constructorId) }));
          const gpUk = gpTitle(w.grandPrixName, "uk");
          return pg(
            uk
              ? `${gpUk} ${w.season}: результати Ф1, кваліфікація й практики`
              : `${w.grandPrixName} GP ${w.season}: Results, Qualifying & Practice`,
            uk
              ? `${gpUk} ${w.season}: повний результат гонки, стартова решітка, час кваліфікації, практики${w.sprintResults.length ? ", спринт" : ""}, найшвидше коло та пілот дня.`
              : `${w.grandPrixName} Grand Prix ${w.season}: full race result, starting grid, qualifying times, practice sessions${w.sprintResults.length ? ", sprint" : ""}, fastest lap and Driver of the Day.`,
            {
              kind: "race",
              kicker: uk
                ? `${w.season} · Етап ${w.round} · ${new Date(w.date).toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}`
                : `${w.season} · Round ${w.round} · ${fmtDate(w.date)}`,
              title: uk ? gpUk : `${w.grandPrixName} GP`,
              podium,
              note: podium.length ? null : w.circuitName,
              outline,
            },
          );
        }
      }
      const season = isSeason(a) ? a! : current;
      const cal = await getCalendar(season).catch(() => null);
      const n = cal?.races.length ?? 0;
      return generic(
        uk ? `Календар Ф1 ${season}: гонки й результати Формули-1` : `${season} F1 Race Calendar & Results`,
        uk
          ? `Календар гонок Формули-1 ${season} року з переможцями, командами та повними результатами кожного Гран-прі.`
          : `The ${season} Formula 1 race calendar with winners, teams and full results for every Grand Prix.`,
        n ? `${n} Grands Prix — winners, results and weekend schedules.` : undefined,
      );
    }

    case "drivers": {
      if (a && !isSeason(a)) {
        const p = await getDriverProfile(a).catch(() => null);
        if (p) {
          const lastTeam = p.seasons[p.seasons.length - 1]?.constructorId ?? "";
          const name = `${p.givenName} ${p.familyName}`;
          return pg(
            uk ? `${name}: статистика кар'єри у Ф1` : `${name}: F1 Career Stats`,
            uk
              ? `${name} у Формулі-1: ${ukPlural(p.championships, UK.titles)}, ${ukPlural(p.wins, UK.wins)}, ${ukPlural(p.podiums, UK.podiums)} і ${ukPlural(p.races, UK.races)} у ${p.firstSeason}-${p.lastSeason} роках.`
              : `${name}'s Formula 1 career: ${p.championships} title${p.championships === 1 ? "" : "s"}, ${p.wins} wins, ${p.podiums} podiums and ${p.races} races from ${p.firstSeason} to ${p.lastSeason}.`,
            {
              kind: "driver",
              first: p.givenName,
              last: p.familyName,
              meta: [uk ? ukCountry(p.countryCode) : p.nationality, `${p.firstSeason}–${p.lastSeason}`].filter(Boolean).join(" · "),
              number: p.permanentNumber,
              color: teamColor(lastTeam),
              stats: [
                [uk ? "Титули" : "Titles", String(p.championships)],
                [uk ? "Перемоги" : "Wins", String(p.wins)],
                [uk ? "Подіуми" : "Podiums", String(p.podiums)],
                [uk ? "Гонки" : "Races", String(p.races)],
              ],
            },
          );
        }
      }
      const season = isSeason(a) ? a! : current;
      return generic(
        uk ? `Пілоти Ф1 ${season}: склад Формули-1` : `${season} F1 Drivers`,
        uk
          ? `Усі пілоти Формули-1 сезону ${season} і пошук серед усіх пілотів з 1950 року, з посиланнями на повну статистику кар'єри.`
          : `Every Formula 1 driver on the ${season} grid, plus a searchable index of every driver since 1950, with links to full career profiles.`,
      );
    }

    case "teams": {
      if (a && !isSeason(a)) {
        const p = await getConstructorProfile(a).catch(() => null);
        if (p) {
          return pg(
            uk ? `${p.name}: історія, титули й перемоги у Ф1` : `${p.name}: F1 History, Titles & Wins`,
            uk
              ? `${p.name} у Формулі-1: ${ukPlural(p.championships, UK.ctitles)}, ${ukPlural(p.wins, UK.wins)}, ${ukPlural(p.podiums, UK.podiums)} і ${ukPlural(p.races, UK.races)} з ${p.firstSeason} року.`
              : `${p.name} in Formula 1: ${p.championships} constructors' title${p.championships === 1 ? "" : "s"}, ${p.wins} wins, ${p.podiums} podiums and ${p.races} races since ${p.firstSeason}.`,
            {
              kind: "team",
              name: p.name,
              meta: [uk ? ukCountry(p.countryCode) : p.nationality, `${p.firstSeason}–${p.lastSeason}`].filter(Boolean).join(" · "),
              color: teamColor(p.constructorId),
              stats: [
                [uk ? "Кубки" : "Titles", String(p.championships)],
                [uk ? "Перемоги" : "Wins", String(p.wins)],
                [uk ? "Подіуми" : "Podiums", String(p.podiums)],
                [uk ? "Гонки" : "Races", String(p.races)],
              ],
            },
          );
        }
      }
      const season = isSeason(a) ? a! : current;
      return generic(
        uk ? `Команди Ф1 ${season}: конструктори Формули-1` : `${season} F1 Teams & Constructors`,
        uk
          ? `Усі конструктори Формули-1 сезону ${season} і пошук серед усіх команд з 1950 року, з посиланнями на повну історію кожної.`
          : `Formula 1 constructors on the ${season} grid, plus a searchable index of every constructor since 1950, with links to full team histories.`,
      );
    }

    case "circuits": {
      if (a) {
        const c = await getCircuitProfile(a).catch(() => null);
        if (c) {
          const country = c.countryCode
            ? new Intl.DisplayNames(["en"], { type: "region" }).of(c.countryCode.toUpperCase()) ?? ""
            : "";
          const facts = [
            c.length ? `${c.length} km` : null,
            c.turns ? `${c.turns} turns` : null,
            `${c.racesHeld} Grands Prix`,
          ].filter((x): x is string => !!x);
          const ukFacts = [
            c.length != null ? `${String(c.length).replace(".", ",")} км` : "",
            c.turns != null ? ukPlural(c.turns, UK.turns) : "",
            `${c.racesHeld} Гран-прі Формули-1${c.firstYear ? ` з ${c.firstYear} року` : ""}`,
          ].filter(Boolean);
          if (uk) {
            return pg(
              `${c.name}: траса Ф1, рекорд кола й переможці`,
              `${c.name} (${c.placeName}${ukCountry(c.countryCode) ? `, ${ukCountry(c.countryCode)}` : ""}): ${ukFacts.join(", ")}. Рекорд кола в гонці, найуспішніші пілоти й команди та всі переможці.`,
              {
                kind: "circuit",
                country: ukCountry(c.countryCode),
                place: c.placeName,
                name: c.name,
                facts: ukFacts.map((f) => f.replace(/ Гран-прі Формули-1.*$/, " Гран-прі")),
                record: c.lapRecord ? `Рекорд кола ${c.lapRecord.time}, ${c.lapRecord.driverName}, ${c.lapRecord.year}` : null,
                outline: c.outline,
              },
            );
          }
          return pg(
            `${c.name}: F1 Circuit Guide, Lap Record & Winners`,
            `${c.name} (${c.placeName}): ${[
              c.length != null ? `${c.length} km` : "",
              c.turns != null ? `${c.turns} turns` : "",
              `${c.racesHeld} Formula 1 Grands Prix${c.firstYear ? ` since ${c.firstYear}` : ""}`,
            ]
              .filter(Boolean)
              .join(", ")}. Race lap record, most successful drivers and teams, and every winner.`,
            {
              kind: "circuit",
              country,
              place: c.placeName,
              name: c.name,
              facts,
              record: c.lapRecord ? `Lap record ${c.lapRecord.time} — ${c.lapRecord.driverName}, ${c.lapRecord.year}` : null,
              outline: c.outline,
            },
          );
        }
      }
      return uk
        ? generic(
            "Траси Ф1: схеми, рекорди кола й переможці Формули-1",
            "Траси Формули-1 з поточного календаря та класичні: схеми, довжина, повороти, рекорди кола, конфігурації та всі переможці на кожній.",
          )
        : generic(
            "F1 Circuits: Track Maps, Lap Records & Winners",
            "Formula 1 circuits on the current calendar and classic tracks: track maps, length, turns, race lap records, layouts and every winner at each venue.",
          );
    }

    case "compare":
      if (uk) return generic("Порівняння пілотів Ф1", "Порівняйте двох будь-яких пілотів Формули-1: титули, перемоги, подіуми, очки та очні дуелі за кар'єру або окремий сезон.");
      return generic(
        "F1 Driver Comparison: Head to Head",
        "Compare any two Formula 1 drivers head-to-head: championships, wins, podiums, points and their race-by-race record, over a career or a single season.",
      );
    case "live":
      if (uk) return generic("Live-таймінг Ф1", "Live-таймінг Формули-1: позиції, відставання, час кіл, сектори, мінісектори та шини з деталями по кожному пілоту.", "Live-таймінг і повтори гонок з мапою траси: кожна сесія з 2023 року.");
      return generic(
        "Live Timing",
        "Live Formula 1 timing board: positions, gaps, lap times, sectors, mini-sectors and tyres, with expandable per-driver detail.",
        "Live timing and race replays with a track map — every session since 2023.",
      );
    case "telemetry":
      if (uk) return generic("Телеметрія Ф1: швидкість, газ і гальма", "Телеметрія гонок Формули-1: швидкість, газ, гальма, передача та DRS по колах, з 2023 року (OpenF1).");
      return generic(
        "F1 Telemetry: Speed, Throttle & Lap Traces",
        "Past-race Formula 1 telemetry: speed, throttle, brake, gear and DRS traces lap by lap, from 2023 onward (OpenF1).",
      );
    case "about":
      if (uk) return generic("Про проєкт", "Про Paddock Times: незалежний фанатський сайт зі статистикою Формули-1, звідки дані (f1db, OpenF1, Wikimedia Commons), точність і незалежність.", "Незалежний фанатський сайт зі статистикою Формули-1.");
      return generic(
        "About",
        "About Paddock Times: an independent, fan-made Formula 1 statistics site: where the data comes from (f1db, OpenF1, Wikimedia Commons), accuracy and independence.",
        "An independent, fan-made Formula 1 statistics site.",
      );
    case "privacy":
      if (uk) return generic("Політика конфіденційності", "Як Paddock Times працює з даними: Google Analytics, що зберігається у браузері, форма відгуку, сторонній контент і хостинг.", "Як Paddock Times працює з даними.");
      return generic(
        "Privacy Policy",
        "How Paddock Times handles data: Google Analytics, what is stored in your browser, the feedback form, third-party content and hosting.",
        "How Paddock Times handles data.",
      );
    case "support":
      if (uk) return generic("Підтримати Paddock Times", "Сайт Paddock Times безкоштовний, без реклами й облікових записів. Донати допомагають оплачувати хостинг і розробку.", "Безкоштовно, без реклами й облікових записів.");
      return generic(
        "Support Paddock Times",
        "Paddock Times is free, with no ads and no accounts. Donations help pay for hosting and development.",
        "Free, no ads, no accounts — donations keep it running.",
      );
    case "feedback":
      if (uk) return generic("Відгук", "Надішліть відгук, повідомте про помилку чи запропонуйте функцію для Paddock Times.");
      return generic("Feedback", "Send feedback, report a bug or suggest a feature for Paddock Times.");
    default:
      return pg(null, uk ? BASE_DESC_UK : BASE_DESC, {
        kind: "default",
        title: "Paddock Times",
        subtitle: uk ? "Статистика Формули-1 з 1950 року до сьогодні." : "Formula 1 stats, 1950 to today.",
      });
  }
}

// ---------- Drawing (SVG → PNG) ----------

const W = 1200;
const H = 630;
const BG = "#0e0e13";
const CARD = "#16161f";
const TEXT = "#f4f4f6";
const MUTED = "#9a9aa8";
const ACCENT = "#e10600";
const FONT = "Saira Condensed";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Greedy word wrap by character count (good enough for a condensed face).
function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "").replace(/[,:;]$/, "") + "…";
  }
  return lines;
}

const text = (x: number, y: number, s: string, size: number, weight: number, fill: string, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(s)}</text>`;

// The shared frame: background, brand mark, red rule and the site address.
function frame(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${ACCENT}"/>
  <rect x="64" y="52" width="58" height="36" rx="6" fill="${ACCENT}"/>
  ${text(93, 80, "PT", 28, 800, "#fff", 'font-style="italic" text-anchor="middle"')}
  ${text(134, 80, "PADDOCK TIMES", 28, 800, TEXT, 'font-style="italic" letter-spacing="1"')}
  ${inner}
  ${text(64, H - 44, "f1-dashboard-bryzhak.onrender.com", 22, 600, MUTED)}
</svg>`;
}

// A circuit outline fitted into a box, with a white start dot.
function outlineInBox(o: CircuitOutline, x: number, y: number, w: number, h: number, stroke = 9): string {
  const pad = 30;
  const k = Math.min((w - pad * 2) / o.w, (h - pad * 2) / o.h);
  const ox = x + (w - o.w * k) / 2;
  const oy = y + (h - o.h * k) / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${CARD}"/>
  <g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${k.toFixed(4)})">
    <path d="${o.d}" fill="none" stroke="${ACCENT}" stroke-width="${(stroke / k).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${o.start[0]}" cy="${o.start[1]}" r="${(stroke * 1.1 / k).toFixed(3)}" fill="#fff"/>
  </g>`;
}

function statTiles(stats: [string, string][], x: number, y: number, w: number): string {
  const gap = 18;
  const tw = (w - gap * (stats.length - 1)) / stats.length;
  return stats
    .map(([label, value], i) => {
      const tx = x + i * (tw + gap);
      return `<rect x="${tx}" y="${y}" width="${tw}" height="120" rx="16" fill="${CARD}"/>
      ${text(tx + 24, y + 70, value, 56, 800, TEXT)}
      ${text(tx + 24, y + 102, label.toUpperCase(), 20, 600, MUTED, 'letter-spacing="2"')}`;
    })
    .join("");
}

function draw(card: Card, lang: Lang): string {
  switch (card.kind) {
    case "default": {
      // Wrap so the title clears the circuit drawings on the right
      // (Cyrillic capitals run wider, so sooner in Ukrainian).
      const lines = wrap(card.title.toUpperCase(), lang === "uk" ? 15 : 18, 3);
      // Three title lines leave room for one line of subtitle above the
      // site address.
      const sub = wrap(card.subtitle, 58, lines.length >= 3 ? 1 : 3);
      const decor = ["monaco", "silverstone", "suzuka", "spa-francorchamps"]
        .map((id) => circuitOutline(id))
        .filter((o): o is CircuitOutline => !!o)
        .map((o, i) => {
          const bx = 820 + (i % 2) * 180;
          const by = 150 + Math.floor(i / 2) * 170;
          const k = Math.min(150 / o.w, 130 / o.h);
          return `<g transform="translate(${bx} ${by}) scale(${k.toFixed(4)})" opacity="0.55"><path d="${o.d}" fill="none" stroke="${ACCENT}" stroke-width="${(5 / k).toFixed(3)}" stroke-linejoin="round"/></g>`;
        })
        .join("");
      return frame(`
        ${decor}
        ${lines.map((l, i) => text(64, 230 + i * 92, l, 96, 800, i === lines.length - 1 && lines.length > 1 ? ACCENT : TEXT)).join("")}
        ${sub.map((l, i) => text(64, 230 + lines.length * 92 + 20 + i * 40, l, 32, 500, MUTED)).join("")}
      `);
    }
    case "circuit": {
      const name = wrap(card.name, 30, 2);
      return frame(`
        ${text(64, 210, card.country.toUpperCase(), 84, 800, ACCENT)}
        ${text(64, 268, card.place.toUpperCase(), 44, 700, TEXT, 'letter-spacing="2"')}
        ${name.map((l, i) => text(64, 330 + i * 40, l, 34, 600, MUTED)).join("")}
        ${text(64, 450, card.facts.join("  ·  "), 34, 700, TEXT)}
        ${card.record ? text(64, 500, card.record, 28, 600, MUTED) : ""}
        ${card.outline ? outlineInBox(card.outline, 640, 120, 496, 420) : ""}
      `);
    }
    case "race": {
      // Short titles fill one big line; long ones (Ukrainian "Гран-прі
      // Великої Британії") take two smaller lines that clear the podium.
      const upper = card.title.toUpperCase();
      const oneLine = upper.length <= (lang === "uk" ? 12 : 16);
      const title = oneLine ? [upper] : wrap(upper, lang === "uk" ? 18 : 22, 2);
      const tSize = oneLine ? 88 : 60;
      const tY = oneLine ? 230 : 205;
      const podium = card.podium
        .map((p, i) => {
          const y = 330 + i * 64;
          return `<rect x="64" y="${y - 40}" width="8" height="48" rx="3" fill="${p.color}"/>
          ${text(92, y, `P${p.pos}`, 34, 800, i === 0 ? ACCENT : MUTED)}
          ${text(160, y, p.name, 38, 700, TEXT)}
          ${text(640, y, p.team, 26, 600, MUTED, 'text-anchor="end"')}`;
        })
        .join("");
      return frame(`
        ${text(64, 150, card.kicker.toUpperCase(), 26, 700, MUTED, 'letter-spacing="2"')}
        ${title.map((l, i) => text(64, tY + i * (tSize + 2), l, tSize, 800, TEXT)).join("")}
        ${podium || (card.note ? text(64, 360, card.note, 34, 600, MUTED) : "")}
        ${card.outline ? outlineInBox(card.outline, 700, 120, 436, 420) : ""}
      `);
    }
    case "driver": {
      const last = card.last.toUpperCase();
      const lastSize = last.length > 12 ? 92 : 118;
      const number = card.number
        ? text(1136, 470, card.number, 380, 800, "none", `text-anchor="end" stroke="${card.color}" stroke-width="6" opacity="0.9"`)
        : "";
      return frame(`
        ${number}
        <rect x="64" y="132" width="10" height="190" rx="4" fill="${card.color}"/>
        ${text(96, 186, card.first, 50, 600, TEXT)}
        ${text(96, 186 + lastSize, last, lastSize, 800, TEXT)}
        ${text(96, 360, card.meta, 30, 600, MUTED)}
        ${statTiles(card.stats, 64, 400, 720)}
      `);
    }
    case "team": {
      const name = wrap(card.name.toUpperCase(), 18, 2);
      return frame(`
        <rect x="${W - 300}" y="8" width="300" height="${H - 8}" fill="${card.color}" opacity="0.18"/>
        <rect x="${W - 300}" y="8" width="14" height="${H - 8}" fill="${card.color}"/>
        ${text(W - 143, 450, card.name.charAt(0).toUpperCase(), 360, 800, "none", `text-anchor="middle" stroke="${card.color}" stroke-width="6"`)}
        <rect x="64" y="132" width="10" height="${name.length * 100}" rx="4" fill="${card.color}"/>
        ${name.map((l, i) => text(96, 214 + i * 100, l, 100, 800, TEXT)).join("")}
        ${text(96, 214 + name.length * 100 - 30, card.meta, 30, 600, MUTED)}
        ${statTiles(card.stats, 64, 400, 760)}
      `);
    }
    case "standings": {
      const top = Math.max(card.rows[0]?.points ?? 1, 1);
      const rows = card.rows
        .map((r, i) => {
          const y = 230 + i * 62;
          const barW = Math.max(12, (r.points / top) * 480);
          return `${text(64, y, String(r.pos), 36, 800, i === 0 ? ACCENT : MUTED)}
          ${text(120, y, r.name, 36, 700, TEXT)}
          <rect x="520" y="${y - 22}" width="${barW.toFixed(1)}" height="14" rx="7" fill="${r.color}"/>
          ${text(1136, y, String(r.points), 36, 800, TEXT, 'text-anchor="end"')}`;
        })
        .join("");
      return frame(`
        ${text(64, 160, card.heading.toUpperCase(), 64, 800, TEXT)}
        ${rows}
      `);
    }
  }
}

const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");
const WEIGHTS = ["Medium", "SemiBold", "Bold", "ExtraBold"];
// Saira Condensed has no Cyrillic, so Ukrainian cards are set in Fira Sans
// Extra Condensed (OFL, assets/fonts/OFL-FiraSansExtraCondensed.txt), a
// condensed sans of the same build.
const FONT_UK = "Fira Sans Extra Condensed";
const FONTS = [
  ...WEIGHTS.map((w) => path.join(FONT_DIR, `SairaCondensed-${w}.ttf`)),
  ...WEIGHTS.map((w) => path.join(FONT_DIR, `FiraSansExtraCondensed-${w}.ttf`)),
];

export function renderCard(card: Card, lang: Lang = "en"): Buffer {
  let svg = draw(card, lang);
  if (lang === "uk") svg = svg.split(`font-family="${FONT}"`).join(`font-family="${FONT_UK}"`);
  const png = new Resvg(svg, {
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: lang === "uk" ? FONT_UK : FONT },
    fitTo: { mode: "width", value: W },
  })
    .render()
    .asPng();
  return Buffer.from(png);
}

// Small in-memory cache of rendered previews (they only change after a race).
const cache = new Map<string, { at: number; png: Buffer }>();
const TTL = 6 * 3600 * 1000;
const MAX = 300;

// pagePath may carry the /uk prefix: the Ukrainian page's card.
export async function previewPng(pagePath: string): Promise<Buffer> {
  const hit = cache.get(pagePath);
  if (hit && Date.now() - hit.at < TTL) return hit.png;
  const lang: Lang = /^\/uk(?=\/|$)/.test(pagePath) ? "uk" : "en";
  const bare = pagePath.replace(/^\/uk(?=\/|$)/, "") || "/";
  const meta = await describePage(bare, lang);
  const png = renderCard(meta.card, lang);
  if (cache.size >= MAX) cache.delete(cache.keys().next().value as string);
  cache.set(pagePath, { at: Date.now(), png });
  return png;
}
