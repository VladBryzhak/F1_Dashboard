// Small formatting / mapping helpers for the live-timing board.

// 98.22 -> "1:38.220"; 25.516 -> "25.516"; null -> "—".
export function fmtTime(s: number | null | undefined): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const rem = (s % 60).toFixed(3)
  if (m === 0) return rem
  return `${m}:${rem.padStart(6, '0')}`
}

// OpenF1 mini-sector (segment) status codes -> a CSS modifier.
export function segmentClass(code: number): string {
  switch (code) {
    case 2051:
      return 'purple' // session fastest
    case 2049:
      return 'green' // personal best
    case 2048:
      return 'yellow' // slower
    case 2064:
      return 'pit'
    default:
      return 'none'
  }
}

// Tyre compound -> a short label + colour for the badge.
export function tyre(compound: string | null): { label: string; cls: string } {
  switch ((compound ?? '').toUpperCase()) {
    case 'SOFT':
      return { label: 'S', cls: 'soft' }
    case 'MEDIUM':
      return { label: 'M', cls: 'medium' }
    case 'HARD':
      return { label: 'H', cls: 'hard' }
    case 'INTERMEDIATE':
      return { label: 'I', cls: 'inter' }
    case 'WET':
      return { label: 'W', cls: 'wet' }
    default:
      return { label: '–', cls: 'unknown' }
  }
}

export function teamColor(hex: string | null): string {
  return hex ? `#${hex}` : '#888'
}
