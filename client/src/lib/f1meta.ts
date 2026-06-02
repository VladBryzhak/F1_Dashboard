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
