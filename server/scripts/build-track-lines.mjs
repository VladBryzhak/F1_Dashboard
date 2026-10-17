// Builds server/src/data/track-lines.json for the replay track map: for every
// circuit with OpenF1 race data, one reference lap (the racing line with the
// time at each point, i.e. a speed profile) and one real pit stop (the pit
// lane path). Run once, or when a new circuit joins the calendar:
//   node scripts/build-track-lines.mjs
// Uses a handful of small OpenF1 requests per circuit, made one at a time.
import { writeFileSync } from "node:fs";

const API = "https://api.openf1.org/v1";
const OUT = new URL("../src/data/track-lines.json", import.meta.url);
const FIRST_YEAR = 2023;
// OpenF1 x/y are in decimetres with y pointing up; screen y points down.
const FLIP_Y = true;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, attempt = 0) {
  await sleep(700); // stay well under OpenF1's burst limit
  const res = await fetch(API + path, { headers: { Accept: "application/json" } });
  if (res.status === 429 && attempt < 6) {
    await sleep(2000 * (attempt + 1));
    return get(path, attempt + 1);
  }
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
const iso = (ms) => encodeURIComponent(new Date(ms).toISOString());
const ms = (s) => Date.parse(s);

// Location samples for one car between two instants, without (0,0) dropouts.
async function track(session, driver, from, to) {
  const rows = await get(
    `/location?session_key=${session}&driver_number=${driver}&date>${iso(from)}&date<${iso(to)}`,
  );
  return rows
    .filter((p) => p.x !== 0 || p.y !== 0)
    .map((p) => ({ t: ms(p.date), x: p.x, y: FLIP_Y ? -p.y : p.y }))
    .sort((a, b) => a.t - b.t);
}

// Point at time t on a time-stamped polyline (linear between samples).
function at(pts, t) {
  if (t <= pts[0].t) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].t >= t) {
      const a = pts[i - 1], b = pts[i];
      const f = (t - a.t) / (b.t - a.t || 1);
      return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return pts[pts.length - 1];
}

// Distance from p to the polyline, and the line's time (s from lap start) at
// the closest point.
function project(p, line) {
  let best = { d: Infinity, lt: 0 };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = dx * dx + dy * dy || 1;
    const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
    const d = Math.hypot(p.x - (a.x + f * dx), p.y - (a.y + f * dy));
    if (d < best.d) best = { d, lt: a.lt + (b.lt - a.lt) * f };
  }
  return best;
}

async function buildCircuit(session) {
  const laps = await get(`/laps?session_key=${session.session_key}`);
  // Reference lap: the fastest clean, fully timed racing lap.
  const clean = laps.filter(
    (l) =>
      l.lap_duration &&
      l.date_start &&
      l.lap_number > 1 &&
      !l.is_pit_out_lap &&
      l.duration_sector_1 && l.duration_sector_2 && l.duration_sector_3 &&
      Math.abs(l.duration_sector_1 + l.duration_sector_2 + l.duration_sector_3 - l.lap_duration) < 0.3,
  );
  if (!clean.length) throw new Error("no clean lap");
  const ref = clean.sort((a, b) => a.lap_duration - b.lap_duration)[0];
  const start = ms(ref.date_start);
  const T = ref.lap_duration;
  const raw = await track(session.session_key, ref.driver_number, start - 2000, start + T * 1000 + 2000);
  if (raw.length < 100) throw new Error("too few location points");
  // Resample every 0.25 s from the line (t = 0) to the line again (t = T).
  const line = [];
  for (let lt = 0; lt <= T + 1e-6; lt += 0.25) {
    const p = at(raw, start + lt * 1000);
    line.push({ x: p.x, y: p.y, lt: Math.min(lt, T) });
  }
  const end = at(raw, start + T * 1000);
  line.push({ x: end.x, y: end.y, lt: T });

  // Pit lane: from one ordinary stop, the part of the drive that leaves the
  // racing line, timed from the moment it leaves.
  let pit = null;
  const stops = (await get(`/pit?session_key=${session.session_key}`))
    .filter((p) => p.date && p.lane_duration && p.lane_duration > 12 && p.lane_duration < 45)
    .sort((a, b) => a.lane_duration - b.lane_duration);
  for (const stop of stops.slice(0, 3)) {
    const t0 = ms(stop.date);
    // `date` is not the pit-entry moment (the car is already in the lane well
    // before it), so search a wide window and calibrate the offset.
    const pts = await track(session.session_key, stop.driver_number, t0 - (stop.lane_duration + 45) * 1000, t0 + 45000);
    if (pts.length < 50) continue;
    const off = pts.map((p) => ({ ...p, ...project(p, line) }));
    if (process.env.DEBUG_PIT) {
      const ds = off.map((p) => Math.round(p.d));
      console.log(`  stop ${stop.driver_number} lap ${stop.lap_number} lane ${stop.lane_duration}s: ${pts.length} pts, dist min ${Math.min(...ds)} max ${Math.max(...ds)}`);
      console.log('  ' + ds.filter((_, i) => i % 6 === 0).join(' '));
    }
    const THRESH = 70; // 7 m off the racing line
    // Longest run of off-line samples.
    let bestRun = null, runStart = -1;
    for (let i = 0; i <= off.length; i++) {
      const isOff = i < off.length && off[i].d > THRESH;
      if (isOff && runStart < 0) runStart = i;
      if (!isOff && runStart >= 0) {
        if (!bestRun || i - runStart > bestRun[1] - bestRun[0]) bestRun = [runStart, i];
        runStart = -1;
      }
    }
    if (!bestRun || off[bestRun[1] - 1].t - off[bestRun[0]].t < 8000) continue;
    const [a, b] = bestRun;
    const enter = off[Math.max(0, a - 1)], leave = off[Math.min(off.length - 1, b)];
    const path = off.slice(Math.max(0, a - 1), Math.min(off.length, b + 1));
    // The box: the longest still stretch inside the pit lane.
    let box = null, still = -1;
    for (let i = 1; i <= path.length; i++) {
      const moving = i < path.length && Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) > 4;
      if (!moving && i < path.length && still < 0) still = i - 1;
      if ((moving || i === path.length) && still >= 0) {
        const len = path[i - 1].t - path[still].t;
        if (!box || len > box[1] - box[0]) box = [path[still].t, path[i - 1].t];
        still = -1;
      }
    }
    pit = {
      entry: project(enter, line).lt, // line time where the car leaves it
      exit: project(leave, line).lt, // line time where it rejoins
      offset: (enter.t - t0) / 1000, // /pit `date` → leaving the line, seconds
      box: box ? [(box[0] - enter.t) / 1000, (box[1] - enter.t) / 1000] : null,
      lane: stop.lane_duration,
      path: path.map((p) => ({ x: p.x, y: p.y, t: (p.t - enter.t) / 1000 })),
    };
    break;
  }
  return { ref, T, line, pit };
}

// Fit to a landscape box (same idea as the circuit outlines) and normalise.
function normalise({ line, pit }) {
  const all = [...line, ...(pit?.path ?? [])];
  const rotate = (p, a) => ({ ...p, x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  let best = { fit: -1, deg: 0 };
  for (let deg = -90; deg <= 90; deg += 3) {
    const r = all.map((p) => rotate(p, (deg * Math.PI) / 180));
    const w = Math.max(...r.map((p) => p.x)) - Math.min(...r.map((p) => p.x));
    const h = Math.max(...r.map((p) => p.y)) - Math.min(...r.map((p) => p.y));
    const fit = Math.min(1.6 / w, 1 / h);
    if (fit > best.fit * 1.02 || (fit > best.fit && Math.abs(deg) < Math.abs(best.deg))) best = { fit, deg };
  }
  const a = (best.deg * Math.PI) / 180;
  const rot = all.map((p) => rotate(p, a));
  const minX = Math.min(...rot.map((p) => p.x)), minY = Math.min(...rot.map((p) => p.y));
  const span = Math.max(Math.max(...rot.map((p) => p.x)) - minX, Math.max(...rot.map((p) => p.y)) - minY);
  const k = 100 / span;
  const n = (p) => { const q = rotate(p, a); return [Math.round((q.x - minX) * k * 10) / 10, Math.round((q.y - minY) * k * 10) / 10]; };
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    w: Math.round((Math.max(...rot.map((p) => p.x)) - minX) * k * 10) / 10,
    h: Math.round((Math.max(...rot.map((p) => p.y)) - minY) * k * 10) / 10,
    // Points every 0.25 s of the reference lap (the last one closes the lap).
    line: line.map(n),
    pit: pit && {
      entry: r2(pit.entry),
      exit: r2(pit.exit),
      offset: r2(pit.offset),
      box: pit.box && pit.box.map(r2),
      lane: pit.lane,
      path: pit.path.map((p) => [...n(p), r2(p.t)]),
    },
  };
}

const now = Date.now();
const ONLY = process.env.ONLY;
const byCircuit = new Map(); // circuit_key -> past race sessions, newest first
for (let year = new Date().getFullYear(); year >= FIRST_YEAR; year--) {
  for (const s of await get(`/sessions?year=${year}&session_name=Race`)) {
    if (ms(s.date_start) > now) continue;
    const list = byCircuit.get(s.circuit_key) ?? [];
    list.push(s);
    byCircuit.set(s.circuit_key, list);
  }
}

const circuits = {};
for (const [key, sessions] of byCircuit) {
  sessions.sort((a, b) => b.date_start.localeCompare(a.date_start));
  const name = sessions[0].circuit_short_name;
  if (ONLY && name !== ONLY) continue;
  // Newest race first; fall back to older ones when a race lacks a clean
  // lap, location data or a usable pit stop. Keep the first line we get in
  // case no race has a pit stop we can read.
  let chosen = null;
  for (const s of sessions) {
    try {
      const built = await buildCircuit(s);
      if (!chosen) chosen = { s, built };
      if (built.pit) {
        chosen = { s, built };
        break;
      }
    } catch (err) {
      console.warn(`  ${name} ${s.year}: ${err.message}`);
    }
  }
  if (!chosen) {
    console.warn(`${name}: skipped`);
    continue;
  }
  const { s, built } = chosen;
  circuits[key] = {
    name,
    source: `${s.year} ${s.location} (session ${s.session_key})`,
    lapTime: Math.round(built.T * 1000) / 1000,
    sectors: [
      Math.round(built.ref.duration_sector_1 * 1000) / 1000,
      Math.round((built.ref.duration_sector_1 + built.ref.duration_sector_2) * 1000) / 1000,
    ],
    ...normalise(built),
  };
  console.log(`${name} (${s.year}): ${built.line.length} pts, pit ${built.pit ? `${built.pit.path.length} pts, offset ${built.pit.offset.toFixed(1)}s` : "none"}`);
}

writeFileSync(
  OUT,
  JSON.stringify({ source: "OpenF1 (https://openf1.org)", circuits }) + "\n",
);
console.log(`wrote ${Object.keys(circuits).length} circuits`);
