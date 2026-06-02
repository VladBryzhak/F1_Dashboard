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

// f1db constructorId -> the slug formula1.com uses in its car image URLs.
const TEAM_CAR_SLUG: Record<string, string> = {
  mclaren: 'mclaren',
  ferrari: 'ferrari',
  mercedes: 'mercedes',
  'red-bull': 'redbullracing',
  williams: 'williams',
  'aston-martin': 'astonmartin',
  alpine: 'alpine',
  haas: 'haas',
  'racing-bulls': 'racingbulls',
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
