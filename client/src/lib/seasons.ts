export const CURRENT_SEASON = 2026

// Seasons offered in the dropdowns: current back to 2016.
export const SEASONS = Array.from({ length: CURRENT_SEASON - 2015 }, (_, i) =>
  String(CURRENT_SEASON - i),
)
