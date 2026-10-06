import { useNavigate } from 'react-router-dom'
import { CURRENT_SEASON } from '../lib/seasons'

// A valid F1 season is a four-digit year from the first championship to now.
export function isSeason(s: string | undefined): s is string {
  if (!s || !/^\d{4}$/.test(s)) return false
  const n = Number(s)
  return n >= 1950 && n <= CURRENT_SEASON
}

// Shared logic for the season-in-URL pages (/standings/:season, /drivers/:season,
// /teams/:season, /calendar/:season). `rawSeason` is the value from the path
// (the caller reads it, since the param name differs per route); the bare path
// (/standings) is the current season. Both the bare path and
// <base>/<currentSeason> declare the bare path as canonical to avoid duplicate
// content, and a malformed season is flagged so the page can redirect.
export function useSeasonRoute(basePath: string, rawSeason: string | undefined) {
  const navigate = useNavigate()

  const badSeason = rawSeason !== undefined && !isSeason(rawSeason)
  const season = isSeason(rawSeason) ? rawSeason : String(CURRENT_SEASON)
  const canonicalPath =
    season === String(CURRENT_SEASON) ? basePath : `${basePath}/${season}`

  const goToSeason = (s: string) =>
    navigate(s === String(CURRENT_SEASON) ? basePath : `${basePath}/${s}`)

  return { season, canonicalPath, goToSeason, badSeason }
}
