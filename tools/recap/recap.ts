// Recap videos: a session told in animated scenes (tools/recap/README.md).
// Reads a video spec (JSON: chrome + scenes, made by build.py from OpenF1
// data and our own text), draws every frame as SVG with resvg and pipes the
// frames to ffmpeg. Vertical 1080x1920 for TikTok, Reels and the channel.
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
const C = { bg: "#0d0c11", bg2: "#17151c", panel: "#1b1920", rule: "#2e2b35", ink: "#f4f3f7", muted: "#a19fab", accent: "#e10600", gold: "#f5c400", out: "#ff4d4d", cool: "#8cc8f0" };

// ---------- spec ----------
interface Row { pos: string; code: string; name: string; colour: string; time: string; mark?: "out" | "pole" | "hi"; note?: string }
type Scene =
  | { kind: "title"; dur: number; chapter: string; kicker?: string; lines: string[]; accent?: number; sub?: string }
  | { kind: "clock"; dur: number; chapter: string; label: string; from: number; to: number; caption: string; note?: string }
  | { kind: "table"; dur: number; chapter: string; title: string; sub: string; rows: Row[]; notes?: string[] }
  | { kind: "big"; dur: number; chapter: string; value: string; caption: string; left?: Row; right?: Row; note?: string }
  | { kind: "list"; dur: number; chapter: string; title: string; items: { colour: string; head: string; text: string }[] }
  | { kind: "outro"; dur: number; chapter: string; lines: string[]; sub: string; credit?: string };
interface Spec { kicker: string; scenes: Scene[] }
const spec: Spec = JSON.parse(fs.readFileSync(SPEC, "utf8"));

// ---------- helpers ----------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = "Fira Sans Extra Condensed";
const txt = (x: number, y: number, s: string, size: number, o: { w?: number; fill?: string; anchor?: string; op?: number; ls?: number } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" font-weight="${o.w ?? 800}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "start"}" opacity="${(o.op ?? 1).toFixed(3)}"${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${esc(s)}</text>`;
// an entrance: rises 40 px and fades in over 0.45 s, starting at `at` seconds into the scene
const enter = (t: number, at: number, dur = 0.45) => easeOut((t - at) / dur);
const g = (op: number, dy: number, inner: string) => `<g opacity="${op.toFixed(3)}" transform="translate(0 ${dy.toFixed(1)})">${inner}</g>`;
const rise = (t: number, at: number, inner: string, dur = 0.45) => {
  const e = enter(t, at, dur);
  return e <= 0 ? "" : g(e, (1 - e) * 40, inner);
};

// Background: dark, with slow diagonal red light streaks (the reference's mood).
function background(T: number): string {
  let s = `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  s += `<defs><linearGradient id="vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0705" stop-opacity="0.55"/><stop offset="0.45" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="#1a0503" stop-opacity="0.6"/></linearGradient>` +
    `<linearGradient id="streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.accent}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#vig)"/>`;
  for (let k = 0; k < 5; k++) {
    const y = ((k * 470 + T * (22 + k * 7)) % (H + 600)) - 300;
    s += `<rect x="-400" y="${y.toFixed(1)}" width="1900" height="${6 + k * 3}" fill="url(#streak)" transform="rotate(-24 540 ${y.toFixed(1)})"/>`;
  }
  return s;
}

// Top chrome: brand kicker, chequered band, progress bar with the chapter.
function chrome(T: number, total: number, chapter: string): string {
  let s = `<rect x="60" y="96" width="10" height="52" fill="${C.accent}" transform="skewX(-14)"/>` + txt(88, 140, spec.kicker, 44, { ls: 1 });
  // chequered band
  for (let i = 0; i < 48; i++) {
    for (let r = 0; r < 2; r++) {
      if ((i + r) % 2 === 0) s += `<rect x="${60 + i * 20}" y="${170 + r * 10}" width="20" height="10" fill="${C.ink}" opacity="0.85"/>`;
    }
  }
  s += txt(60, 240, chapter.toUpperCase(), 30, { w: 700, fill: C.muted, ls: 2 });
  const sec = Math.floor(T), cs = Math.floor((T - sec) * 1000);
  s += txt(1020, 240, `0:${String(sec).padStart(2, "0")}.${String(cs).padStart(3, "0")}`, 32, { w: 700, fill: C.gold, anchor: "end" });
  s += `<rect x="60" y="258" width="960" height="8" rx="4" fill="${C.rule}"/><rect x="60" y="258" width="${(960 * clamp(T / total)).toFixed(1)}" height="8" rx="4" fill="${C.accent}"/>`;
  return s;
}

function rowSvg(r: Row, y: number, h: number, size: number, width = 960): string {
  const fill = r.mark === "pole" ? "#3a2f05" : r.mark === "out" ? "#3a0f10" : r.mark === "hi" ? "#22202a" : "#16141b";
  const posFill = r.mark === "pole" ? C.gold : r.mark === "out" ? C.out : C.muted;
  return `<rect x="60" y="${y}" width="${width}" height="${h - 6}" rx="8" fill="${fill}"/>` +
    `<rect x="60" y="${y}" width="8" height="${h - 6}" rx="4" fill="${r.colour}"/>` +
    txt(110, y + h * 0.66, r.pos, size, { fill: posFill, anchor: "middle" }) +
    txt(160, y + h * 0.66, r.code, size) +
    txt(160 + size * 2.4, y + h * 0.66, r.name, size * 0.78, { w: 600, fill: C.muted }) +
    (r.note ? txt(160 + size * 2.4 + r.name.length * size * 0.36 + 18, y + h * 0.66, r.note, size * 0.7, { w: 600, fill: r.mark === "out" ? C.out : C.gold }) : "") +
    txt(60 + width - 24, y + h * 0.66, r.time, size, { w: 700, fill: r.mark === "pole" ? C.gold : C.ink, anchor: "end" });
}

// ---------- scenes ----------
function scene(sc: Scene, t: number): string {
  switch (sc.kind) {
    case "title": {
      const top = 960 - (sc.lines.length * 175) / 2; // the block sits around the middle
      let s = sc.kicker ? rise(t, 0.05, txt(60, top - 30, sc.kicker, 40, { w: 700, fill: C.accent, ls: 2 })) : "";
      sc.lines.forEach((l, i) => {
        const hi = i === sc.accent;
        const size = l.length > 14 ? 120 : 150;
        s += rise(t, 0.15 + i * 0.22,
          (hi ? `<rect x="54" y="${top + 120 + i * 175 - size * 0.86}" width="${Math.min(990, l.length * size * 0.62 + 50)}" height="${size * 1.02}" fill="${C.accent}" transform="skewX(-8)"/>` : "") +
          txt(70, top + 120 + i * 175, l, size));
      });
      if (sc.sub) s += rise(t, 0.3 + sc.lines.length * 0.22, txt(60, top + 140 + sc.lines.length * 175, sc.sub, 46, { w: 600, fill: C.muted }));
      return s;
    }
    case "clock": {
      const p = easeOut(clamp((t - 0.6) / (sc.dur - 2.2)));
      const v = sc.from + (sc.to - sc.from) * p;
      const hh = Math.floor(v / 3600), mm = Math.floor((v % 3600) / 60), ss = Math.floor(v % 60);
      const clockStr = `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
      return rise(t, 0.05, `<rect x="60" y="560" width="70" height="16" fill="${C.accent}"/>` + txt(60, 520, sc.label, 50, { w: 700, fill: C.accent })) +
        rise(t, 0.2, txt(540, 860, clockStr, 260, { anchor: "middle" })) +
        rise(t, 0.5, txt(540, 960, sc.caption, 54, { w: 700, fill: C.muted, anchor: "middle" })) +
        (sc.note ? rise(t, 1.2, wrap(sc.note, 540, 1120, 46, 32, "middle", C.ink)) : "");
    }
    case "table": {
      const n = sc.rows.length;
      const h = Math.min(86, Math.floor(1240 / n));
      const size = Math.min(44, h * 0.56);
      let s = rise(t, 0.05, `<rect x="60" y="330" width="10" height="64" fill="${C.accent}" transform="skewX(-14)"/>` + txt(88, 384, sc.title, 64) + txt(1020, 384, sc.sub, 38, { w: 700, fill: C.muted, anchor: "end" }));
      sc.rows.forEach((r, i) => {
        s += rise(t, 0.25 + i * Math.min(0.06, 1.2 / n), rowSvg(r, 430 + i * h, h, size), 0.35);
      });
      const ny = 430 + n * h + 70; // notes right under the table
      (sc.notes ?? []).forEach((nt, i) => {
        s += rise(t, 1.6 + i * 0.5, `<rect x="60" y="${ny + i * 64 - 40}" width="8" height="48" fill="${C.accent}"/>` + txt(86, ny + i * 64, nt, 40, { w: 700 }));
      });
      return s;
    }
    case "big": {
      let s = rise(t, 0.1, txt(540, 900, sc.value, 300, { anchor: "middle", fill: C.ink }));
      s += rise(t, 0.35, txt(540, 1000, sc.caption, 56, { w: 700, fill: C.gold, anchor: "middle" }));
      if (sc.left && sc.right) {
        s += rise(t, 0.6, rowSvg(sc.left, 1110, 100, 50) + rowSvg(sc.right, 1210, 100, 50));
      }
      if (sc.note) s += rise(t, 1.1, wrap(sc.note, 540, 1450, 46, 34, "middle", C.ink));
      return s;
    }
    case "list": {
      let s = rise(t, 0.05, `<rect x="60" y="330" width="10" height="64" fill="${C.accent}" transform="skewX(-14)"/>` + txt(88, 384, sc.title, 64));
      sc.items.forEach((it, i) => {
        const y = 480 + i * 190;
        s += rise(t, 0.3 + i * 0.35, `<rect x="60" y="${y}" width="960" height="170" rx="12" fill="${C.panel}"/><rect x="60" y="${y}" width="10" height="170" rx="5" fill="${it.colour}"/>` +
          txt(100, y + 70, it.head, 56) + txt(100, y + 132, it.text, 40, { w: 600, fill: C.muted }));
      });
      return s;
    }
    case "outro": {
      let s = "";
      sc.lines.forEach((l, i) => (s += rise(t, 0.1 + i * 0.25, txt(540, 760 + i * 140, l, i === 0 ? 120 : 90, { anchor: "middle", fill: i === 0 ? C.ink : C.accent }))));
      s += rise(t, 0.8, txt(540, 760 + sc.lines.length * 140 + 40, sc.sub, 48, { w: 700, fill: C.muted, anchor: "middle" }));
      s += rise(t, 1.0, `<rect x="450" y="1300" width="180" height="180" rx="30" fill="${C.accent}"/>` + txt(540, 1425, "PT", 110, { anchor: "middle", fill: "#fff" }));
      if (sc.credit) s += rise(t, 1.2, txt(540, 1620, sc.credit, 30, { w: 600, fill: C.muted, anchor: "middle" }));
      return s;
    }
  }
}

// Greedy word wrap for a block of text.
function wrap(s: string, x: number, y: number, size: number, max: number, anchor: string, fill: string): string {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.map((l, i) => txt(x, y + i * size * 1.25, l, size, { w: 600, fill, anchor })).join("");
}

// ---------- timeline ----------
const XF = 0.35; // cross-fade between scenes, s
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
  let body = scene(sc, t);
  // fade out at the end of the scene (not the last one)
  if (i < spec.scenes.length - 1 && t > sc.dur - XF) body = `<g opacity="${clamp((sc.dur - t) / XF).toFixed(3)}">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${background(T)}${chrome(T, TOTAL, sc.chapter)}${body}</svg>`;
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
