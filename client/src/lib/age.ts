// "18 years 228 days" / "18 р. 228 дн.": whole years from the birthday, then
// the days since the last one (mirrors ageText in snapshot.ts).
export function ageText(born: string, on: string, uk: boolean): string {
  const [by, bm, bd] = born.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  const years = y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(by + years, bm - 1, bd)) / 86_400_000)
  return uk ? `${years} р. ${days} дн.` : `${years} years ${days} days`
}

