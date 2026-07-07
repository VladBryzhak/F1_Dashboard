// Visual metadata helpers: turn the data the API gives us (nationality demonyms,
// constructor ids) into the circular flag badges and team-colour accents used in
// the F1.com-style design.

const NATIONALITY_FLAG: Record<string, string> = {
  British: '🇬🇧',
  English: '🇬🇧',
  Dutch: '🇳🇱',
  Spanish: '🇪🇸',
  Monegasque: '🇲🇨',
  Monégasque: '🇲🇨',
  Mexican: '🇲🇽',
  Australian: '🇦🇺',
  Finnish: '🇫🇮',
  German: '🇩🇪',
  French: '🇫🇷',
  Canadian: '🇨🇦',
  Japanese: '🇯🇵',
  Thai: '🇹🇭',
  Danish: '🇩🇰',
  Chinese: '🇨🇳',
  American: '🇺🇸',
  Italian: '🇮🇹',
  Brazilian: '🇧🇷',
  Austrian: '🇦🇹',
  Argentine: '🇦🇷',
  'New Zealander': '🇳🇿',
  Swiss: '🇨🇭',
  Belgian: '🇧🇪',
  Swedish: '🇸🇪',
  Russian: '🇷🇺',
  Polish: '🇵🇱',
  Indonesian: '🇮🇩',
}

// Keyed by f1db constructorId.
const TEAM_COLOR: Record<string, string> = {
  'red-bull': '#3671C6',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  mclaren: '#FF8000',
  'aston-martin': '#229971',
  alpine: '#0093CC',
  williams: '#64C4FF',
  rb: '#6692FF',
  'racing-bulls': '#6692FF',
  alphatauri: '#2B4562',
  'kick-sauber': '#52E252',
  sauber: '#52E252',
  'alfa-romeo': '#C92D4B',
  audi: '#BB0A30',
  haas: '#B6BABD',
  cadillac: '#C9B037',
}

export function flagFor(nationality: string): string {
  return NATIONALITY_FLAG[nationality] ?? '🏁'
}

export function teamColor(constructorId: string): string {
  return TEAM_COLOR[constructorId] ?? '#9a9aa8'
}

// f1db constructorId -> the slug formula1.com uses in its car/driver image URLs.
const TEAM_CAR_SLUG: Record<string, string> = {
  mclaren: 'mclaren',
  ferrari: 'ferrari',
  mercedes: 'mercedes',
  'red-bull': 'redbullracing',
  williams: 'williams',
  'aston-martin': 'astonmartin',
  alpine: 'alpine',
  haas: 'haas',
  rb: 'rb',
  'racing-bulls': 'racingbulls',
  'kick-sauber': 'kicksauber',
  audi: 'audi',
  cadillac: 'cadillac',
}

/**
 * Official car ("bolid") render from formula1.com's CDN for a given season.
 * Returns null for teams without a known slug; the <img> should also handle
 * onError (older seasons may 404 and fall back to the plain card).
 */
export function teamCarUrl(constructorId: string, season: string): string | null {
  const slug = TEAM_CAR_SLUG[constructorId]
  if (!slug) return null
  return (
    `https://media.formula1.com/image/upload/c_lfill,w_800/q_auto/` +
    `v1740000001/common/f1/${season}/${slug}/${season}${slug}carright.webp`
  )
}

// f1db driverId -> the slug formula1.com uses in its driver portrait image
// URLs (first 3 letters of first name + first 3 of last name + a 2-digit
// disambiguator, e.g. "max-verstappen" -> "maxver01"). Covers the 2023-2026
// grids; formula1.com has no such renders for drivers who last raced before
// the CDN's 2024 coverage started (e.g. Nyck de Vries).
const DRIVER_SLUG: Record<string, string> = {
  'max-verstappen': 'maxver01',
  'sergio-perez': 'serper01',
  'lewis-hamilton': 'lewham01',
  'fernando-alonso': 'feralo01',
  'charles-leclerc': 'chalec01',
  'lando-norris': 'lannor01',
  'carlos-sainz-jr': 'carsai01',
  'george-russell': 'georus01',
  'oscar-piastri': 'oscpia01',
  'lance-stroll': 'lanstr01',
  'pierre-gasly': 'piegas01',
  'esteban-ocon': 'estoco01',
  'alexander-albon': 'alealb01',
  'yuki-tsunoda': 'yuktsu01',
  'valtteri-bottas': 'valbot01',
  'nico-hulkenberg': 'nichul01',
  'daniel-ricciardo': 'danric01',
  'guanyu-zhou': 'guazho01',
  'kevin-magnussen': 'kevmag01',
  'liam-lawson': 'lialaw01',
  'logan-sargeant': 'logsar01',
  'kimi-antonelli': 'andant01',
  'isack-hadjar': 'isahad01',
  'oliver-bearman': 'olibea01',
  'gabriel-bortoleto': 'gabbor01',
  'franco-colapinto': 'fracol01',
  'jack-doohan': 'jacdoo01',
  'arvid-lindblad': 'arvlin01',
}

// formula1.com's driver render CDN only has assets from the 2024 season on.
const DRIVER_PORTRAIT_MIN_SEASON = 2024

/**
 * Official driver portrait from formula1.com's CDN, in that season's team kit
 * (e.g. Hamilton renders in Mercedes overalls for 2024, Ferrari for 2025+).
 * Returns null when there's no known driver/team slug or the season predates
 * the CDN's coverage; callers should fall back to a season-agnostic headshot.
 */
export function driverPortraitUrl(
  driverId: string,
  constructorId: string,
  season: string,
): string | null {
  if (Number(season) < DRIVER_PORTRAIT_MIN_SEASON) return null
  const driverSlug = DRIVER_SLUG[driverId]
  const teamSlug = TEAM_CAR_SLUG[constructorId]
  if (!driverSlug || !teamSlug) return null
  return (
    `https://media.formula1.com/image/upload/c_lfill,w_600/q_auto/` +
    `v1740000001/common/f1/${season}/${teamSlug}/${driverSlug}/${season}${teamSlug}${driverSlug}right.webp`
  )
}
