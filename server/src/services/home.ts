import { getDriverStandings, getHomeHighlights, getRaceAfter } from "./f1db";
import { getNews } from "./news";
import { driverPortraitUrl } from "./portraits";
import { sessionHeroWithin } from "./sessionHero";
import type { HomeResponse } from "../types/f1";

// Everything the home page shows above the fold, in one payload: the latest
// race, championship top 5, next race, headlines and the hero photo URL.
// Served by /api/home and, for "/", inlined into the HTML so the page renders
// without waiting for API round trips.
//
// newsWaitMs: how long to wait for the news feed. The API waits for it; the
// HTML only takes it if it's already cached (a feed miss must not delay the
// first byte) — `news: null` then tells the client to fetch it.
// The race-number hero shows the portrait about 195 px wide on phones and
// ~320 px on desktop (see .hero-num in client/src/pages/Home.css).
const HERO_WIDTHS = [360, 450, 600, 800];
const HERO_SIZES = "(max-width: 768px) 200px, 320px";

// How long the page waits for the weekend's latest session (OpenF1).
const SESSION_WAIT_MS = 2500;

export async function homePayload(newsWaitMs?: number): Promise<HomeResponse> {
  const newsP = getNews().catch(() => []);
  const news =
    newsWaitMs == null
      ? newsP
      : Promise.race([newsP, new Promise<null>((r) => setTimeout(() => r(null), newsWaitMs))]);
  const [highlights, latest] = await Promise.all([getHomeHighlights(), sessionHeroWithin(SESSION_WAIT_MS)]);
  // A race f1db already has is shown from f1db (with its incidents).
  const race = highlights.latestRace;
  const session =
    latest?.kind === "race" && !latest.sprint && race?.season === latest.season && race.round === latest.round
      ? null
      : latest;
  // Until f1db has a finished race, its "next race" is still that one.
  if (
    session?.kind === "race" &&
    !session.sprint &&
    highlights.nextRace?.season === session.season &&
    highlights.nextRace.round === session.round
  ) {
    highlights.nextRace = await getRaceAfter(session.season, session.round);
  }
  const [standings, items] = await Promise.all([
    getDriverStandings(String(highlights.season)).then((s) => s.standings.slice(0, 5)),
    news,
  ]);
  // The hero's main photo: the session's P1, or the last race's winner.
  const lead = session
    ? session.top[0].driverId && session.top[0].constructorId
      ? { driverId: session.top[0].driverId, constructorId: session.top[0].constructorId, season: session.season }
      : null
    : (() => {
        const w = race?.podium.find((p) => p.position === 1);
        return w ? { driverId: w.driverId, constructorId: w.constructorId, season: race!.season } : null;
      })();
  const portrait = (w: number) => (lead ? driverPortraitUrl(lead.driverId, lead.constructorId, lead.season, w) : null);
  const hasPortrait = !!portrait(600);
  return {
    highlights,
    standings,
    news: items,
    session,
    heroImage: portrait(600),
    heroSrcSet: hasPortrait ? HERO_WIDTHS.map((w) => `${portrait(w)} ${w}w`).join(", ") : null,
    heroSizes: HERO_SIZES,
  };
}
