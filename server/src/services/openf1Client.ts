// The one door to OpenF1 (https://openf1.org) for the whole server. Its free
// tier allows 3 requests a second and 30 a minute ("Access & Support" on
// openf1.org), and every feature that reads it (telemetry, live timing,
// replays, race stories, lap charts) shares that budget. Before, each page
// fired its requests at once (a replay is 8, a race page up to 13, the live
// board 7 every few seconds), so visitors hit 429s. Here requests queue and
// leave at a pace inside both limits; a 429 that still comes back pauses the
// queue and retries; identical requests in flight share one call; and
// OpenF1's 404 "No results found" is an empty list, as it means.

import { AsyncLocalStorage } from "node:async_hooks";

const BASE = "https://api.openf1.org/v1";
const TIMEOUT_MS = 20_000;
// A little under the published limits, so clock skew between us and OpenF1
// never tips a window over.
const MIN_GAP_MS = 340; // ≤ 3 a second
const PER_MINUTE = 28; // of 30
const MINUTE_MS = 60_000;
// A request that would wait longer than this for its turn fails at once as
// "busy" (the visitor gets a clear message instead of a page loading for
// minutes). Long enough for a minute's budget to free up behind a burst of a
// few pages, so a busy moment means a slower page, not an error.
const MAX_WAIT_MS = 90_000;
// Crawlers that run our app (Googlebot renders race pages and so calls the
// API) give up much sooner, so a crawl never takes the budget from people.
const CRAWLER_MAX_WAIT_MS = 10_000;
const MAX_429_RETRIES = 3;
const DEFAULT_429_PAUSE_MS = 5_000;

// Who the request being served is for: a crawler (set per API request in
// index.ts) or the server's own background warming (inBackground).
const requester = new AsyncLocalStorage<{ crawler?: boolean; background?: boolean }>();
export const runAs = (crawler: boolean, fn: () => void) => requester.run({ crawler }, fn);
export const inBackground = <T>(fn: () => Promise<T>): Promise<T> => requester.run({ background: true }, fn);
export const isBackground = () => !!requester.getStore()?.background;

// OpenF1 can't take the request now (its rate limit, or our queue is full).
// `retryAfter` is a fair guess in seconds for when to try again.
export class OpenF1Busy extends Error {
  constructor(readonly retryAfter: number) {
    super("OpenF1 is busy");
    this.name = "OpenF1Busy";
  }
}

// OpenF1 refuses free access while a session runs: it counts data as live
// from 30 minutes before a session starts until 30 minutes after it ends, and
// answers 401 to everything without a paid token then.
export class OpenF1Locked extends Error {
  constructor() {
    super("OpenF1 is locked during a live session");
    this.name = "OpenF1Locked";
  }
}

export const isOpenF1Unavailable = (err: unknown): err is OpenF1Busy | OpenF1Locked =>
  err instanceof OpenF1Busy || err instanceof OpenF1Locked;

// For an extra that a feature can do without (weather, race control…): any
// other failure gives `fallback`, but "busy" and "locked" go up, so a result
// missing a part only because OpenF1 was busy is never cached for hours.
export const optional =
  <T>(fallback: T) =>
  (err: unknown): T => {
    if (isOpenF1Unavailable(err)) throw err;
    console.warn("[openf1]", err instanceof Error ? err.message : err);
    return fallback;
  };

interface Job {
  path: string;
  queuedAt: number;
  retries: number;
  background: boolean;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

// Two lanes: people (and crawlers) first; background warming (warmRecent in
// live.ts) only while the minute's budget has room to spare, so it never
// delays a visitor.
const queue: Job[] = [];
const backgroundQueue: Job[] = [];
// At most 10 a minute and one every 4 s, spread out, so whenever a visitor
// arrives at least 18 of the minute's requests are free for them (a cold
// replay needs 7).
const BACKGROUND_PER_MINUTE = 10;
const BACKGROUND_GAP_MS = 4_000;
const sent: number[] = []; // when each request of the last minute left
let pausedUntil = 0;
let timer: NodeJS.Timeout | null = null;
const inFlight = new Map<string, { promise: Promise<unknown>; job: Job }>();

// The earliest moment the next request may leave, given what has been sent
// (or would have been, in `history`), within `perMinute` a minute.
function nextSlot(now: number, history: number[], perMinute = PER_MINUTE, gap = MIN_GAP_MS): number {
  let t = Math.max(now, pausedUntil);
  const last = history[history.length - 1];
  if (last != null) t = Math.max(t, last + gap);
  if (history.length >= perMinute) t = Math.max(t, history[history.length - perMinute] + MINUTE_MS + 50);
  return t;
}

// How long a request joining the people's lane now would wait for its turn.
function expectedWait(now: number): number {
  const history = sent.slice();
  let t = now;
  for (let i = 0; i <= queue.length; i++) {
    t = nextSlot(now, history);
    history.push(t);
  }
  return t - now;
}

function prune(now: number) {
  while (sent.length && sent[0] <= now - MINUTE_MS) sent.shift();
}

// Send what may leave now, and wake up when the next one may. Called again
// whenever a job joins: a timer set for the background lane's slow pace must
// not hold up a visitor's request that just arrived.
function pump() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const now = Date.now();
  prune(now);
  const lane = queue.length ? queue : backgroundQueue;
  if (!lane.length) return;
  const at =
    lane === queue ? nextSlot(now, sent) : nextSlot(now, sent, BACKGROUND_PER_MINUTE, BACKGROUND_GAP_MS);
  if (at > now) {
    timer = setTimeout(() => {
      timer = null;
      pump();
    }, at - now);
    return;
  }
  const job = lane.shift()!;
  sent.push(now);
  void send(job);
  pump();
}

async function send(job: Job) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${job.path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    // A dropped connection ("fetch failed") is usually a blip: one more try.
    if (!timedOut && job.retries < 1) {
      job.retries += 1;
      (job.background ? backgroundQueue : queue).unshift(job);
      pump();
      return;
    }
    job.reject(timedOut ? new Error(`OpenF1 ${job.path} timed out`) : err);
    return;
  }
  if (res.status === 429) {
    // Over the limit after all (another client on our IP, or OpenF1 counting
    // differently): hold every request for a while and put this one back first.
    const header = Number(res.headers.get("retry-after"));
    const pause = Number.isFinite(header) && header > 0 ? header * 1000 : DEFAULT_429_PAUSE_MS * 2 ** job.retries;
    pausedUntil = Math.max(pausedUntil, Date.now() + pause);
    console.warn(`[openf1] 429 on ${job.path}; pausing ${Math.round(pause / 1000)}s (retry ${job.retries + 1})`);
    if (job.retries < MAX_429_RETRIES && (job.background || Date.now() + pause - job.queuedAt < MAX_WAIT_MS)) {
      job.retries += 1;
      (job.background ? backgroundQueue : queue).unshift(job);
      pump();
    } else {
      job.reject(new OpenF1Busy(Math.ceil(pause / 1000)));
    }
    return;
  }
  if (res.status === 401) return job.reject(new OpenF1Locked());
  if (res.status === 404) return job.resolve([]); // "No results found"
  if (!res.ok) return job.reject(new Error(`OpenF1 ${job.path} failed: ${res.status}`));
  try {
    job.resolve(await res.json());
  } catch (err) {
    job.reject(err);
  }
}

// Move everything waiting in the background lane to the front one: a visitor
// is now waiting on work the warming started (it shares the result through
// cached()).
export function promoteBackground(): void {
  if (!backgroundQueue.length) return;
  for (const job of backgroundQueue.splice(0)) {
    job.background = false;
    queue.push(job);
  }
  pump();
}

// GET an OpenF1 path (e.g. `/laps?session_key=9472`), through the queue.
export function openF1<T>(path: string): Promise<T> {
  const who = requester.getStore();
  const background = !!who?.background;
  const shared = inFlight.get(path);
  if (shared) {
    // Someone is waiting for it now: a request still in the background lane
    // moves to the front lane.
    const i = background ? -1 : backgroundQueue.indexOf(shared.job);
    if (i >= 0) {
      backgroundQueue.splice(i, 1);
      shared.job.background = false;
      queue.push(shared.job);
      pump();
    }
    return shared.promise as Promise<T>;
  }
  const now = Date.now();
  prune(now);
  if (!background) {
    const wait = expectedWait(now);
    if (wait > (who?.crawler ? CRAWLER_MAX_WAIT_MS : MAX_WAIT_MS)) {
      console.warn(`[openf1] queue full (${queue.length} waiting); refusing ${path}`);
      return Promise.reject(new OpenF1Busy(Math.ceil(wait / 1000)));
    }
  }
  let job!: Job;
  const promise = new Promise<T>((resolve, reject) => {
    job = { path, queuedAt: now, retries: 0, background, resolve: resolve as (v: unknown) => void, reject };
    (background ? backgroundQueue : queue).push(job);
    pump();
  }).finally(() => inFlight.delete(path));
  inFlight.set(path, { promise, job });
  return promise;
}
