import { channelTeasers, listArticles } from "./articles";
import { getCalendar, getCurrentSeason, getSeasonReview } from "./f1db";
import { gpTitle } from "./gpNames";
import { SITE_URL } from "./pageHtml";
import { getRacePreview } from "./racePreview";
import { latestSessionHero } from "./sessionHero";
import { ukPlural } from "./ukText";
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

const CHECK_MS = 5 * 60_000;
const SESSION_FRESH_MS = 3 * 3600_000; // post a session's result within 3 hours of its end
const PREVIEW_FROM_MS = 10 * 3600_000; // race-day preview: 10 hours before the start…
const PREVIEW_UNTIL_MS = 1 * 3600_000; // …until an hour before it
const ARTICLE_FRESH_DAYS = 2;

export interface ChannelPost {
  key: string; // what it is about, so it is posted once
  text: string; // Telegram HTML
  url: string; // the page the link preview shows
}

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
  const medal = ["🥇", "🥈", "🥉"];
  const rows = h.top.map((r, i) => {
    const time = r.time ? `, ${esc(r.time)}` : "";
    if (h.kind === "race") return `${medal[i] ?? `${r.position}.`} ${esc(r.driverName)}${team(r)}`;
    if (h.kind === "qualifying" && i === 0) return `Поул: ${esc(r.driverName)}${team(r)}${time}`;
    return `${r.position}. ${esc(r.driverName)}${team(r)}${time}`;
  });
  const more = h.kind === "race" ? "Повні результати" : "Результати й анонс гонки";
  return {
    key: `session:${h.season}:${h.round}:${h.sessionName}`,
    text: [head, "", ...rows, "", `${more}: ${url}`].join("\n"),
    url,
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
  if (r.driver) lines.push(`Чемпіон світу: ${esc(r.driver.name)} (${esc(r.driver.constructorName)})`);
  if (r.team) lines.push(`Кубок конструкторів: ${esc(r.team.name)}`);
  lines.push(`Гонок: ${r.held}, різних переможців: ${r.wins.length}.`, "", url);
  return { key: `season:${r.season}`, text: lines.join("\n"), url };
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

  const review = await getSeasonReview(season).catch(() => null);
  if (review?.final) out.push(seasonPost(review));
  return out;
}

// ---------- Sending ----------

async function send(post: ChannelPost): Promise<void> {
  if (DRY_RUN) {
    console.log(`[telegram] would post ${post.key}:\n${post.text}`);
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

async function channelPage(): Promise<string | null> {
  const name = CHANNEL?.replace(/^@/, "");
  if (!name || /^-?\d+$/.test(name)) return null; // a numeric id has no public page
  try {
    const res = await fetch(`https://t.me/s/${name}`, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? signature(await res.text()) : null;
  } catch {
    return null;
  }
}

async function testPost(): Promise<void> {
  const hero = latestSessionHero();
  if (!hero) {
    console.warn("[telegram] test post: no session result yet, trying again at the next check");
    return;
  }
  const p = sessionPost(hero);
  try {
    await send(p);
    testDone = true;
    posted.add(p.key);
    console.log(`[telegram] test post sent: ${p.key}`);
  } catch (err) {
    testDone = true; // a refusal won't change by itself: fix the setup and redeploy
    console.warn("[telegram] test post failed:", err instanceof Error ? err.message : err);
  }
}

async function check(): Promise<void> {
  if (TEST_POST && !testDone) await testPost();
  const posts = (await candidates(Date.now())).filter((p) => !posted.has(p.key));
  if (!posts.length) return;
  const page = await channelPage();
  if (page == null) {
    console.warn("[telegram] channel page unreadable, nothing posted this round");
    return;
  }
  for (const p of posts) {
    posted.add(p.key);
    if (page.includes(postId(p))) continue; // already in the channel
    try {
      await send(p);
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
