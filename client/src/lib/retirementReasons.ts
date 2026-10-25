import type { Lang } from '../i18n/core'

// f1db retirement reasons → Ukrainian (anything else falls back to English).
const REASON_UK: Record<string, string> = {
  accident: 'аварія',
  battery: 'батарея',
  brakes: 'гальма',
  clutch: 'зчеплення',
  collision: 'зіткнення',
  'collision damage': 'пошкодження після зіткнення',
  'cooling system': 'система охолодження',
  damage: 'пошкодження',
  driveshaft: 'привідний вал',
  electrical: 'електрика',
  electronics: 'електроніка',
  engine: 'двигун',
  'energy store': 'накопичувач енергії',
  exhaust: 'вихлопна система',
  'fuel pressure': 'тиск палива',
  'fuel system': 'паливна система',
  gearbox: 'коробка передач',
  hydraulics: 'гідравліка',
  mechanical: 'механіка',
  'oil leak': 'витік оливи',
  'oil pressure': 'тиск оливи',
  overheating: 'перегрів',
  'power loss': 'втрата потужності',
  'power unit': 'силова установка',
  puncture: 'прокол',
  retired: 'сход',
  'spun off': 'розворот',
  suspension: 'підвіска',
  transmission: 'трансмісія',
  turbo: 'турбіна',
  tyre: 'шина',
  'water leak': 'витік охолоджувальної рідини',
  'water pressure': 'тиск охолоджувальної рідини',
  wheel: 'колесо',
  withdrew: 'зняття з гонки',
}

// The reason as written in the interface language (f1db publishes English).
export function retirementReason(reason: string, lang: Lang): string {
  const key = reason.trim().toLowerCase()
  if (lang === 'uk') return REASON_UK[key] ?? key
  return key
}
