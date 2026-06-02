// Visual metadata helpers: turn the data the API gives us (nationality demonyms,
// constructor ids) into the circular flag badges and team-colour accents used in
// the F1.com-style design.

const NATIONALITY_FLAG: Record<string, string> = {
  British: '🇬🇧',
  English: '🇬🇧',
  Dutch: '🇳🇱',
  Spanish: '🇪🇸',
  Monegasque: '🇲🇨',
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

const TEAM_COLOR: Record<string, string> = {
  red_bull: '#3671C6',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  mclaren: '#FF8000',
  aston_martin: '#229971',
  alpine: '#0093CC',
  williams: '#64C4FF',
  rb: '#6692FF',
  alphatauri: '#6692FF',
  sauber: '#52E252',
  kick_sauber: '#52E252',
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
