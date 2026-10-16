// Localised country name from an ISO alpha-2 code ("us" → "United States" /
// "Сполучені Штати"), via the browser's own Intl data.
const cache = new Map<string, Intl.DisplayNames | null>()

export function countryName(code: string | null | undefined, locale: string): string {
  if (!code) return ''
  let dn = cache.get(locale)
  if (dn === undefined) {
    try {
      dn = new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      dn = null
    }
    cache.set(locale, dn)
  }
  try {
    return dn?.of(code.toUpperCase()) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}
