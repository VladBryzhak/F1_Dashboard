// Recap videos: a session told in animated scenes (tools/recap/README.md).
// Reads a video spec (JSON: chrome + scenes, made by a builder script from
// OpenF1 data and our own text), draws every frame as SVG with resvg and
// pipes the frames to ffmpeg. Vertical 1080x1920 for TikTok, Reels and the
// channel. The look is the site's own (Console theme): graphite, the
// circuit's outline behind everything with a car of light running round it,
// a timing tower, the driver's number huge in team colour, the video's
// progress as three timing sectors, team-colour wipes between scenes.
//
//   tsx recap.ts SPEC.json OUT.mp4 [--fps 60] [--frames a-b] [--png DIR]
import { Resvg } from "@resvg/resvg-js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const SPEC = args[0], OUT = args[1];
const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const FPS = Number(opt("--fps") ?? 60);
const PNG_DIR = opt("--png"); // write PNGs of the chosen frames instead of a video
const FONT_DIR = path.resolve(__dirname, "../../server/assets/fonts");
const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith(".ttf")).map((f) => path.join(FONT_DIR, f));
const W = 1080, H = 1920;
// the site's tokens (client/src/styles/tokens.css), as hex
const C = {
  bg: "#121117", panel: "#1b1a21", panel2: "#24222b", rule: "#34323c", ink: "#f4f3f7", ink2: "#d6d4dd", muted: "#a3a1ad",
  accent: "#e10600", cool: "#8cc8f0", coolSoft: "#1e3446", gold: "#f5c400", out: "#ff5a5a", purple: "#b05cff", green: "#3ccf7a", yellow: "#f2c94c",
};

// ---------- spec ----------
interface Row { pos: string; code: string; name: string; colour: string; time: string; mark?: "out" | "pole" | "hi"; note?: string }
type Base = { dur: number; title?: string; wipe?: string };
type Scene = Base & (
  | { kind: "title"; kicker?: string; lines: string[]; accent?: number; sub?: string }
  | { kind: "clock"; label: string; from: number; to: number; caption: string; note?: string }
  | { kind: "table"; sub: string; rows: Row[]; notes?: string[] }
  | { kind: "big"; value: string; caption: string; number?: string; colour?: string; left?: Row; right?: Row; note?: string }
  | { kind: "list"; items: { colour: string; head: string; text: string }[] }
  | { kind: "outro"; lines: string[]; sub: string; credit?: string }
);
interface Spec { session: string; place: string; outline?: { d: string; w: number; h: number }; scenes: Scene[] }
const spec: Spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));

// ---------- helpers ----------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = "Fira Sans Extra Condensed";
const NUM = "Saira Condensed"; // figures and times
const txt = (x: number, y: number, s: string, size: number, o: { w?: number; fill?: string; anchor?: string; op?: number; ls?: number; font?: string; extra?: string } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${o.font ?? FONT}" font-size="${size}" font-weight="${o.w ?? 800}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "start"}" opacity="${(o.op ?? 1).toFixed(3)}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.extra ? " " + o.extra : ""}>${esc(s)}</text>`;
// entrance from the left: slides 60 px and fades in over 0.4 s from `at` s into the scene
const slide = (t: number, at: number, inner: string, dur = 0.4) => {
  const e = easeOut((t - at) / dur);
  return e <= 0 ? "" : `<g opacity="${e.toFixed(3)}" transform="translate(${((1 - e) * -60).toFixed(1)} 0)">${inner}</g>`;
};

// ---------- the circuit behind everything ----------
let outlineLen = 0;
const outlinePts: [number, number][] = [];
if (spec.outline) {
  for (const m of spec.outline.d.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) outlinePts.push([Number(m[1]), Number(m[2])]);
  for (let i = 1; i < outlinePts.length; i++) outlineLen += Math.hypot(outlinePts[i][0] - outlinePts[i - 1][0], outlinePts[i][1] - outlinePts[i - 1][1]);
}

function circuit(T: number): string {
  if (!spec.outline) return "";
  const { d, w, h } = spec.outline;
  const scale = 1250 / Math.max(w, h);
  const cx = W / 2, cy = 1000;
  const rot = -8 + 4 * Math.sin(T / 14); // a slow drift
  const tf = `translate(${cx} ${cy}) rotate(${rot.toFixed(2)}) scale(${scale.toFixed(3)}) translate(${-w / 2} ${-h / 2})`;
  // a car of light: a bright stretch of the outline running round, one lap every 9 s
  const seg = outlineLen * 0.06;
  const off = -((T / 9) % 1) * outlineLen;
  return `<g transform="${tf}" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
    `<path d="${d}" stroke="#1f1d26" stroke-width="${(26 / scale).toFixed(2)}"/>` +
    `<path d="${d}" stroke="#2c2a35" stroke-width="${(10 / scale).toFixed(2)}"/>` +
    `<path d="${d}" stroke="${C.cool}" stroke-opacity="0.55" stroke-width="${(10 / scale).toFixed(2)}" stroke-dasharray="${seg.toFixed(2)} ${(outlineLen - seg).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>` +
    `</g>`;
}

// Header: the PT tile and name, the session chip; footer: progress as three sectors.
function chrome(T: number, total: number): string {
  let s = `<rect x="60" y="84" width="64" height="64" rx="14" fill="${C.accent}"/>` + txt(92, 130, "PT", 36, { anchor: "middle", fill: "#fff" }) +
    txt(140, 130, "PADDOCK TIMES", 38, { w: 800 });
  const chip = spec.session.toUpperCase();
  const cw = chip.length * 17 + 44;
  s += `<rect x="${1020 - cw}" y="88" width="${cw}" height="56" rx="12" fill="${C.coolSoft}"/>` + txt(1020 - cw / 2, 126, chip, 30, { w: 700, fill: C.cool, anchor: "middle", ls: 1 });
  s += txt(1020, 186, spec.place, 30, { w: 600, fill: C.muted, anchor: "end" });
  // three sectors at the bottom, coloured like timing sectors
  const cols = [C.purple, C.green, C.yellow];
  const p = clamp(T / total) * 3;
  for (let k = 0; k < 3; k++) {
    const x = 60 + k * 326, fill = clamp(p - k);
    s += `<rect x="${x}" y="1832" width="314" height="10" rx="5" fill="${C.rule}"/>`;
    if (fill > 0) s += `<rect x="${x}" y="1832" width="${(314 * fill).toFixed(1)}" height="10" rx="5" fill="${cols[k]}"/>`;
    s += txt(x, 1876, `S${k + 1}`, 24, { w: 700, fill: fill >= 1 ? cols[k] : C.muted, font: NUM });
  }
  s += txt(1020, 1876, "paddocktimes.com", 26, { w: 600, fill: C.muted, anchor: "end" });
  return s;
}

const heading = (t: number, title: string, sub?: string) =>
  slide(t, 0.05, txt(60, 330, title, 76) + (sub ? txt(1020, 330, sub, 34, { w: 700, fill: C.muted, anchor: "end" }) : "") +
    `<rect x="60" y="356" width="120" height="6" rx="3" fill="${C.cool}"/>`);

// A timing-tower row: position chip, team bar, code, surname, time or gap.
function towerRow(r: Row, y: number, h: number, size: number): string {
  const out = r.mark === "out", pole = r.mark === "pole";
  const op = out ? 0.62 : 1;
  const chipFill = pole ? C.gold : out ? "none" : C.panel2;
  const chipText = pole ? "#1a1500" : out ? C.out : C.ink;
  let s = `<g opacity="${op}">`;
  s += `<rect x="60" y="${y}" width="960" height="${h - 8}" rx="10" fill="${pole ? "#2b2508" : C.panel}"/>`;
  s += `<rect x="72" y="${y + 8}" width="${h - 24}" height="${h - 24}" rx="8" fill="${chipFill}"${out ? ` stroke="${C.out}" stroke-width="2"` : ""}/>`;
  s += txt(72 + (h - 24) / 2, y + h * 0.64, r.pos, size * 0.9, { fill: chipText, anchor: "middle", font: NUM });
  s += `<rect x="${72 + h - 10}" y="${y + 10}" width="6" height="${h - 28}" rx="3" fill="${r.colour}"/>`;
  const x0 = 72 + h + 12;
  s += txt(x0, y + h * 0.64, r.code, size);
  s += txt(x0 + size * 2.3, y + h * 0.64, r.name, size * 0.74, { w: 600, fill: C.muted });
  if (r.note) s += `<rect x="${x0 + size * 2.3 + r.name.length * size * 0.34 + 16}" y="${y + h * 0.25}" width="${r.note.length * size * 0.36 + 24}" height="${h * 0.5}" rx="6" fill="${out ? "#3a1416" : C.coolSoft}"/>` +
    txt(x0 + size * 2.3 + r.name.length * size * 0.34 + 28, y + h * 0.6, r.note.toUpperCase(), size * 0.52, { w: 700, fill: out ? C.out : C.cool, ls: 1 });
  s += txt(1000, y + h * 0.64, r.time, size, { w: 700, fill: pole ? C.gold : out ? C.out : C.ink2, anchor: "end", font: NUM });
  return s + "</g>";
}

function callouts(t: number, notes: string[] | undefined, y0: number): string {
  let s = "";
  (notes ?? []).forEach((nt, i) => {
    const y = y0 + i * 92;
    s += slide(t, 1.4 + i * 0.45, `<rect x="60" y="${y}" width="960" height="76" rx="12" fill="${C.panel}"/><rect x="60" y="${y}" width="8" height="76" rx="4" fill="${C.cool}"/>` +
      txt(92, y + 50, nt, 38, { w: 700, fill: C.ink2 }));
  });
  return s;
}

// ---------- scenes ----------
function scene(sc: Scene, t: number): string {
  switch (sc.kind) {
    case "title": {
      const top = 560;
      let s = sc.kicker ? slide(t, 0.05, txt(60, top - 30, sc.kicker, 40, { w: 700, fill: C.cool, ls: 2 })) : "";
      sc.lines.forEach((l, i) => {
        const hi = i === sc.accent;
        s += slide(t, 0.15 + i * 0.2, txt(60, top + 130 + i * 170, l, l.length > 12 ? 128 : 150, { fill: hi ? C.cool : C.ink }));
      });
      if (sc.sub) s += slide(t, 0.25 + sc.lines.length * 0.2, txt(60, top + 150 + sc.lines.length * 170, sc.sub, 46, { w: 600, fill: C.muted }));
      return s;
    }
    case "clock": {
      const p = easeOut(clamp((t - 0.6) / (sc.dur - 2.2)));
      const v = sc.from + (sc.to - sc.from) * p;
      const hh = Math.floor(v / 3600), mm = Math.floor((v % 3600) / 60), ss = Math.floor(v % 60);
      const str = `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
      return heading(t, sc.title ?? "", undefined) +
        slide(t, 0.15, `<rect x="60" y="540" width="${sc.label.length * 24 + 48}" height="64" rx="12" fill="#3a1416"/>` + txt(84, 584, sc.label, 38, { w: 800, fill: C.out, ls: 1 })) +
        slide(t, 0.3, txt(60, 900, str, 240, { font: NUM, w: 800 })) +
        slide(t, 0.5, txt(60, 990, sc.caption, 50, { w: 700, fill: C.muted })) +
        (sc.note ? slide(t, 1.1, wrap(sc.note, 60, 1180, 46, 36, "start", C.ink2)) : "");
    }
    case "table": {
      const n = sc.rows.length;
      const h = Math.min(92, Math.floor(1180 / n));
      const size = Math.min(46, h * 0.56);
      let s = heading(t, sc.title ?? "", sc.sub);
      sc.rows.forEach((r, i) => (s += slide(t, 0.2 + i * Math.min(0.06, 1.1 / n), towerRow(r, 410 + i * h, h, size), 0.3)));
      return s + callouts(t, sc.notes, 410 + n * h + 30);
    }
    case "big": {
      let s = "";
      if (sc.number) s += slide(t, 0, txt(1040, 1060, sc.number, 900, { anchor: "end", fill: "none", font: NUM, extra: `stroke="${sc.colour ?? C.accent}" stroke-width="10" stroke-opacity="0.55"` }), 0.6);
      s += heading(t, sc.title ?? "");
      s += slide(t, 0.15, txt(60, 820, sc.value, 300, { font: NUM, fill: C.cool }));
      s += slide(t, 0.35, txt(60, 910, sc.caption, 50, { w: 700, fill: C.ink2 }));
      if (sc.left && sc.right) s += slide(t, 0.6, towerRow(sc.left, 1000, 104, 50) + towerRow(sc.right, 1104, 104, 50));
      if (sc.note) s += slide(t, 1.1, wrap(sc.note, 60, 1340, 44, 38, "start", C.ink2));
      return s;
    }
    case "list": {
      let s = heading(t, sc.title ?? "");
      sc.items.forEach((it, i) => {
        const y = 430 + i * 200;
        s += slide(t, 0.3 + i * 0.3, `<rect x="60" y="${y}" width="960" height="176" rx="14" fill="${C.panel}"/><rect x="60" y="${y}" width="12" height="176" rx="6" fill="${it.colour}"/>` +
          txt(100, y + 76, it.head, 58) + txt(100, y + 138, it.text, 40, { w: 600, fill: C.muted }));
      });
      return s;
    }
    case "outro": {
      let s = "";
      sc.lines.forEach((l, i) => (s += slide(t, 0.1 + i * 0.25, txt(60, 700 + i * 150, l, i === 0 ? 110 : 96, { fill: i === 0 ? C.ink : C.cool }))));
      s += slide(t, 0.7, txt(60, 700 + sc.lines.length * 150 + 20, sc.sub, 48, { w: 700, fill: C.muted }));
      if (sc.credit) s += slide(t, 1.0, wrap(sc.credit, 60, 1640, 28, 70, "start", C.muted));
      return s;
    }
  }
}

function wrap(s: string, x: number, y: number, size: number, max: number, anchor: string, fill: string): string {
  const lines: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.map((l, i) => txt(x, y + i * size * 1.3, l, size, { w: 600, fill, anchor })).join("");
}

// ---------- timeline ----------
const WIPE = 0.5; // the team-colour wipe into each scene, s
const starts: number[] = [];
let acc = 0;
for (const sc of spec.scenes) {
  starts.push(acc);
  acc += sc.dur;
}
const TOTAL = acc;

function frame(T: number): string {
  let i = starts.findIndex((s, k) => T >= s && T < s + spec.scenes[k].dur);
  if (i < 0) i = spec.scenes.length - 1;
  const sc = spec.scenes[i];
  const t = T - starts[i];
  let s = `<rect width="${W}" height="${H}" fill="${C.bg}"/>` + circuit(T) + chrome(T, TOTAL) + scene(sc, t);
  // a band of the scene's colour sweeps across as it opens
  if (i > 0 && t < WIPE) {
    const p = easeInOut(t / WIPE);
    const x = -W * 0.6 + p * W * 2.2;
    s += `<g transform="skewX(-12)"><rect x="${x.toFixed(1)}" y="0" width="${(W * 0.5).toFixed(0)}" height="${H}" fill="${sc.wipe ?? C.accent}"/>` +
      `<rect x="${(x - 50).toFixed(1)}" y="0" width="30" height="${H}" fill="${C.ink}" opacity="0.9"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

const render = (T: number) => new Resvg(frame(T), { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: FONT } }).render().asPng();

const n = Math.round(TOTAL * FPS);
const range = opt("--frames")?.split("-").map(Number) ?? [0, n - 1];
if (PNG_DIR) {
  fs.mkdirSync(PNG_DIR, { recursive: true });
  for (let f = range[0]; f <= range[1]; f++) fs.writeFileSync(path.join(PNG_DIR, `${String(f).padStart(5, "0")}.png`), render(f / FPS));
  console.log(`png ${range[0]}-${range[1]}`);
} else {
  const ff = spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
  (async () => {
    for (let f = 0; f < n; f++) {
      if (!ff.stdin.write(render(f / FPS))) await new Promise((r) => ff.stdin.once("drain", r));
      if (f % 600 === 0) console.log(`frame ${f}/${n}`);
    }
    ff.stdin.end();
    ff.on("close", (code) => console.log(code === 0 ? `done ${OUT} (${TOTAL.toFixed(1)} s)` : `ffmpeg exited ${code}`));
  })();
}
