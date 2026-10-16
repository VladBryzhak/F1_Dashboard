// Builds server/src/data/circuit-outlines.json: one SVG path per circuit, drawn
// from the open GeoJSON in https://github.com/bacinger/f1-circuits (MIT,
// © Tomislav Bacinger). Run once when the source changes:
//   node scripts/build-circuit-outlines.mjs
// The site only ships the generated JSON, so nothing is fetched at runtime.
import { writeFileSync } from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson";
const OUT = new URL("../src/data/circuit-outlines.json", import.meta.url);

// GeoJSON feature id -> f1db circuitId.
const IDS = {
  "au-1953": "melbourne", "bh-2002": "bahrain", "cn-2004": "shanghai",
  "es-1991": "catalunya", "mc-1929": "monaco", "ca-1978": "montreal",
  "fr-1969": "paul-ricard", "at-1969": "spielberg", "gb-1948": "silverstone",
  "de-1932": "hockenheimring", "hu-1986": "hungaroring", "be-1925": "spa-francorchamps",
  "it-1922": "monza", "sg-2008": "marina-bay", "ru-2014": "sirius",
  "jp-1962": "suzuka", "us-2012": "austin", "mx-1962": "mexico-city",
  "br-1940": "interlagos", "ae-2009": "yas-marina", "it-1953": "imola",
  "de-1927": "nurburgring", "pt-2008": "portimao", "it-1914": "mugello",
  "my-1999": "sepang", "tr-2005": "istanbul", "nl-1948": "zandvoort",
  "fr-1960": "magny-cours", "pt-1972": "estoril", "br-1977": "jacarepagua",
  "sa-2021": "jeddah", "us-2022": "miami", "qa-2004": "lusail",
  "es-2026": "madring", "az-2016": "baku", "us-2023": "las-vegas",
  "us-1909": "indianapolis", "ar-1952": "buenos-aires", "za-1961": "kyalami",
  "us-1956": "watkins-glen",
};

const ROTATE = !process.argv.includes("--north-up");
const SIZE = 100; // longest side of the drawing, in viewBox units
const TOLERANCE = 0.35; // Douglas–Peucker simplification, viewBox units

// Perpendicular distance from p to segment a–b.
function dist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0;
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

const geo = await (await fetch(SOURCE)).json();
const circuits = {};
for (const f of geo.features) {
  const id = IDS[f.properties.id];
  if (!id) { console.warn("unmapped", f.properties.id); continue; }
  const coords = f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates[0];
  // Equirectangular projection around the circuit's mean latitude, north up.
  const lat0 = (coords.reduce((s, c) => s + c[1], 0) / coords.length) * (Math.PI / 180);
  let proj = coords.map(([lon, lat]) => [lon * Math.cos(lat0), -lat]);
  // Rotate so the outline fills a landscape card (16:10) as much as possible,
  // preferring the angle closest to north-up when several fit equally well.
  const rotate = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  let best = { fit: -1, deg: 0 };
  for (let deg = -90; deg <= 90; deg += 3) {
    const rp = rotate(proj, (deg * Math.PI) / 180);
    const w = Math.max(...rp.map((p) => p[0])) - Math.min(...rp.map((p) => p[0]));
    const h = Math.max(...rp.map((p) => p[1])) - Math.min(...rp.map((p) => p[1]));
    const fit = Math.min(1.6 / w, 1 / h) - Math.abs(deg) * 1e-9; // tiny tie-break toward 0°
    if (fit > best.fit * 1.02 || (fit > best.fit && Math.abs(deg) < Math.abs(best.deg))) best = { fit, deg };
  }
  if (ROTATE) proj = rotate(proj, (best.deg * Math.PI) / 180);
  const xs = proj.map((p) => p[0]), ys = proj.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const scale = SIZE / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const pts = simplify(proj.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]), TOLERANCE);
  const r = (n) => Math.round(n * 10) / 10;
  const d = "M" + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join("L") + "Z";
  circuits[id] = {
    d,
    w: r((Math.max(...xs) - minX) * scale),
    h: r((Math.max(...ys) - minY) * scale),
    start: [r(pts[0][0]), r(pts[0][1])],
    rotation: ROTATE ? best.deg : 0,
  };
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: "https://github.com/bacinger/f1-circuits",
      license: "MIT © Tomislav Bacinger",
      circuits,
    },
    null,
    0,
  ) + "\n",
);
console.log(`wrote ${Object.keys(circuits).length} outlines to ${OUT.pathname}`);
