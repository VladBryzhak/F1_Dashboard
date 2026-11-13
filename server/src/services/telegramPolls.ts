import { gpTitle } from "./gpNames";
import { UK_DRIVER_NAMES } from "./ukNames";
import type { CalendarRace, DriverStanding } from "../types/f1";

// Weekend polls for the Telegram channel: before each race weekend, who takes
// pole and who wins the race. Telegram counts the votes (a channel's polls
// are anonymous), so nothing is stored here. Each poll closes when its session
// starts; once the result is in, a short post gives the answer and how many
// guessed it. telegramChannel.ts posts them in its regular check.

export type PollKind = "Q" | "RACE";

export interface PollOption {
  driverId: string | null; // null: "someone else"
  text: string;
}

export interface PollSpec {
  key: string; // poll:<season>:<round>:<kind>
  season: number;
  round: number;
  kind: PollKind;
  grandPrixName: string;
  question: string;
  options: PollOption[];
  opensAt: number; // posted from here…
  closesAt: number; // …until the session starts, when it is closed
}

// Telegram takes at most 10 answers: the nine highest in the championship and
// "someone else".
const MAX_DRIVERS = 9;
export const OTHER = "Інший пілот";
const OPEN_BEFORE_MS = 30 * 3600_000; // posted from 30 hours before the weekend's first session
const LAST_CALL_MS = 15 * 60_000; // not posted in the last quarter hour before the session
export const ANSWER_FOR_MS = 48 * 3600_000; // the answer goes out within two days of the session

const ukName = (id: string, given: string, family: string) => {
  const n = UK_DRIVER_NAMES[id];
  return n ? `${n[0]} ${n[1]}` : `${given} ${family}`;
};

export function pollOptions(standings: DriverStanding[], racing?: Set<string>): PollOption[] {
  const drivers = standings
    .filter((s) => !racing || racing.has(s.driverId))
    .slice(0, MAX_DRIVERS)
    .map((s) => ({ driverId: s.driverId, text: ukName(s.driverId, s.givenName, s.familyName) }));
  return [...drivers, { driverId: null, text: OTHER }];
}

// The polls of the weekends around now: open ones to post, closed ones to
// stop and to answer.
export function pollSpecs(season: number, races: CalendarRace[], options: PollOption[], now: number): PollSpec[] {
  if (options.length < 3) return [];
  const out: PollSpec[] = [];
  for (const r of races) {
    const known = r.sessions.filter((s) => s.timeKnown);
    if (!known.length) continue;
    const first = Math.min(...known.map((s) => Date.parse(s.start)));
    for (const kind of ["Q", "RACE"] as PollKind[]) {
      const s = known.find((x) => x.kind === kind);
      if (!s) continue;
      const start = Date.parse(s.start);
      const opensAt = first - OPEN_BEFORE_MS;
      if (now < opensAt || now > start + ANSWER_FOR_MS) continue;
      const gp = gpTitle(r.name, "uk");
      out.push({
        key: `poll:${season}:${r.round}:${kind}`,
        season,
        round: r.round,
        kind,
        grandPrixName: r.name,
        question:
          kind === "Q"
            ? `🗳 ${gp} ${season}: хто виграє кваліфікацію?`
            : `🗳 ${gp} ${season}: хто виграє гонку?`,
        options,
        opensAt,
        closesAt: start,
      });
    }
  }
  return out;
}

export const canPost = (p: PollSpec, now: number) => now >= p.opensAt && now < p.closesAt - LAST_CALL_MS;

// Telegram's count when the poll was closed: each answer's text and votes.
export interface PollCount {
  total: number;
  options: { text: string; votes: number }[];
}

const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ukPercent = (n: number, total: number) => `${Math.round((n / total) * 100)}%`;
function ukVotes(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  const w = d === 1 && dd !== 11 ? "голос" : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "голоси" : "голосів";
  return `${n} ${w}`;
}

// The answer once the session is over: the winner, and how many guessed it
// when the poll's count is known (from closing it).
export function answerText(p: PollSpec, winner: { driverId: string; name: string }, count: PollCount | null, pageUrl: string): string {
  const name = UK_DRIVER_NAMES[winner.driverId] ? UK_DRIVER_NAMES[winner.driverId].join(" ") : winner.name;
  // the answers as posted: Telegram's count has them, else today's list
  const answers = count?.options.map((o) => o.text) ?? p.options.map((o) => o.text);
  const listed = answers.includes(name);
  const right = count?.options.find((o) => o.text === (listed ? name : OTHER));
  const head = `🎯 <b>${esc(gpTitle(p.grandPrixName, "uk"))} · опитування: ${p.kind === "Q" ? "кваліфікація" : "гонка"}</b>`;
  const lines = [head, "", `${p.kind === "Q" ? "Поул" : "Перемога"}: ${esc(name)}${listed ? "" : ` (в опитуванні це «${OTHER}»)`}.`];
  if (count && count.total > 0) {
    const n = right?.votes ?? 0;
    lines.push(`Вгадали ${ukPercent(n, count.total)}: ${ukVotes(n)} з ${count.total}.`);
  }
  lines.push("", `${p.kind === "Q" ? "Результати й анонс гонки" : "Повні результати"}: ${pageUrl}`);
  return lines.join("\n");
}

// The text post that opens a weekend's polls; the polls follow it at once, in
// this order (qualifying, then the race). It is how the server finds them on
// the channel's public page after a restart: a text post shows there for sure.
export function introText(gpName: string, season: number, kinds: PollKind[], pageUrl: string): string {
  const gp = esc(gpTitle(gpName, "uk"));
  const both = kinds.length > 1;
  const what = both ? "кваліфікацію і гонку" : kinds[0] === "Q" ? "кваліфікацію" : "гонку";
  return [
    `🗳 <b>${gp} ${season}: ${both ? "прогнози на вікенд" : kinds[0] === "Q" ? "прогноз на кваліфікацію" : "прогноз на гонку"}</b>`,
    "",
    `Хто виграє ${what}? Голосуйте нижче: ${both ? "опитування закриваються" : "опитування закривається"} на старті ${both ? "сесій, а після них" : "сесії, а після неї"} ми напишемо, скільки людей вгадали.`,
    "",
    `Анонс етапу: ${pageUrl}`,
  ].join("\n");
}

// A message's id on the channel's public page (t.me/s/<name>) by its text.
export function findPost(html: string, text: string, sig: (s: string) => string): number | null {
  const want = sig(text);
  let found: number | null = null;
  for (const part of html.split('data-post="').slice(1)) {
    const id = /^[^/"]+\/(\d+)"/.exec(part)?.[1];
    if (id && sig(part).includes(want)) found = Number(id);
  }
  return found; // the latest one, if the page has it twice
}
