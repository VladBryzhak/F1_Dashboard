import { useNavigate } from 'react-router-dom'
import { CURRENT_SEASON } from '../lib/seasons'

// A valid F1 season is a four-digit year from the first championship to now.
export function isSeason(s: string | undefined): s is string {
  if (!s || !/^\d{4}$/.test(s)) return false
  const n = Number(s)
  return n >= 1950 && n <= CURRENT_SEASON
}

// A season page's address: the bare section for the current season
// (/standings), the section plus the year for any other (/standings/1998).
export const seasonPath = (basePath: string, season: string | number) =>
  String(season) === String(CURRENT_SEASON) ? basePath : `${basePath}/${season}`

// Shared logic for the season-in-URL pages (/standings/:season, /drivers/:season,
// /teams/:season, /calendar/:season). `rawSeason` is the value from the path
// (the caller reads it, since the param name differs per route); the bare path
// (/standings) is the current season. A season in the path that is malformed,
// or is the current one (the same page as the bare path), sets `redirect`, so
// the page moves to its own address as the server does (a 301, see
// server/src/services/pageRoutes.ts): one address per page.
export function useSeasonRoute(basePath: string, rawSeason: string | undefined) {
  const navigate = useNavigate()

  const season = isSeason(rawSeason) ? rawSeason : String(CURRENT_SEASON)
  const canonicalPath = seasonPath(basePath, season)
  const redirect = rawSeason !== undefined && (!isSeason(rawSeason) || rawSeason === String(CURRENT_SEASON))

  const goToSeason = (s: string) => navigate(seasonPath(basePath, s))

  return { season, canonicalPath, goToSeason, redirect }
}
