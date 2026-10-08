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

// "2d 14:32:10" / "14:32:10" — time from `now` (ms) until `targetIso`.
export function fmtCountdown(targetIso: string, now: number): string {
  let s = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`
}

// Colour a sector time: purple = fastest in the session, green = this driver's
// personal best, yellow = slower.
export function sectorClass(
  time: number | null,
  personalBest: number | null,
  sessionBest: number | null,
): string {
  if (time == null) return ''
  const eps = 1e-6
  if (sessionBest != null && time <= sessionBest + eps) return 'purple'
  if (personalBest != null && time <= personalBest + eps) return 'green'
  return 'yellow'
}
