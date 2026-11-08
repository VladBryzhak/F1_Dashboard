// The data layer over the ghost-lap video: title, lap clock, mini-map, the gap
// as it changes, sector splits, both cars' speed, gear, throttle and brake, a
// short "who's faster?" opening and the result at the end. One transparent
// PNG per frame, matching scene.py's frames.
//
//   tsx hud.ts DATA_DIR FRAMES_DIR OUT_DIR "ПОУЛ ІНТЕРЛАГОС" [HOLD_SECONDS]
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";

const [DATA, FRAMES, OUT, TITLE, HOLD = "3"] = process.argv.slice(2);
const FONT_DIR = path.resolve(__dirname, "../../server/assets/fonts");
const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith(".ttf")).map((f) => path.join(FONT_DIR, f));
const W = 1080, H = 1920;
const C = { panel: "#14131a", rule: "#34333d", ink: "#f3f2f6", muted: "#a3a1ad", accent: "#e10600", cool: "#8cc8f0", purple: "#b05cff", green: "#3ccf7a" };

interface Raw {
  year: number; start: string; duration: number; sectors: (number | null)[]; code: string; name: string; team: string; colour: string;
  loc: { date: string; x: number; y: number }[]; car: { date: string; speed: number; throttle: number; brake: number; n_gear: number }[];
}
// frac: share of the lap driven, from the integrated speed (OpenF1's position
// timestamps wander too much to time the car by; scene.py does the same).
interface Lap { raw: Raw; t: number[]; x: number[]; y: number[]; ct: number[]; car: Raw["car"]; dist: number[]; d0: number; d1: number }

function interp(xs: number[], ys: number[], v: number): number {
  if (v <= xs[0]) return ys[0];
  let lo = 0, hi = xs.length - 1;
  if (v >= xs[hi]) return ys[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= v) lo = m; else hi = m; }
  const f = (v - xs[lo]) / (xs[hi] - xs[lo] || 1);
  return ys[lo] + f * (ys[hi] - ys[lo]);
}

function load(file: string): Lap {
  const raw: Raw = JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  const t0 = Date.parse(raw.start);
  const pts = raw.loc.filter((p) => p.x || p.y).map((p) => ({ t: (Date.parse(p.date) - t0) / 1000, x: p.x / 10, y: p.y / 10 })).sort((a, b) => a.t - b.t);
  const t = pts.map((p) => p.t), x = pts.map((p) => p.x), y = pts.map((p) => p.y);
  const car = [...raw.car].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const ct = car.map((c) => (Date.parse(c.date) - t0) / 1000);
  const dist = [0];
  for (let i = 1; i < car.length; i++) dist.push(dist[i - 1] + ((car[i].speed + car[i - 1].speed) / 2 / 3.6) * Math.max(0, ct[i] - ct[i - 1]));
  const L = { raw, t, x, y, ct, car, dist, d0: 0, d1: 1 };
  L.d0 = driven(L, 0);
  L.d1 = driven(L, raw.duration);
  return L;
}

function driven(L: Lap, t: number): number {
  const { ct, dist, car } = L;
  if (t <= ct[0]) return dist[0] + (t - ct[0]) * car[0].speed / 3.6;
  if (t >= ct[ct.length - 1]) return dist[dist.length - 1] + (t - ct[ct.length - 1]) * car[car.length - 1].speed / 3.6;
  return interp(ct, dist, t);
}
const frac = (L: Lap, t: number) => (driven(L, t) - L.d0) / (L.d1 - L.d0);
// the time a lap reached share f (frac rises with time)
function timeAt(L: Lap, f: number): number {
  let lo = -2, hi = L.raw.duration + 2;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (frac(L, m) < f) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

const A = load("lap_a.json"), B = load("lap_b.json");
const meta = JSON.parse(fs.readFileSync(path.join(FRAMES, "frames.json"), "utf8"));
const fps: number = meta.fps, leadIn: number = meta.lead_in;
const total = process.env.UPTO ? Number(process.env.UPTO) : meta.frames + Math.round(Number(HOLD) * fps); // UPTO: only the first frames, for a preview
fs.mkdirSync(OUT, { recursive: true });

const carAt = (L: Lap, t: number) => {
  let k = 0;
  for (let i = 0; i < L.ct.length; i++) if (L.ct[i] <= t) k = i; else break;
  return L.car[k];
};
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const txt = (x: number, y: number, v: string, size: number, weight = 700, fill = C.ink, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" font-family="Fira Sans Extra Condensed" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(v)}</text>`;
// a dark outline, so text over a bright sky stays readable
const HALO = 'stroke="#000" stroke-opacity="0.55" stroke-width="6" paint-order="stroke" stroke-linejoin="round"';
const clock = (sec: number) => `${Math.floor(sec / 60)}:${Math.max(0, sec % 60).toFixed(3).padStart(6, "0")}`;
const secs = (v: number) => v.toFixed(3);

// Mini-map from lap A, top right.
const box = { x: 770, y: 60, w: 250, h: 290 };
const minX = Math.min(...A.x), maxX = Math.max(...A.x), minY = Math.min(...A.y), maxY = Math.max(...A.y);
const sc = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
const ox = box.x + (box.w - (maxX - minX) * sc) / 2, oy = box.y + (box.h - (maxY - minY) * sc) / 2;
const P = (x: number, y: number) => [ox + (x - minX) * sc, oy + (maxY - y) * sc];
const mapPath = A.t
  .map((t, i) => [t, i] as const)
  .filter(([t]) => t >= 0 && t <= A.raw.duration)
  .map(([, i], k) => {
    const [px, py] = P(A.x[i], A.y[i]);
    return `${k ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
  })
  .join("") + "Z";
const mapPts = A.t.map((t, i) => [t, i] as const).filter(([t]) => t >= 0 && t <= A.raw.duration).map(([, i]) => [A.x[i], A.y[i]]);
const mapS = [0];
for (let i = 1; i < mapPts.length; i++) mapS.push(mapS[i - 1] + Math.hypot(mapPts[i][0] - mapPts[i - 1][0], mapPts[i][1] - mapPts[i - 1][1]));
const dot = (L: Lap, t: number) => {
  const s = ((((frac(L, t) % 1) + 1) % 1)) * mapS[mapS.length - 1];
  const [px, py] = P(interp(mapS, mapPts.map((q) => q[0]), s), interp(mapS, mapPts.map((q) => q[1]), s));
  return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="11" fill="${L.raw.colour}" stroke="#000" stroke-width="3"/>`;
};

// Sector ends (lap time at the end of S1 and S2), per lap.
const sectorEnds = (L: Lap) => {
  const [s1, s2] = L.raw.sectors;
  return s1 && s2 ? [s1, s1 + s2, L.raw.duration] : [L.raw.duration];
};
const SA = sectorEnds(A), SB = sectorEnds(B);

function telemetry(L: Lap, t: number, y: number) {
  const c = carAt(L, Math.min(t, L.raw.duration));
  const th = Math.max(0, Math.min(100, c.throttle)), br = c.brake > 0 ? 100 : 0;
  return `<rect x="50" y="${y}" width="980" height="140" rx="18" fill="${C.panel}" fill-opacity="0.86" stroke="${C.rule}" stroke-width="2"/>` +
    `<rect x="50" y="${y}" width="12" height="140" rx="6" fill="${L.raw.colour}"/>` +
    txt(92, y + 62, L.raw.code, 54, 800) + txt(92, y + 108, `${L.raw.year} · ${L.raw.team}`, 30, 500, C.muted) +
    txt(560, y + 90, String(Math.round(c.speed)), 78, 800, C.ink, "end") + txt(572, y + 90, "км/г", 30, 600, C.muted) +
    txt(690, y + 90, String(c.n_gear), 78, 800) + txt(735, y + 90, "перед.", 30, 600, C.muted) +
    `<rect x="862" y="${y + 25}" width="44" height="86" rx="8" fill="${C.rule}"/><rect x="862" y="${y + 25 + 86 * (1 - th / 100)}" width="44" height="${86 * th / 100}" rx="8" fill="${C.green}"/>` +
    `<rect x="934" y="${y + 25}" width="44" height="86" rx="8" fill="${C.rule}"/><rect x="934" y="${y + 25 + 86 * (1 - br / 100)}" width="44" height="${86 * br / 100}" rx="8" fill="${C.accent}"/>` +
    txt(884, y + 132, "газ", 22, 600, C.muted, "middle") + txt(956, y + 132, "гальмо", 22, 600, C.muted, "middle");
}

function sectors(t: number, y: number) {
  if (SA.length < 3 || SB.length < 3) return "";
  let out = "";
  for (let k = 0; k < 3; k++) {
    const x = 50 + k * 333;
    const a = k ? SA[k] - SA[k - 1] : SA[0], b = k ? SB[k] - SB[k - 1] : SB[0];
    const doneA = t >= SA[k], doneB = t >= SB[k];
    let body = txt(x + 160, y + 58, "—", 34, 600, C.muted, "middle");
    if (doneA && doneB) {
      const win = a <= b ? A : B;
      body = txt(x + 160, y + 58, `${win.raw.code} −${secs(Math.abs(a - b))}`, 38, 800, win.raw.colour, "middle");
    } else if (doneA || doneB) {
      const L = doneA ? A : B;
      body = txt(x + 160, y + 58, `${L.raw.code} ${secs(doneA ? a : b)}`, 36, 700, C.ink, "middle");
    }
    out += `<rect x="${x}" y="${y}" width="314" height="84" rx="14" fill="${C.panel}" fill-opacity="0.86" stroke="${C.rule}" stroke-width="2"/>` +
      txt(x + 22, y + 32, `S${k + 1}`, 26, 700, C.muted) + body;
  }
  return out;
}

function frame(t: number): string {
  // gap: where B was when it had covered the share of the lap A has now
  const fA = frac(A, Math.min(t, A.raw.duration));
  const tB = timeAt(B, fA);
  const gap = tB - Math.min(t, A.raw.duration); // > 0: A ahead
  const lead = gap >= 0 ? A : B;
  const lapClock = Math.max(0, Math.min(t, Math.max(A.raw.duration, B.raw.duration)));
  const finished = t >= Math.max(A.raw.duration, B.raw.duration) + 0.3;

  let s = `<defs><linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.72"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></linearGradient></defs>` +
    `<rect width="${W}" height="460" fill="url(#top)"/><rect y="1180" width="${W}" height="740" fill="url(#bot)"/>` +
    `<rect x="50" y="60" width="64" height="64" rx="12" fill="${C.accent}"/>${txt(82, 106, "PT", 36, 800, "#fff", "middle")}${txt(130, 106, "PADDOCK TIMES", 36, 800)}` +
    txt(50, 215, TITLE, 84, 800, C.ink, "start", HALO) +
    txt(50, 285, `${A.raw.code} ${A.raw.year} проти ${B.raw.code} ${B.raw.year}`, 50, 700, C.ink, "start", HALO) +
    txt(50, 360, clock(lapClock), 52, 700, C.cool, "start", HALO) +
    `<path d="${mapPath}" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="16" stroke-linejoin="round"/>` +
    `<path d="${mapPath}" fill="none" stroke="#e8e8ee" stroke-width="7" stroke-linejoin="round"/>` +
    dot(B, Math.min(t, B.raw.duration)) + dot(A, Math.min(t, A.raw.duration));

  if (t < 0) {
    s += txt(W / 2, 1000, "ХТО ШВИДШИЙ?", 120, 800, C.ink, "middle", 'stroke="#000" stroke-width="3" paint-order="stroke"');
  } else if (finished) {
    const win = A.raw.duration <= B.raw.duration ? A : B, lose = win === A ? B : A;
    s += `<rect x="90" y="700" width="900" height="560" rx="28" fill="${C.panel}" fill-opacity="0.94" stroke="${C.rule}" stroke-width="3"/>` +
      txt(W / 2, 800, "ШВИДШЕ КОЛО", 46, 700, C.muted, "middle") +
      txt(W / 2, 920, `${win.raw.code} ${win.raw.year}`, 120, 800, win.raw.colour, "middle") +
      txt(W / 2, 1000, clock(win.raw.duration), 64, 700, C.ink, "middle") +
      txt(W / 2, 1090, `${lose.raw.code} ${lose.raw.year}: ${clock(lose.raw.duration)}`, 46, 600, C.muted, "middle") +
      txt(W / 2, 1190, `різниця ${secs(lose.raw.duration - win.raw.duration)} с`, 52, 800, C.cool, "middle");
  } else {
    s += `<rect x="50" y="1290" width="980" height="120" rx="18" fill="${C.panel}" fill-opacity="0.86" stroke="${C.rule}" stroke-width="2"/>` +
      txt(90, 1366, "РІЗНИЦЯ", 34, 600, C.muted) +
      txt(990, 1372, `${lead.raw.code} попереду на ${Math.abs(gap).toFixed(3)}`, 60, 800, lead.raw.colour, "end") +
      sectors(t, 1425) + telemetry(A, t, 1525) + telemetry(B, t, 1680);
  }
  s += txt(W / 2, 1890, "paddocktimes.com", 32, 600, C.muted, "middle");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// ONLY=<frame> renders just that frame (to check the layout).
const only = process.env.ONLY ? Number(process.env.ONLY) : null;
for (let f = only ?? 0; f < (only != null ? only + 1 : total); f++) {
  const t = -leadIn + f / fps;
  const png = new Resvg(frame(t), { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Fira Sans Extra Condensed" } }).render().asPng();
  fs.writeFileSync(path.join(OUT, `${String(f + 1).padStart(4, "0")}.png`), png);
  if (f % 300 === 0) console.log(`hud ${f}/${total}`);
}
console.log("hud done", total);
