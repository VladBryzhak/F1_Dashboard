import { getDriverStandings, getHomeHighlights } from "./f1db";
import { getNews } from "./news";
import { driverPortraitUrl } from "./portraits";
import type { HomeResponse } from "../types/f1";

// Everything the home page shows above the fold, in one payload: the latest
// race, championship top 5, next race, headlines and the hero photo URL.
// Served by /api/home and, for "/", inlined into the HTML so the page renders
// without waiting for API round trips.
//
// newsWaitMs: how long to wait for the news feed. The API waits for it; the
// HTML only takes it if it's already cached (a feed miss must not delay the
// first byte) — `news: null` then tells the client to fetch it.
export async function homePayload(newsWaitMs?: number): Promise<HomeResponse> {
  const newsP = getNews().catch(() => []);
  const news =
    newsWaitMs == null
      ? newsP
      : Promise.race([newsP, new Promise<null>((r) => setTimeout(() => r(null), newsWaitMs))]);
  const highlights = await getHomeHighlights();
  const [standings, items] = await Promise.all([
    getDriverStandings(String(highlights.season)).then((s) => s.standings.slice(0, 5)),
    news,
  ]);
  const winner = highlights.latestRace?.podium.find((p) => p.position === 1);
  return {
    highlights,
    standings,
    news: items,
    heroImage: winner
      ? driverPortraitUrl(winner.driverId, winner.constructorId, highlights.latestRace!.season, 600)
      : null,
  };
}
