import { getCurrentSeason, hasPageSubject, hasRace, isDatasetReady } from "./f1db";

// What a page address leads to, for the SPA fallback in index.ts: a page the
// app has (200), an address the app itself sends elsewhere (301, as with a
// season out of range) or nothing (404). Before, every address answered 200
// with the app's shell, so a mistyped link showed an empty screen to people
// and a "page" to search engines (a soft 404). Mirrors the routes in
// client/src/App.tsx: keep the two in step.

export type PageStatus = { code: 200 } | { code: 404 } | { code: 301; location: string };

const OK: PageStatus = { code: 200 };
const NOT_FOUND: PageStatus = { code: 404 };
const moved = (location: string): PageStatus => ({ code: 301, location });

// Pages without parameters (besides the home page and the sections below).
const PLAIN = new Set(["compare", "telemetry", "live", "feedback", "about", "privacy", "support"]);

const isYear = (s: string) => /^\d{4}$/.test(s);

// `pagePath` is the address without the /uk prefix. Whether a driver, team,
// circuit or race exists needs the dataset: `checkData` false (a person's
// request on a cold start, who shouldn't wait for it) settles only what the
// address's shape decides and lets the app answer the rest. A redirect's
// location comes back without the language prefix.
export async function pageStatus(pagePath: string, checkData: boolean): Promise<PageStatus> {
  let parts: string[];
  try {
    parts = pagePath.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return NOT_FOUND; // malformed %-escape
  }
  // The app's router ignores case in the fixed part of an address.
  const [section = "", a, b, ...rest] = parts;
  const where = section.toLowerCase();
  if (rest.length) return NOT_FOUND;
  if (!where) return OK;
  if (PLAIN.has(where)) return a ? NOT_FOUND : OK;

  const data = checkData || isDatasetReady();
  const exists = (test: () => Promise<boolean>) =>
    data ? test().then((yes) => (yes ? OK : NOT_FOUND)) : Promise.resolve(OK);
  // A season page: 1950 to the dataset's latest season.
  const seasonOk = async (y: string) => !data || (Number(y) >= 1950 && Number(y) <= (await getCurrentSeason()));

  switch (where) {
    case "circuits":
      if (b) return NOT_FOUND;
      return a ? exists(() => hasPageSubject("circuit", a)) : OK;

    case "calendar":
    case "standings":
      // /calendar/<season>/<round>: one race weekend.
      if (b) {
        if (where !== "calendar" || !isYear(a!) || !/^\d{1,3}$/.test(b)) return NOT_FOUND;
        return exists(() => hasRace(a!, b));
      }
      // The app sends a season it doesn't have to the section's own page.
      if (a && !(isYear(a) && (await seasonOk(a)))) return moved(`/${where}`);
      return OK;

    case "drivers":
    case "teams":
      if (b) return NOT_FOUND;
      if (!a) return OK;
      // /drivers/<season> is that season's grid; anything else is a profile
      // (ids are never bare years).
      if (isYear(a) && (await seasonOk(a))) return OK;
      return exists(() => hasPageSubject(where === "drivers" ? "driver" : "team", a));

    default:
      return NOT_FOUND;
  }
}
