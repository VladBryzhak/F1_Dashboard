import { cached } from "../cache/cache";
import { getConstructorDirectory } from "./f1db";
import type { TeamImage } from "../types/f1";

// Team imagery from Wikipedia / Wikidata / Wikimedia Commons, license-checked.
// Team emblems are trademarks and many are non-free, so unlike driver photos we
// cannot take whatever the page shows. Instead we resolve each team's Wikidata
// item and read its logo (P154) and representative image (P18), then verify the
// file's licence on Commons. We keep a FREE logo if there is one; otherwise a
// FREE photo (typically a car); otherwise nothing (the UI shows a colour tile).
// PD logos and CC photos are credited in the site footer.
const WIKI = "https://en.wikipedia.org/w/api.php";
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const UA = "F1Dashboard/1.0 (https://f1-dashboard-bryzhak.onrender.com)";
const BATCH = 50;
const THUMB = 200;

// Public domain or any Creative Commons licence is fine to reuse (with credit).
const FREE = /public domain|^cc[\s-]|creativecommons|^pd(?![a-z])/i;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// upload.wikimedia.org serves the same path and allows hotlinking; the API
// sometimes hands back the thumb.wikimedia.org host, which browsers block.
function hotlink(url: string): string {
  return url.replace("://thumb.wikimedia.org/", "://upload.wikimedia.org/");
}

interface WikiPagesResp {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; pageprops?: { wikibase_item?: string } }>;
  };
}

// Batch: article title -> Wikidata QID, following normalize/redirect chains.
async function titlesToQids(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const data = await getJson<WikiPagesResp>(
    `${WIKI}?action=query&format=json&redirects=1&prop=pageprops` +
      `&ppprop=wikibase_item&titles=${encodeURIComponent(names.join("|"))}`,
  );
  const q = data?.query;
  if (!q) return out;
  const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
  const redir = new Map((q.redirects ?? []).map((r) => [r.from, r.to]));
  const titleQid = new Map<string, string>();
  for (const p of Object.values(q.pages ?? {})) {
    const qid = p.pageprops?.wikibase_item;
    if (qid) titleQid.set(p.title, qid);
  }
  for (const name of names) {
    let t = name;
    if (norm.has(t)) t = norm.get(t)!;
    if (redir.has(t)) t = redir.get(t)!;
    const qid = titleQid.get(t);
    if (qid) out.set(name, qid);
  }
  return out;
}

interface WdResp {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        { mainsnak?: { datavalue?: { value?: string } } }[]
      >;
    }
  >;
}

// Batch: QID -> { logo file (P154), image file (P18) } (Commons filenames).
async function qidsToFiles(
  qids: string[],
): Promise<Map<string, { logo?: string; image?: string }>> {
  const out = new Map<string, { logo?: string; image?: string }>();
  const data = await getJson<WdResp>(
    `${WIKIDATA}?action=wbgetentities&format=json&props=claims&ids=${qids.join("|")}`,
  );
  const ents = data?.entities ?? {};
  const file = (c?: { mainsnak?: { datavalue?: { value?: string } } }[]) =>
    c?.[0]?.mainsnak?.datavalue?.value;
  for (const [qid, e] of Object.entries(ents)) {
    out.set(qid, {
      logo: file(e.claims?.P154),
      image: file(e.claims?.P18),
    });
  }
  return out;
}

interface CommonsResp {
  query?: {
    pages?: Record<
      string,
      {
        title: string;
        imageinfo?: {
          thumburl?: string;
          extmetadata?: { LicenseShortName?: { value?: string } };
        }[];
      }
    >;
  };
}

// Batch: "File:x" -> { thumb, free } by reading each file's licence on Commons.
async function fileLicences(
  files: string[],
): Promise<Map<string, { thumb: string; free: boolean }>> {
  const out = new Map<string, { thumb: string; free: boolean }>();
  for (let i = 0; i < files.length; i += 25) {
    const slice = files.slice(i, i + 25);
    const data = await getJson<CommonsResp>(
      `${COMMONS}?action=query&format=json&prop=imageinfo` +
        `&iiprop=url%7Cextmetadata&iiurlwidth=${THUMB}` +
        `&iiextmetadatafilter=LicenseShortName` +
        `&titles=${encodeURIComponent(slice.join("|"))}`,
    );
    for (const p of Object.values(data?.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl) continue;
      const lic = ii.extmetadata?.LicenseShortName?.value ?? "";
      out.set(p.title, { thumb: hotlink(ii.thumburl), free: FREE.test(lic) });
    }
    await new Promise((r) => setTimeout(r, 120)); // be polite to the API
  }
  return out;
}

// Build { constructorId -> { url, type } } for every team with a FREE logo or
// photo. Cold build ~15-20 API calls, so cache for a day.
export async function getTeamImages(): Promise<Record<string, TeamImage>> {
  return cached("team:images", 24 * 3600, async () => {
    const teams = await getConstructorDirectory();

    // 1) team fullName -> Wikidata QID
    const nameToQid = new Map<string, string>();
    for (let i = 0; i < teams.length; i += BATCH) {
      const slice = teams.slice(i, i + BATCH).map((t) => t.fullName);
      for (const [n, qid] of await titlesToQids(slice)) nameToQid.set(n, qid);
      await new Promise((r) => setTimeout(r, 120));
    }

    // 2) QID -> logo/image filenames
    const qids = [...new Set([...nameToQid.values()])];
    const qidFiles = new Map<string, { logo?: string; image?: string }>();
    for (let i = 0; i < qids.length; i += BATCH) {
      for (const [q, f] of await qidsToFiles(qids.slice(i, i + BATCH))) {
        qidFiles.set(q, f);
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    // 3) licence-check every candidate file on Commons
    const candidateFiles = new Set<string>();
    for (const f of qidFiles.values()) {
      if (f.logo) candidateFiles.add("File:" + f.logo);
      if (f.image) candidateFiles.add("File:" + f.image);
    }
    const lic = await fileLicences([...candidateFiles]);

    // 4) assemble: prefer a free logo, else a free photo.
    const out: Record<string, TeamImage> = {};
    for (const t of teams) {
      const qid = nameToQid.get(t.fullName);
      if (!qid) continue;
      const files = qidFiles.get(qid);
      if (!files) continue;
      const logo = files.logo ? lic.get("File:" + files.logo) : undefined;
      const image = files.image ? lic.get("File:" + files.image) : undefined;
      if (logo?.free) out[t.id] = { url: logo.thumb, type: "logo" };
      else if (image?.free) out[t.id] = { url: image.thumb, type: "car" };
    }
    return out;
  });
}
