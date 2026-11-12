import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { cached } from "../cache/cache";
import type { RaceWeekend, SessionHero } from "../types/f1";
import { gpTitle } from "./gpNames";
import { teamColor } from "./og";
import { driverPortraitUrl } from "./portraits";
import { getRaceWeekendNow } from "./provisional";
import { UK_DRIVER_NAMES } from "./ukNames";

// A session's result as a picture for the Telegram channel (1080×1350, the
// 4:5 of a phone post): the top three on a podium with their formula1.com
// portraits, then P4 to P10, in the site's look. The owner chose the official
// portraits for the channel's cards (2026-11-09), knowing a complaint from
// Formula 1 could take a post down; a driver without one gets an empty panel.
// Built from the race weekend (f1db, or OpenF1 before f1db has it).

const W = 1080;
const H = 1350;
const C = {
  bg: "#121117", panel: "#1b1a21", panel2: "#24222b", ink: "#f4f3f7", ink2: "#d6d4dd", muted: "#a3a1ad",
  accent: "#e10600", cool: "#8cc8f0", coolSoft: "#1e3446", gold: "#f5c400", silver: "#c9ccd3", bronze: "#cd8a52",
};
const UKF = "Fira Sans Extra Condensed";
const NUM = "Saira Condensed";
const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");
const FONTS = ["Medium", "SemiBold", "Bold", "ExtraBold"].flatMap((w) => [
  path.join(FONT_DIR, `SairaCondensed-${w}.ttf`),
  path.join(FONT_DIR, `FiraSansExtraCondensed-${w}.ttf`),
]);

export interface CardRow {
  position: string;
  driverId: string;
  name: string; // the Latin "First Last", for a driver the name map doesn't know
  constructorId: string;
  right: string; // time, gap or "+1 коло"
}

export interface CardData {
  kicker: string; // the session: "ГОНКА", "КВАЛІФІКАЦІЯ"…
  title: string; // "ГРАН-ПРІ САН-ПАУЛУ 2026"
  season: number;
  rows: CardRow[]; // top ten, P1 first
  note: string | null; // a line under the podium: the biggest climb, the pole lap
}

const SESSION_KICKER: Record<string, string> = {
  "Practice 1": "ПРАКТИКА 1", "Practice 2": "ПРАКТИКА 2", "Practice 3": "ПРАКТИКА 3",
  Qualifying: "КВАЛІФІКАЦІЯ", "Sprint Qualifying": "СПРИНТ-КВАЛІФІКАЦІЯ", "Sprint Shootout": "СПРИНТ-КВАЛІФІКАЦІЯ",
  Sprint: "СПРИНТ", Race: "ГОНКА",
};

const surname = (id: string, name: string) => UK_DRIVER_NAMES[id]?.[1] ?? (name.includes(" ") ? name.split(" ").slice(1).join(" ") : name);
const ukLaps = (s: string) => s.replace(/\+(\d+) laps?/, (_, n: string) => `+${n} ${n === "1" ? "коло" : Number(n) < 5 ? "кола" : "кіл"}`);
const qualiBest = (q: { q1: string | null; q2: string | null; q3: string | null }) => q.q3 ?? q.q2 ?? q.q1 ?? "";

// The card's content for one session of the weekend, or null while it has no result.
export function cardData(wk: RaceWeekend, sessionName: string): CardData | null {
  const title = `${gpTitle(wk.grandPrixName, "uk").toUpperCase()} ${wk.season}`;
  const kicker = SESSION_KICKER[sessionName] ?? sessionName.toUpperCase();
  const base = { kicker, title, season: Number(wk.season) };
  if (sessionName === "Race" || sessionName === "Sprint") {
    const res = sessionName === "Race" ? wk.results : wk.sprintResults;
    if (res.length < 3) return null;
    const climb = res
      .filter((r) => r.positionsGained != null && r.positionsGained >= 5)
      .sort((a, b) => b.positionsGained! - a.positionsGained!)[0];
    return {
      ...base,
      rows: res.slice(0, 10).map((r) => ({ position: r.positionText, driverId: r.driverId, name: r.driverName, constructorId: r.constructorId, right: ukLaps(r.timeDisplay) })),
      note: climb ? `Найбільший прогрес: ${surname(climb.driverId, climb.driverName)}, з ${climb.gridPosition}-го на ${climb.positionText}-ге` : null,
    };
  }
  if (sessionName === "Qualifying" || sessionName.startsWith("Sprint ")) {
    const q = sessionName === "Qualifying" ? wk.qualifying : wk.sprintQualifying;
    if (q.length < 3) return null;
    const pole = q[0];
    return {
      ...base,
      rows: q.slice(0, 10).map((r) => ({ position: String(r.position ?? ""), driverId: r.driverId, name: r.driverName, constructorId: r.constructorId, right: qualiBest(r) })),
      note: `Поул: ${surname(pole.driverId, pole.driverName)}, ${qualiBest(pole)}`,
    };
  }
  const n = Number(/Practice (\d)/.exec(sessionName)?.[1]);
  const p = wk.practices.find((x) => x.number === n);
  if (!p || p.results.length < 3) return null;
  return {
    ...base,
    rows: p.results.slice(0, 10).map((r, i) => ({ position: r.positionText, driverId: r.driverId, name: r.driverName, constructorId: r.constructorId, right: i === 0 ? r.time ?? "" : r.gap ?? r.time ?? "" })),
    note: null,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const txt = (x: number, y: number, s: string, size: number, o: { w?: number; fill?: string; anchor?: string; font?: string; ls?: number } = {}) =>
  `<text x="${x}" y="${y}" font-family="${o.font ?? UKF}" font-size="${size}" font-weight="${o.w ?? 800}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "start"}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${esc(s)}</text>`;

// One podium panel: the portrait on the team's colour, the place, the surname
// and the time or gap. P1 stands in the middle, taller.
function step(i: number, x: number, w: number, top: number, bottom: number, r: CardRow, medal: string, photo: string | null): string {
  const col = teamColor(r.constructorId);
  const name = surname(r.driverId, r.name).toUpperCase();
  let s =
    `<defs><clipPath id="c${i}"><rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" rx="16"/></clipPath>` +
    `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.panel}"/></linearGradient></defs>` +
    `<rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" rx="16" fill="url(#g${i})"/>`;
  // the portrait frame runs head to knees: show the head and shoulders
  if (photo) s += `<g clip-path="url(#c${i})"><image x="${x - w * 0.1}" y="${top + 14}" width="${w * 1.2}" height="${(w * 1.2 * 1725) / 600}" href="${photo}" preserveAspectRatio="xMidYMin meet"/></g>`;
  s +=
    `<g clip-path="url(#c${i})"><rect x="${x}" y="${bottom - 132}" width="${w}" height="132" fill="${C.panel}" opacity="0.94"/>` +
    `<rect x="${x}" y="${bottom - 6}" width="${w}" height="6" fill="${col}"/></g>` +
    `<rect x="${x + 16}" y="${top + 16}" width="56" height="56" rx="12" fill="${medal}"/>` +
    txt(x + 44, top + 57, r.position, 36, { anchor: "middle", fill: "#15130f", font: NUM }) +
    txt(x + w / 2, bottom - 76, name, name.length > 11 ? 36 : w > 330 ? 50 : 42, { anchor: "middle" }) +
    txt(x + w / 2, bottom - 30, r.right, 32, { anchor: "middle", font: NUM, w: 700, fill: C.ink2 });
  return s;
}

function row(y: number, r: CardRow): string {
  return (
    `<rect x="60" y="${y}" width="960" height="50" rx="10" fill="${C.panel}"/>` +
    `<rect x="70" y="${y + 6}" width="38" height="38" rx="8" fill="${C.panel2}"/>` +
    txt(89, y + 36, r.position, 26, { anchor: "middle", font: NUM }) +
    `<rect x="120" y="${y + 9}" width="6" height="32" rx="3" fill="${teamColor(r.constructorId)}"/>` +
    txt(140, y + 36, surname(r.driverId, r.name).toUpperCase(), 30) +
    txt(1000, y + 36, r.right, 28, { anchor: "end", font: NUM, w: 700, fill: C.ink2 })
  );
}

// The SVG of a card; `photos` are data: URIs by driverId.
export function cardSvg(d: CardData, photos: Record<string, string | null>): string {
  let chk = "";
  for (let i = 0; i < 54; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) chk += `<rect x="${i * 20}" y="${j * 10}" width="20" height="10" fill="${C.ink}" opacity="0.9"/>`;
  const kw = d.kicker.length * 18 + 40;
  const [p1, p2, p3] = d.rows;
  let body =
    step(2, 60, 300, 330, 760, p2, C.silver, photos[p2.driverId] ?? null) +
    step(3, 720, 300, 360, 760, p3, C.bronze, photos[p3.driverId] ?? null) +
    step(1, 370, 340, 270, 780, p1, C.gold, photos[p1.driverId] ?? null);
  // an arrow for a climb, a dot for anything else
  const mark = d.note?.startsWith("Найбільший прогрес") ? `<path d="M60 830 l12 -20 l12 20 z" fill="${C.cool}"/>` : `<circle cx="72" cy="820" r="9" fill="${C.cool}"/>`;
  if (d.note) body += mark + txt(96, 830, d.note, 32, { w: 700, fill: C.cool });
  d.rows.slice(3, 10).forEach((r, i) => (body += row(858 + i * 56, r)));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${C.bg}"/>${chk}` +
    `<rect x="60" y="64" width="60" height="60" rx="12" fill="${C.accent}"/>` + txt(90, 106, "PT", 32, { anchor: "middle", fill: "#fff", font: NUM }) + txt(136, 106, "PADDOCK TIMES", 34, { font: NUM }) +
    `<rect x="${1020 - kw}" y="68" width="${kw}" height="52" rx="10" fill="${C.coolSoft}"/>` + txt(1020 - kw / 2, 104, d.kicker, 28, { anchor: "middle", fill: C.cool, w: 700, ls: 1 }) +
    txt(60, 214, d.title, d.title.length > 26 ? 52 : 64) + `<rect x="60" y="236" width="110" height="6" rx="3" fill="${C.cool}"/>` +
    body +
    `<rect x="0" y="${H - 96}" width="${W}" height="96" fill="${C.panel}"/>` +
    txt(60, H - 38, "paddocktimes.com", 32, { w: 700, fill: C.ink2 }) + txt(1020, H - 38, "t.me/paddocktimes", 30, { w: 600, fill: C.muted, anchor: "end" }) +
    `</svg>`
  );
}

// A portrait as a data: URI (PNG from the CDN), kept a week; null without one.
function portrait(driverId: string, constructorId: string, season: number): Promise<string | null> {
  const url = driverPortraitUrl(driverId, constructorId, season, 400)?.replace(/\.webp$/, ".png");
  if (!url) return Promise.resolve(null);
  return cached(`card:photo:${url}`, (v) => (v ? 7 * 86400 : 600), async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) return null;
    return `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  });
}

export async function renderSessionCard(d: CardData): Promise<Buffer> {
  const photos: Record<string, string | null> = {};
  await Promise.all(d.rows.slice(0, 3).map(async (r) => (photos[r.driverId] = r.driverId ? await portrait(r.driverId, r.constructorId, d.season) : null)));
  return Buffer.from(new Resvg(cardSvg(d, photos), { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: UKF } }).render().asPng());
}

// A past session's top three in the shape of the home hero, for posting a
// card of a session the channel has already passed.
export async function sessionHeroOf(season: string, round: string, sessionName: string): Promise<SessionHero | null> {
  const wk = await getRaceWeekendNow(season, round);
  if (!wk) return null;
  const race = sessionName === "Race" || sessionName === "Sprint";
  const quali = sessionName === "Qualifying" || sessionName.startsWith("Sprint ");
  const sec = (t: string) => t.split(":").reduce((a, v) => a * 60 + Number(v), 0);
  let top: SessionHero["top"];
  if (race) {
    top = (sessionName === "Race" ? wk.results : wk.sprintResults).slice(0, 3).map((r, i) => ({
      position: i + 1, driverId: r.driverId, driverName: r.driverName, driverCode: r.driverCode, number: null,
      constructorId: r.constructorId, constructorName: r.constructorName, time: r.timeDisplay, laps: r.laps, headshot: null,
    }));
  } else if (quali) {
    const q = (sessionName === "Qualifying" ? wk.qualifying : wk.sprintQualifying).slice(0, 3);
    const best = (x: (typeof q)[number]) => x.q3 ?? x.q2 ?? x.q1 ?? "";
    top = q.map((r, i) => ({
      position: i + 1, driverId: r.driverId, driverName: r.driverName, driverCode: r.driverCode, number: null,
      constructorId: r.constructorId, constructorName: r.constructorName,
      time: i === 0 ? best(r) : best(r) && best(q[0]) ? `+${(sec(best(r)) - sec(best(q[0]))).toFixed(3)}` : null, laps: null, headshot: null,
    }));
  } else return null;
  if (top.length < 3) return null;
  return {
    kind: race ? "race" : "qualifying", sessionName, sprint: sessionName.startsWith("Sprint"), segment: null,
    season: Number(season), round: Number(round), grandPrixName: wk.grandPrixName, top, endedAt: new Date().toISOString(),
  };
}

// The card of a weekend's session, or null while it has no result. Kept ten
// minutes, like the provisional weekend it comes from.
export async function sessionCard(season: string, round: string, sessionName: string): Promise<Buffer | null> {
  const wk = await getRaceWeekendNow(season, round);
  const d = wk && cardData(wk, sessionName);
  if (!d) return null;
  return cached(`card:${season}:${round}:${sessionName}:${d.rows.map((r) => r.driverId + r.right).join("|")}`, 600, () => renderSessionCard(d));
}
