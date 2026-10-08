import { cached } from "../cache/cache";
import { getAllDrivers } from "./f1db";

// Driver photos from Wikipedia / Wikimedia Commons. f1db has no image link, so
// we match by name via the MediaWiki "pageimages" API. Images are mostly
// CC-BY-SA / public domain (credited in the footer). ~85% of drivers resolve,
// including historic ones; the rest simply have no photo.
const WIKI = "https://en.wikipedia.org/w/api.php";
const UA = "F1Dashboard/1.0 (https://f1-dashboard-bryzhak.onrender.com)";
const BATCH = 50; // MediaWiki allows up to 50 titles per query
const THUMB = 400;

interface WikiResp {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; thumbnail?: { source: string } }>;
  };
}

// Query a batch of names → Map<queried name, thumbnail URL>, following the
// normalize/redirect chains the API reports so we can map results back.
async function fetchThumbs(names: string[]): Promise<Map<string, string>> {
  const url =
    `${WIKI}?action=query&format=json&redirects=1&prop=pageimages` +
    `&piprop=thumbnail&pithumbsize=${THUMB}&titles=` +
    encodeURIComponent(names.join("|"));

  let data: WikiResp;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return new Map();
    data = (await res.json()) as WikiResp;
  } catch {
    return new Map();
  }

  const q = data.query ?? {};
  const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q.redirects ?? []).map((r) => [r.from, r.to]));
  const titleToThumb = new Map<string, string>();
  for (const p of Object.values(q.pages ?? {})) {
    if (p.thumbnail?.source) {
      // The API sometimes returns the thumb.wikimedia.org host, which browsers
      // won't hotlink; upload.wikimedia.org serves the same path and does.
      const src = p.thumbnail.source.replace(
        "://thumb.wikimedia.org/",
        "://upload.wikimedia.org/",
      );
      titleToThumb.set(p.title, src);
    }
  }

  const out = new Map<string, string>();
  for (const name of names) {
    let t = name;
    if (norm.has(t)) t = norm.get(t)!;
    if (redir.has(t)) t = redir.get(t)!;
    const thumb = titleToThumb.get(t);
    if (thumb) out.set(name, thumb);
  }
  return out;
}

// Photos for every driver, keyed by driverId. Cold builds hit ~19 Wikipedia
// batches, so cache for a day.
export async function getDriverPhotos(): Promise<Record<string, string>> {
  return cached("driver:photos", 24 * 3600, async () => {
    const drivers = await getAllDrivers();
    const out: Record<string, string> = {};
    for (let i = 0; i < drivers.length; i += BATCH) {
      const slice = drivers.slice(i, i + BATCH);
      const map = await fetchThumbs(slice.map((d) => d.name));
      for (const d of slice) {
        const u = map.get(d.name);
        if (u) out[d.driverId] = u;
      }
      await new Promise((r) => setTimeout(r, 120)); // be polite to the API
    }
    return out;
  });
}

// One driver's photo (for the profile page), cached per name.
export async function getDriverPhoto(name: string): Promise<string | null> {
  return cached(`driver:photo:${name}`, 24 * 3600, async () => {
    const map = await fetchThumbs([name]);
    return map.get(name) ?? null;
  });
}
