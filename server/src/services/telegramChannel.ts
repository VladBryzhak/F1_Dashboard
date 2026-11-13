import { channelTeasers, listArticles } from "./articles";
import { getCalendar, getCurrentSeason, getDriverStandings, getSeasonReview } from "./f1db";
import { gpTitle } from "./gpNames";
import { SITE_URL } from "./pageHtml";
import { getRacePreview } from "./racePreview";
import { sessionCard, sessionHeroOf } from "./sessionCard";
import { latestSessionHero } from "./sessionHero";
import { getRaceWeekendNow } from "./provisional";
import { answerText, canPost, findPost, introText, pollOptions, pollSpecs, type PollCount, type PollKind, type PollSpec } from "./telegramPolls";
import { ukPlural } from "./ukText";
import { UK_DRIVER_NAMES } from "./ukNames";
import type { ArticleSummary, RacePreview, SeasonReview, SessionHero } from "../types/f1";

// Posts to the site's public Telegram channel, in Ukrainian with links to the
// /uk pages: a session's top three about half an hour after it ends, the race
// preview on race day, a new article, and the season review once the season
// is final. The images are our own: Telegram's link preview shows the page's
// card (og:image), never a photo of someone else's.
//
// Set TELEGRAM_CHANNEL (the channel's @username, or its numeric id) next to
// TELEGRAM_BOT_TOKEN on the server, and make that bot an admin of the channel
// who may post. Without both nothing is posted. TELEGRAM_DRY_RUN=1 logs the
// posts instead of sending them.
//
// Render's free plan keeps no files across restarts, so the channel itself
// remembers what was posted: before posting, the server reads the channel's
// public page (t.me/s/<name>) and skips a post whose opening lines are
// already there. That way an article that arrives with a deploy (which
// restarts the server) is still posted, and nothing is posted twice. If the
// page can't be read, nothing is posted that round.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHANNEL;
const DRY_RUN = process.env.TELEGRAM_DRY_RUN === "1";
// Set for one deploy to check the channel: the latest session's result is
// posted at once (retried each check until it goes out). Remove it after, or
// every restart posts it again.
const TEST_POST = process.env.TELEGRAM_TEST_POST === "1";
// Past sessions' cards to post once, until a date (no setting to add or
// remove on Render). Each opens with a line of its own that tells it from the
// text post of the same session, and the channel page is checked for it, so a
// restart doesn't post it again; the date keeps one from coming back once the
// post has scrolled off the page.
const CARDS_NOW: { until: string; sessions: [string, string, string][] } = {
  until: "2026-11-11",
  sessions: [
    ["2026", "20", "Qualifying"],
    ["2026", "20", "Race"],
  ],
};
const CARDS_INTRO = "🆕 Результати сесій тепер виходять і картками";

const CHECK_MS = 5 * 60_000;
const SESSION_FRESH_MS = 3 * 3600_000; // post a session's result within 3 hours of its end
const PREVIEW_FROM_MS = 10 * 3600_000; // race-day preview: 10 hours before the start…
const PREVIEW_UNTIL_MS = 1 * 3600_000; // …until an hour before it
const ARTICLE_FRESH_DAYS = 2;
const SEASON_FRESH_DAYS = 10; // the season review: within 10 days of the last race

export interface ChannelPost {
  key: string; // what it is about, so it is posted once
  text: string; // Telegram HTML
  url: string; // the page the link preview shows
  // A picture to post the text under instead of the link preview (a session's
  // result card), and until when to wait for it before posting the text alone.
  photo?: () => Promise<Buffer | null>;
  photoWaitUntil?: number;
}

const CARD_WAIT_MS = 60 * 60_000; // a session's card can come a little after its result

const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ukUrl = (path: string) => `${SITE_URL}/uk${path}`;
const gp = (name: string) => gpTitle(name, "uk");

const SESSION_UK: Record<string, string> = {
  "Practice 1": "Практика 1",
  "Practice 2": "Практика 2",
  "Practice 3": "Практика 3",
  Qualifying: "Кваліфікація",
  "Sprint Qualifying": "Спринт-кваліфікація",
  "Sprint Shootout": "Спринт-кваліфікація",
  Sprint: "Спринт",
  Race: "Гонка",
};

// ---------- Posts ----------

export function sessionPost(h: SessionHero): ChannelPost {
  const url = ukUrl(`/calendar/${h.season}/${h.round}`);
  const name = SESSION_UK[h.sessionName] ?? h.sessionName;
  const head = `${h.kind === "race" ? "🏁" : "⏱"} <b>${esc(gp(h.grandPrixName))} · ${esc(name)}</b>`;
  const team = (r: SessionHero["top"][number]) => (r.constructorName ? ` (${esc(r.constructorName)})` : "");
  // the channel is Ukrainian: names as our Ukrainian pages write them
  const who = (r: SessionHero["top"][number]) => {
    const n = r.driverId ? UK_DRIVER_NAMES[r.driverId] : undefined;
    return esc(n ? `${n[0]} ${n[1]}` : r.driverName);
  };
  const medal = ["🥇", "🥈", "🥉"];
  const rows = h.top.map((r, i) => {
    const time = r.time ? `, ${esc(r.time)}` : "";
    if (h.kind === "race") return `${medal[i] ?? `${r.position}.`} ${who(r)}${team(r)}`;
    if (h.kind === "qualifying" && i === 0) return `Поул: ${who(r)}${team(r)}${time}`;
    return `${r.position}. ${who(r)}${team(r)}${time}`;
  });
  const more = h.kind === "race" ? "Повні результати" : "Результати й анонс гонки";
  return {
    key: `session:${h.season}:${h.round}:${h.sessionName}`,
    text: [head, "", ...rows, "", `${more}: ${url}`].join("\n"),
    url,
    photo: () => sessionCard(String(h.season), String(h.round), h.sessionName).catch(() => null),
    photoWaitUntil: Date.parse(h.endedAt) + CARD_WAIT_MS,
  };
}

// Race day: the start in Kyiv time and the preview's facts.
export function previewPost(p: RacePreview, raceStart: number): ChannelPost {
  const url = ukUrl(`/calendar/${p.season}/${p.round}`);
  const when = new Date(raceStart).toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const facts: string[] = [];
  const day = p.weather?.find((d) => d.date === p.race.date);
  if (day) facts.push(`Погода в день гонки: ${day.tMax}°, ймовірність дощу ${day.rain}%`);
  const top = p.gridWinners[0];
  if (top) {
    const tied = p.gridWinners.filter((w) => w.count === top.count).slice(0, 3).map((w) => w.name);
    const names = tied.length > 1 ? `${tied.slice(0, -1).join(", ")} і ${tied[tied.length - 1]}` : tied[0];
    const wins = ukPlural(top.count, ["перемога", "перемоги", "перемог", "перемоги"]);
    facts.push(tied.length > 1 ? `${names}: по ${wins} тут` : `${names}: ${wins} тут`);
  } else if (p.circuit.racesHeld === 0) {
    facts.push("Перша гонка Ф1 на цій трасі");
  }
  if (p.circuit.lapRecord) {
    const r = p.circuit.lapRecord;
    facts.push(`Рекорд кола: ${r.time}, ${r.driverName}, ${r.year}`);
  }
  return {
    key: `preview:${p.season}:${p.round}`,
    text: [
      `🏎 <b>${esc(gp(p.race.name))}</b>`,
      `Старт: ${esc(when)} за Києвом, траса ${esc(p.race.circuitName)}.`,
      "",
      ...facts.map((f) => `• ${esc(f)}`),
      "",
      `Розклад, прогноз і історія траси: ${url}`,
    ].join("\n"),
    url,
  };
}

// A new article: its headline and a teaser of a few sentences (uk.md's
// `telegram`, else its description) to bring readers to the site.
export function articlePost(a: ArticleSummary, teaser = a.description): ChannelPost {
  const url = ukUrl(`/articles/${a.slug}`);
  return {
    key: `article:${a.slug}`,
    text: [`📝 <b>${esc(a.title)}</b>`, "", esc(teaser), "", `Читати: ${url}`].join("\n"),
    url,
  };
}

export function seasonPost(r: SeasonReview): ChannelPost {
  const url = ukUrl(`/seasons/${r.season}`);
  const lines = [`🏆 <b>Сезон Ф1 ${r.season}: підсумки</b>`, ""];
  const uk = r.driver ? UK_DRIVER_NAMES[r.driver.id] : undefined;
  if (r.driver) lines.push(`Чемпіон світу: ${esc(uk ? uk.join(" ") : r.driver.name)} (${esc(r.driver.constructorName)})`);
  if (r.team) lines.push(`Кубок конструкторів: ${esc(r.team.name)}`);
  lines.push(`Гонок: ${r.held}, різних переможців: ${r.wins.length}.`, "", url);
  return { key: `season:${r.season}`, text: lines.join("\n"), url };
}

export function seasonFresh(r: SeasonReview, now: number): boolean {
  if (!r.final) return false;
  const last = r.winners.reduce((m, w) => (w.date > m ? w.date : m), "");
  return !!last && now - Date.parse(`${last}T00:00:00Z`) <= SEASON_FRESH_DAYS * 24 * 3600_000;
}

// ---------- What there is to post now ----------

async function candidates(now: number): Promise<ChannelPost[]> {
  const out: ChannelPost[] = [];

  const hero = latestSessionHero();
  if (hero && now - Date.parse(hero.endedAt) < SESSION_FRESH_MS) out.push(sessionPost(hero));

  const season = await getCurrentSeason();
  const cal = await getCalendar(String(season)).catch(() => null);
  const next = cal?.races.find((r) => !r.winnerDriverId);
  const race = next?.sessions.find((s) => s.kind === "RACE" && s.timeKnown);
  if (next && race) {
    const start = Date.parse(race.start);
    if (start - now <= PREVIEW_FROM_MS && start - now >= PREVIEW_UNTIL_MS) {
      const p = await getRacePreview(String(season), String(next.round)).catch(() => null);
      if (p) out.push(previewPost(p, start));
    }
  }

  const fresh = new Date(now - ARTICLE_FRESH_DAYS * 24 * 3600_000).toISOString().slice(0, 10);
  const teasers = await channelTeasers().catch(() => new Map<string, string>());
  // oldest first, so two new articles go out in the order they were written
  const articles = (await listArticles("uk").catch(() => [])).filter((a) => a.date >= fresh).reverse();
  for (const a of articles) out.push(articlePost(a, teasers.get(a.slug)));

  // The season just ended, also when f1db already lists next year's calendar
  // (then the current season is the new one); only while the last race is
  // recent, so a post that has scrolled off the channel page doesn't return.
  for (const y of [season, season - 1]) {
    const review = await getSeasonReview(y).catch(() => null);
    if (review && seasonFresh(review, now)) out.push(seasonPost(review));
  }
  return out;
}

// ---------- Sending ----------

async function send(post: ChannelPost, photo: Buffer | null = null): Promise<void> {
  if (DRY_RUN) {
    console.log(`[telegram] would post ${post.key}${photo ? ` with a ${Math.round(photo.length / 1024)} KB card` : ""}:\n${post.text}`);
    return;
  }
  if (photo) {
    const form = new FormData();
    form.append("chat_id", CHANNEL!);
    form.append("caption", post.text);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), "card.png");
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHANNEL,
      text: post.text,
      parse_mode: "HTML",
      link_preview_options: { url: post.url, prefer_large_media: true },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

const posted = new Set<string>(); // this run's own posts, so the page isn't read for them again
let testDone = false;

// Letters and digits only, lower case: compares a post with the channel page
// whatever the markup, spacing or emoji around the words.
export const signature = (text: string) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

// The opening of a post that identifies it: its first two lines with text.
export const postId = (post: ChannelPost) =>
  signature(post.text.split("\n").filter((l) => l.trim()).slice(0, 2).join(" "));

async function channelHtml(): Promise<string | null> {
  const name = CHANNEL?.replace(/^@/, "");
  if (!name || /^-?\d+$/.test(name)) return null; // a numeric id has no public page
  try {
    const res = await fetch(`https://t.me/s/${name}`, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function channelPage(): Promise<string | null> {
  const html = await channelHtml();
  return html == null ? null : signature(html);
}

async function testPost(): Promise<void> {
  const hero = latestSessionHero();
  if (!hero) {
    console.warn("[telegram] test post: no session result yet, trying again at the next check");
    return;
  }
  const p = sessionPost(hero);
  try {
    await send(p, (await p.photo?.()) ?? null);
    testDone = true;
    posted.add(p.key);
    console.log(`[telegram] test post sent: ${p.key}`);
  } catch (err) {
    testDone = true; // a refusal won't change by itself: fix the setup and redeploy
    console.warn("[telegram] test post failed:", err instanceof Error ? err.message : err);
  }
}

// The cards asked for in TELEGRAM_CARDS_NOW, in that order.
async function cardsNow(): Promise<void> {
  const page = await channelPage();
  if (page == null) return console.warn("[telegram] cards now: channel page unreadable, trying again at the next check");
  cardsDone = true;
  for (const [season, round, session] of CARDS_NOW.sessions) {
    const hero = await sessionHeroOf(season, round, session).catch(() => null);
    if (!hero) {
      console.warn(`[telegram] cards now: no result for ${season}:${round}:${session}`);
      continue;
    }
    const base = sessionPost(hero);
    // the race is run: its qualifying leads to the results, not the preview
    const text = base.text.replace("Результати й анонс гонки:", "Повні результати:");
    const post = { ...base, key: `${base.key}:card`, text: `${CARDS_INTRO}\n\n${text}` };
    if (page.includes(postId(post))) continue; // posted before this restart
    try {
      await send(post, (await post.photo?.()) ?? null);
      posted.add(post.key);
      console.log(`[telegram] card posted: ${post.key}`);
    } catch (err) {
      console.warn(`[telegram] card ${post.key} not posted:`, err instanceof Error ? err.message : err);
    }
  }
}
let cardsDone = false;

// ---------- Weekend polls (telegramPolls.ts) ----------

const pollMessage = new Map<string, number>(); // poll key -> its message, as posted this run
const pollCount = new Map<string, PollCount>(); // poll key -> Telegram's count when closed
const pollStopped = new Set<string>();
const STOP_FOR_MS = 6 * 3600_000; // keep trying to close a poll for six hours after its session starts

async function telegram<T>(method: string, body: object): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(`Telegram ${method} ${res.status}: ${(json?.description ?? "").slice(0, 200)}`);
  return json.result;
}

// The weekends' polls now: the nine highest in the standings who raced last
// time (a driver who has left the grid doesn't stay an option).
async function currentPolls(now: number): Promise<PollSpec[]> {
  const season = await getCurrentSeason();
  const cal = await getCalendar(String(season)).catch(() => null);
  if (!cal) return [];
  const standings = (await getDriverStandings(String(season)).catch(() => null))?.standings ?? [];
  const last = [...cal.races].reverse().find((r) => r.winnerDriverId);
  const lastWk = last ? await getRaceWeekendNow(String(season), String(last.round)).catch(() => null) : null;
  const racing = lastWk?.results.length ? new Set(lastWk.results.map((r) => r.driverId)) : undefined;
  return pollSpecs(season, cal.races, pollOptions(standings, racing), now);
}

async function winnerOf(p: PollSpec): Promise<{ driverId: string; name: string } | null> {
  const wk = await getRaceWeekendNow(String(p.season), String(p.round)).catch(() => null);
  if (!wk) return null;
  if (p.kind === "Q") {
    const q = wk.qualifying.find((x) => x.position === 1);
    return q?.driverId ? { driverId: q.driverId, name: q.driverName } : null;
  }
  const r = wk.results.find((x) => x.positionText === "1");
  return r?.driverId ? { driverId: r.driverId, name: r.driverName } : null;
}

// A weekend's polls as posted: the intro's message and the kinds after it.
// After a restart it is found again on the channel page by the intro's text.
function postedBundle(html: string, p: PollSpec, url: string): { intro: number; kinds: PollKind[] } | null {
  for (const kinds of [["Q", "RACE"], ["Q"], ["RACE"]] as PollKind[][]) {
    const head = introText(p.grandPrixName, p.season, kinds, url).split("\n")[0];
    const id = findPost(html, head, signature);
    if (id != null) return { intro: id, kinds };
  }
  return null;
}

export async function polls(now: number): Promise<void> {
  const specs = await currentPolls(now);
  if (!specs.length) return;
  const html = await channelHtml();
  if (html == null) return; // without the page nothing is posted twice: wait for the next check

  const weekends = new Map<string, PollSpec[]>();
  for (const p of specs) weekends.set(`${p.season}:${p.round}`, [...(weekends.get(`${p.season}:${p.round}`) ?? []), p]);

  for (const [wkKey, list] of weekends) {
    const url = ukUrl(`/calendar/${list[0].season}/${list[0].round}`);
    let bundle = postedBundle(html, list[0], url);

    // 1. Post the intro and the open polls together, once a weekend.
    const open = list.filter((p) => canPost(p, now));
    const introKey = `poll:${wkKey}:intro`;
    if (open.length && !bundle && !posted.has(introKey)) {
      posted.add(introKey);
      const kinds = open.map((p) => p.kind);
      try {
        if (DRY_RUN) {
          console.log(`[telegram] would post the polls for ${wkKey}:\n${introText(list[0].grandPrixName, list[0].season, kinds, url)}`);
          for (const p of open) console.log(`  ${p.question} / ${p.options.map((o) => o.text).join(" | ")}`);
        } else {
          const intro = await telegram<{ message_id: number }>("sendMessage", {
            chat_id: CHANNEL,
            text: introText(list[0].grandPrixName, list[0].season, kinds, url),
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          });
          for (const p of open) {
            const msg = await telegram<{ message_id: number }>("sendPoll", {
              chat_id: CHANNEL,
              question: p.question,
              options: p.options.map((o) => ({ text: o.text })),
              is_anonymous: true,
            });
            pollMessage.set(p.key, msg.message_id);
          }
          bundle = { intro: intro.message_id, kinds };
          console.log(`[telegram] posted the polls for ${wkKey}: ${kinds.join(", ")}`);
        }
      } catch (err) {
        console.warn(`[telegram] polls for ${wkKey} not posted:`, err instanceof Error ? err.message : err);
      }
    }
    if (DRY_RUN || !bundle) continue; // nothing in the channel to close or answer

    for (const p of list) {
      const at = bundle.kinds.indexOf(p.kind);
      if (at < 0) continue; // this one wasn't asked
      const id = pollMessage.get(p.key) ?? bundle.intro + 1 + at;

      // 2. Close it when its session starts, keeping Telegram's count.
      if (now >= p.closesAt && now < p.closesAt + STOP_FOR_MS && !pollStopped.has(p.key)) {
        pollStopped.add(p.key);
        try {
          const poll = await telegram<{ total_voter_count: number; options: { text: string; voter_count: number }[] }>("stopPoll", {
            chat_id: CHANNEL,
            message_id: id,
          });
          pollCount.set(p.key, { total: poll.total_voter_count, options: poll.options.map((o) => ({ text: o.text, votes: o.voter_count })) });
          console.log(`[telegram] closed poll ${p.key}: ${poll.total_voter_count} votes`);
        } catch (err) {
          // already closed (by hand, or before a restart): the answer goes out without the count
          console.warn(`[telegram] poll ${p.key} not closed:`, err instanceof Error ? err.message : err);
        }
      }

      // 3. The answer, once the session's result is in.
      const key = `${p.key}:answer`;
      if (now < p.closesAt || posted.has(key)) continue;
      const winner = await winnerOf(p);
      if (!winner) continue;
      const post: ChannelPost = { key, text: answerText(p, winner, pollCount.get(p.key) ?? null, url), url };
      posted.add(key);
      if (signature(html).includes(postId(post))) continue; // answered before a restart
      try {
        await send(post);
        console.log(`[telegram] posted ${key}`);
      } catch (err) {
        console.warn(`[telegram] ${key} not posted:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

async function check(): Promise<void> {
  await polls(Date.now()).catch((err) => console.warn("[telegram] polls failed:", err instanceof Error ? err.message : err));
  if (!cardsDone && new Date().toISOString().slice(0, 10) <= CARDS_NOW.until) await cardsNow();
  if (TEST_POST && !testDone) await testPost();
  const posts = (await candidates(Date.now())).filter((p) => !posted.has(p.key));
  if (!posts.length) return;
  const page = await channelPage();
  if (page == null) {
    console.warn("[telegram] channel page unreadable, nothing posted this round");
    return;
  }
  for (const p of posts) {
    if (page.includes(postId(p))) {
      posted.add(p.key); // already in the channel
      continue;
    }
    // a post with a card waits for it (a few checks), then goes out as text
    const photo = p.photo ? await p.photo() : null;
    if (p.photo && !photo && Date.now() < (p.photoWaitUntil ?? 0)) continue;
    posted.add(p.key);
    try {
      await send(p, photo);
      console.log(`[telegram] posted ${p.key}`);
    } catch (err) {
      console.warn(`[telegram] ${p.key} not posted:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Starts the channel's checks, when a channel is set up. */
export function startChannel(): void {
  if (!CHANNEL || (!TOKEN && !DRY_RUN)) {
    // Say what is missing (names only), so a channel that stays quiet is easy to fix.
    const missing = [!CHANNEL && "TELEGRAM_CHANNEL", !TOKEN && !DRY_RUN && "TELEGRAM_BOT_TOKEN"].filter(Boolean);
    console.log(`[telegram] channel posts off: ${missing.join(" and ")} not set`);
    return;
  }
  const run = () => void check().catch((err) => console.warn("[telegram] check failed:", err));
  // After the session hero's first look at OpenF1 (warmSessionHero, 5 s in).
  setTimeout(run, 60_000).unref();
  setInterval(run, CHECK_MS).unref();
  console.log(`[telegram] posting to ${CHANNEL}${DRY_RUN ? " (dry run)" : ""}`);
}
