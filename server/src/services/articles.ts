import fs from "fs";
import path from "path";
import { Marked, type Tokens } from "marked";
import { cached } from "../cache/cache";
import { getCalendar } from "./f1db";
import type { Lang } from "./gpNames";
import type {
  Article,
  ArticleCover,
  ArticleDay,
  ArticleSummary,
  ArticleTag,
  CalendarRace,
  HomeArticle,
} from "../types/f1";

// Our own articles, kept in the repo as files (content/articles/<slug>/):
//
//   meta.json  what both languages share: date, season, round, day of the
//              weekend, topic, cover
//   en.md      the English text, uk.md the Ukrainian: a short front matter
//   uk.md      (title, description, readingLabel) and the body in Markdown
//
// The body may hold three blocks of our own, written as fenced code blocks
// with "key: value" lines:
//
//   ```stats          a row of key numbers ("- Label: value" lines,
//   title: …          optional title and source)
//   - Points: 380
//   source: …
//   ```
//   ```figure         a photo with its credit (src, alt, caption,
//   src: …            credit, creditUrl, width, height)
//   ```
//   ```instagram      an Instagram post, loaded only when the reader asks
//   url: …            (url, handle)
//   ```
//
// Links to our own pages are written without the language (/drivers/…); the
// Ukrainian text gets /uk/… An article must exist in both languages, or it
// isn't published.

const DIR = path.resolve(__dirname, "../../../content/articles");

const DAYS: ArticleDay[] = ["fri", "sat", "sun", "midweek"];
const TAGS: ArticleTag[] = ["analysis", "race", "sprint", "qualifying", "practice", "drivers", "teams", "preview"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// How long the home page keeps showing the latest article.
const HOME_DAYS = 14;
// About how fast people read; rounded up, so at least a minute.
const WORDS_PER_MINUTE = 200;

const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    photo: "Photo",
    igLabel: "Instagram post",
    igNote: "The post loads from instagram.com when you press the button. Instagram may set its own cookies.",
    igShow: "Show post",
    igOpen: "Open in Instagram",
    igPost: "Post",
    source: "Data",
  },
  uk: {
    photo: "Фото",
    igLabel: "Пост з Instagram",
    igNote: "Пост завантажиться з instagram.com, коли ви натиснете кнопку. Instagram може встановити свої cookies.",
    igShow: "Показати пост",
    igOpen: "Відкрити в Instagram",
    igPost: "Пост",
    source: "Дані",
  },
};

// Topic and day names, for the server's own text (titles, previews, crawler
// snapshots); the app has the same in its i18n files (art.tag.*, art.day.*).
export const TAG_LABEL: Record<Lang, Record<ArticleTag, string>> = {
  en: {
    analysis: "Analysis",
    race: "Race",
    sprint: "Sprint",
    qualifying: "Qualifying",
    practice: "Practice",
    drivers: "Drivers",
    teams: "Teams",
    preview: "Preview",
  },
  uk: {
    analysis: "Аналітика",
    race: "Гонка",
    sprint: "Спринт",
    qualifying: "Кваліфікація",
    practice: "Практики",
    drivers: "Пілоти",
    teams: "Команди",
    preview: "Анонс",
  },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "key: value" lines; "- label: value" lines are rows, in order.
export function readBlock(text: string): { fields: Record<string, string>; rows: [string, string][] } {
  const fields: Record<string, string> = {};
  const rows: [string, string][] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const row = /^-\s+(.+?):\s*(.+)$/.exec(line);
    if (row) {
      rows.push([row[1], row[2]]);
      continue;
    }
    const m = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2];
  }
  return { fields, rows };
}

// Front matter between "---" lines at the top: flat "key: value" pairs.
export function splitFrontMatter(src: string): { fields: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { fields: {}, body: src };
  return { fields: readBlock(m[1]).fields, body: src.slice(m[0].length) };
}

const isOurs = (href: string) => href.startsWith("/") && !href.startsWith("//");
const httpUrl = (s: string | undefined) => (s && /^https:\/\//.test(s) ? s : null);

// A stats value is drawn by its shape, each cell in its order:
// - "tile": a short reading ("380", "+17", "45 points") as a big number with a small unit;
// - "chips": a short sequence ("7th, 7th, 9th") as a row of chips;
// - "line": anything longer, as a label and value across the panel.
// Consecutive tiles share one grid, so a row never ends in a gap.
const NUM = String.raw`[+\-−]?P?\d(?:[\d.,:]*\d)?(?:-[\p{L}]+|st|nd|rd|th|%)?`;
const NUMBER = new RegExp(String.raw`^(${NUM}(?:\s*(?:→|to|до|and|і|of|з)\s*${NUM})?)(?:,?\s+(\p{L}[\p{L}\d'’ ]{0,11}))?$`, "u");

type StatCell = { kind: "tile" | "chips" | "line"; html: string };

function statCell(label: string, value: string): StatCell {
  const dt = `<dt>${esc(label)}</dt>`;
  const num = value.length <= 18 ? NUMBER.exec(value) : null;
  if (num) {
    const unit = num[2] ? ` <span class="art-stat-unit">${esc(num[2])}</span>` : "";
    const long = num[1].length > 6 ? " art-stat-num--long" : "";
    return { kind: "tile", html: `<div>${dt}<dd><span class="art-stat-num${long} mono">${esc(num[1])}</span>${unit}</dd></div>` };
  }
  const parts = value.split(/,\s*/);
  if (parts.length >= 3 && parts.every((x) => x.length > 0 && x.length <= 6)) {
    const chips = parts.map((x) => `<li class="mono">${esc(x)}</li>`).join("");
    return { kind: "chips", html: `<div>${dt}<dd><ol class="art-stat-chips">${chips}</ol></dd></div>` };
  }
  return { kind: "line", html: `<div>${dt}<dd>${esc(value)}</dd></div>` };
}

function statsBlock(text: string, lang: Lang): string {
  const { fields, rows } = readBlock(text);
  if (!rows.length) return "";
  const title = fields.title ? `<h2 class="art-stats-title">${esc(fields.title)}</h2>` : "";
  const groups: { tiles: boolean; cells: string[] }[] = [];
  for (const [k, v] of rows) {
    const cell = statCell(k, v);
    const tiles = cell.kind === "tile";
    const last = groups[groups.length - 1];
    if (last && last.tiles === tiles) last.cells.push(cell.html);
    else groups.push({ tiles, cells: [cell.html] });
  }
  const body = groups
    .map((g) => `<dl class="${g.tiles ? "art-stat-tiles" : "art-stat-lines"}">${g.cells.join("")}</dl>`)
    .join("");
  const source = fields.source ? `<p class="art-stats-src">${LABELS[lang].source}: ${esc(fields.source)}</p>` : "";
  return `<aside class="art-stats">${title}${body}${source}</aside>`;
}

function credit(lang: Lang, who: string | undefined, url: string | null): string {
  if (!who) return "";
  const name = url ? `<a href="${esc(url)}" rel="noopener noreferrer" target="_blank">${esc(who)}</a>` : esc(who);
  return `<span class="art-credit">${LABELS[lang].photo}: ${name}</span>`;
}

function figureBlock(text: string, lang: Lang): string {
  const { fields } = readBlock(text);
  if (!fields.src) return "";
  // Our own files (/media/…) or a full https address.
  const src = isOurs(fields.src) ? fields.src : httpUrl(fields.src);
  if (!src) return "";
  const size =
    /^\d+$/.test(fields.width ?? "") && /^\d+$/.test(fields.height ?? "")
      ? ` width="${fields.width}" height="${fields.height}"`
      : "";
  const caption = [fields.caption ? esc(fields.caption) : "", credit(lang, fields.credit, httpUrl(fields.creditUrl))]
    .filter(Boolean)
    .join(" ");
  return (
    `<figure class="art-figure"><img src="${esc(src)}" alt="${esc(fields.alt ?? "")}"${size} loading="lazy" decoding="async" />` +
    (caption ? `<figcaption>${caption}</figcaption>` : "") +
    `</figure>`
  );
}

// An Instagram post as a placeholder: nothing is fetched from Instagram
// until the reader presses the button (the app then puts the post's own
// embed frame in its place).
export function instagramBlock(text: string, lang: Lang): string {
  const { fields } = readBlock(text);
  const m = /^https:\/\/(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)\/?/.exec(fields.url ?? "");
  if (!m) return "";
  const url = `https://www.instagram.com/${m[1]}/${m[2]}/`;
  const handle = (fields.handle ?? "").replace(/^@/, "");
  const who = handle ? `@${esc(handle)}` : "";
  const l = LABELS[lang];
  return (
    `<figure class="art-ig" data-ig="${esc(url)}">` +
    `<div class="art-ig-box">` +
    `<span class="art-ig-label">${l.igLabel}</span>` +
    (who ? `<span class="art-ig-handle">${who}</span>` : "") +
    `<p class="art-ig-note">${l.igNote}</p>` +
    `<button type="button" class="btn art-ig-show">${l.igShow}</button>` +
    `<a class="art-ig-open" href="${esc(url)}" rel="noopener noreferrer" target="_blank">${l.igOpen}</a>` +
    `</div>` +
    (who ? `<figcaption><span class="art-credit">${l.igPost}: ${who}, Instagram</span></figcaption>` : "") +
    `</figure>`
  );
}

// Markdown → HTML, with our blocks and links that keep the page's language.
export function renderBody(md: string, lang: Lang): string {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      code(code: string, info: string | undefined) {
        const kind = (info ?? "").trim();
        if (kind === "stats") return statsBlock(code, lang);
        if (kind === "figure") return figureBlock(code, lang);
        if (kind === "instagram") return instagramBlock(code, lang);
        return false;
      },
      link(href: string, title: string | null | undefined, text: string) {
        const t = title ? ` title="${esc(title)}"` : "";
        if (isOurs(href)) {
          const local = lang === "uk" ? (href === "/" ? "/uk" : `/uk${href}`) : href;
          return `<a href="${esc(local)}"${t}>${text}</a>`;
        }
        return `<a href="${esc(href)}"${t} rel="noopener noreferrer" target="_blank">${text}</a>`;
      },
      // No raw HTML from the files: everything goes through the blocks above.
      html(token: Tokens.HTML | Tokens.Tag | string) {
        const raw = typeof token === "string" ? token : token.text;
        return esc(raw);
      },
    },
  });
  return marked.parse(md, { async: false }) as string;
}

// Reading time from the text without its blocks and markup.
export function readingMinutes(md: string): number {
  const words = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

interface Meta {
  date: string;
  season: number;
  round: number | null;
  day: ArticleDay;
  tag: ArticleTag;
  cover: {
    driverId?: string;
    constructorId?: string;
    number?: string;
    reading?: string;
    credit?: string;
  };
}

interface Text {
  title: string;
  description: string;
  readingLabel: string | null;
  telegram: string | null; // the channel post's teaser (uk.md), else the description
  body: string;
}

interface Loaded {
  slug: string;
  meta: Meta;
  text: Record<Lang, Text>;
}

function readMeta(file: string): Meta | string {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return `meta.json: ${(err as Error).message}`;
  }
  const date = String(raw.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return "meta.json: date must be yyyy-mm-dd";
  const season = Number(raw.season ?? date.slice(0, 4));
  if (!Number.isInteger(season)) return "meta.json: season";
  const round = raw.round == null ? null : Number(raw.round);
  if (round != null && !(Number.isInteger(round) && round > 0)) return "meta.json: round";
  const day = raw.day as ArticleDay;
  if (!DAYS.includes(day)) return `meta.json: day must be one of ${DAYS.join(", ")}`;
  const tag = raw.tag as ArticleTag;
  if (!TAGS.includes(tag)) return `meta.json: tag must be one of ${TAGS.join(", ")}`;
  const cover = (raw.cover ?? {}) as Meta["cover"];
  if (typeof cover !== "object") return "meta.json: cover";
  return { date, season, round, day, tag, cover };
}

function readText(file: string): Text | string {
  let src: string;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    return `${path.basename(file)} is missing`;
  }
  const { fields, body } = splitFrontMatter(src);
  if (!fields.title || !fields.description) return `${path.basename(file)}: title and description are required`;
  return { title: fields.title, description: fields.description, readingLabel: fields.readingLabel || null, telegram: fields.telegram || null, body };
}

// Every article on disk that is complete in both languages. A broken one is
// left out with a warning in the server log, so one bad file never takes the
// section down.
export function loadArticles(dir = DIR): Loaded[] {
  let slugs: string[];
  try {
    slugs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  const out: Loaded[] = [];
  for (const slug of slugs) {
    if (!SLUG.test(slug)) {
      console.warn(`[articles] ${slug}: the folder name must be lower-case words joined by hyphens`);
      continue;
    }
    const meta = readMeta(path.join(dir, slug, "meta.json"));
    const en = readText(path.join(dir, slug, "en.md"));
    const uk = readText(path.join(dir, slug, "uk.md"));
    const problem = [meta, en, uk].find((x): x is string => typeof x === "string");
    if (problem) {
      console.warn(`[articles] ${slug}: ${problem}`);
      continue;
    }
    out.push({ slug, meta: meta as Meta, text: { en: en as Text, uk: uk as Text } });
  }
  // Newest first; the same day by the weekend's order (Sunday after Saturday).
  const dayOrder = (d: ArticleDay) => DAYS.indexOf(d);
  return out.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || dayOrder(b.meta.day) - dayOrder(a.meta.day));
}

// The files change only with a deploy; a short cache keeps editing in dev
// quick to see.
const all = () => cached("articles:all", 60, async () => loadArticles());

async function raceOf(season: number, round: number | null): Promise<CalendarRace | null> {
  if (round == null) return null;
  const cal = await getCalendar(String(season)).catch(() => null);
  return cal?.races.find((r) => r.round === round) ?? null;
}

function cover(a: Loaded, lang: Lang): ArticleCover {
  const c = a.meta.cover;
  return {
    driverId: c.driverId ?? null,
    constructorId: c.constructorId ?? null,
    number: c.number ?? null,
    reading: c.reading ?? null,
    readingLabel: a.text[lang].readingLabel,
    // A driver portrait is formula1.com's unless the article names another source.
    credit: c.credit ?? (c.driverId ? "Formula 1" : null),
  };
}

async function summary(a: Loaded, lang: Lang): Promise<ArticleSummary> {
  const race = await raceOf(a.meta.season, a.meta.round);
  const t = a.text[lang];
  return {
    slug: a.slug,
    date: a.meta.date,
    season: a.meta.season,
    round: a.meta.round,
    grandPrixName: race?.name ?? null,
    raceDate: race?.date ?? null,
    day: a.meta.day,
    tag: a.meta.tag,
    title: t.title,
    description: t.description,
    minutes: readingMinutes(t.body),
    cover: cover(a, lang),
  };
}

/** The Telegram teaser of each article (uk.md's `telegram`, else its description), by slug. */
export async function channelTeasers(): Promise<Map<string, string>> {
  return new Map((await all()).map((a) => [a.slug, a.text.uk.telegram ?? a.text.uk.description]));
}

export async function listArticles(lang: Lang): Promise<ArticleSummary[]> {
  return Promise.all((await all()).map((a) => summary(a, lang)));
}

export async function hasArticle(slug: string): Promise<boolean> {
  return (await all()).some((a) => a.slug === slug);
}

export async function getArticle(slug: string, lang: Lang): Promise<Article | null> {
  const list = await all();
  const a = list.find((x) => x.slug === slug);
  if (!a) return null;
  const html = await cached(`articles:html:${slug}:${lang}`, 60, async () => renderBody(a.text[lang].body, lang));
  const related = await Promise.all(
    list
      .filter((x) => x.slug !== slug)
      .slice(0, 3)
      .map((x) => summary(x, lang)),
  );
  return { ...(await summary(a, lang)), html, related };
}

// The newest article for the home slider while it is recent.
export async function homeArticle(now = Date.now()): Promise<HomeArticle | null> {
  const a = (await all())[0];
  if (!a || now - Date.parse(a.meta.date) > HOME_DAYS * 86_400_000) return null;
  const c = cover(a, "en");
  const text = (lang: Lang) => ({
    title: a.text[lang].title,
    description: a.text[lang].description,
    minutes: readingMinutes(a.text[lang].body),
    readingLabel: a.text[lang].readingLabel,
  });
  return {
    slug: a.slug,
    date: a.meta.date,
    tag: a.meta.tag,
    cover: { driverId: c.driverId, constructorId: c.constructorId, number: c.number, reading: c.reading, credit: c.credit },
    en: text("en"),
    uk: text("uk"),
  };
}
