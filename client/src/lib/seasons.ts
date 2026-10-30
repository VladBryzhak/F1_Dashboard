declare global {
  interface Window {
    __SEASON__?: number
  }
}

// The current season: the newest one in the dataset, which the server writes
// into every page (window.__SEASON__, server/src/services/pageHtml.ts), so the
// app and the server agree on which season /standings is and it moves on by
// itself when f1db publishes a new season. A page served before the dataset
// has loaded (a cold start) has none: the calendar year then.
const fromServer = typeof window !== 'undefined' ? window.__SEASON__ : undefined
export const CURRENT_SEASON: number =
  typeof fromServer === 'number' && Number.isInteger(fromServer) && fromServer >= 1950
    ? fromServer
    : new Date().getFullYear()

// Seasons offered in the dropdowns: current back to 2016.
export const SEASONS = Array.from({ length: CURRENT_SEASON - 2015 }, (_, i) =>
  String(CURRENT_SEASON - i),
)
