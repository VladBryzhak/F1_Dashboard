import { cached } from "../cache/cache";
import type { NewsItem } from "../types/f1";

// Motorsport.com's F1 news feed (RSS 2.0). We only surface headline + link +
// date, always linking back to the source — standard RSS syndication, no
// article body is reproduced.
const FEED_URL = "https://www.motorsport.com/rss/f1/news/";
const SOURCE = "Motorsport.com";

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "") // strip any stray tags
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
}

// Minimal RSS 2.0 <item> parser — no XML dependency needed for this shape.
function parseFeed(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) && items.length < limit) {
    const block = match[0];
    const rawTitle = tag(block, "title");
    const rawLink = tag(block, "link");
    if (!rawTitle || !rawLink) continue;
    const title = decodeEntities(rawTitle);
    const link = decodeEntities(rawLink);
    if (!title || !link) continue;
    const rawDate = tag(block, "pubDate");
    const parsed = rawDate ? new Date(rawDate) : null;
    items.push({
      title,
      link,
      source: SOURCE,
      pubDate:
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : new Date().toISOString(),
    });
  }
  return items;
}

/**
 * Latest F1 news headlines. Cached for 30 minutes. Callers should treat a
 * rejection as "no news" — the home route degrades gracefully.
 */
export async function getNews(limit = 6): Promise<NewsItem[]> {
  return cached(`news:f1:${limit}`, 30 * 60, async () => {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "f1-dashboard (+https://github.com/VladBryzhak/F1_Dashboard)" },
    });
    if (!res.ok) throw new Error(`news feed failed: ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, limit);
  });
}
