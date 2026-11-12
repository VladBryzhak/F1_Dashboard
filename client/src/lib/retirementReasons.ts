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
  'accident damage': 'пошкодження після аварії',
  'accident in qualifying': 'аварія в кваліфікації',
  'accident on formation lap': 'аварія на прогрівальному колі',
  airbox: 'повітрозабірник',
  alternator: 'генератор',
  'broken floor': 'зламане днище',
  'broken seat': 'зламане сидіння',
  'broken wing': 'зламане антикрило',
  'car damaged in qualifying': 'болід пошкоджено в кваліфікації',
  'car underweight': 'недостатня вага боліда',
  chassis: 'шасі',
  'coolant leak': 'витік охолоджувальної рідини',
  crankshaft: 'колінчастий вал',
  differential: 'диференціал',
  'driveshaft hub': 'маточина привідного вала',
  drivetrain: 'трансмісія',
  'energy storage system failure': 'відмова накопичувача енергії',
  'fatal accident': 'фатальна аварія',
  fire: 'пожежа',
  'fire extinguisher': 'вогнегасник',
  'front wing': 'переднє антикрило',
  'fuel cell': 'паливний бак',
  'fuel leak': 'витік палива',
  'fuel pump': 'паливний насос',
  'fuel rig': 'заправне обладнання',
  halfshaft: 'піввісь',
  handling: 'керованість',
  'hybrid system': 'гібридна система',
  ignition: 'запалювання',
  'ignored blue flags': 'ігнорування синіх прапорів',
  'ignored red light': 'проїзд на червоне світло',
  'illegal brake ducts': 'недозволені гальмівні повітроводи',
  'illegal car change': 'недозволена заміна боліда',
  'illegal rear wing': 'недозволене заднє антикрило',
  'illegal skid block wear': 'надмірний знос захисної планки',
  illness: 'хвороба',
  injury: 'травма',
  'kers failure': 'відмова KERS',
  'launch control': 'система старту',
  'loose wheel': 'незакріплене колесо',
  mechenical: 'механіка',
  'oil line': 'оливна магістраль',
  'out of fuel': 'закінчилось паливо',
  'pit stop issue': 'проблема на піт-стопі',
  pneumatics: 'пневматика',
  'power steering': 'підсилювач керма',
  'puncture damage': 'пошкодження після проколу',
  radiator: 'радіатор',
  'rear wing': 'заднє антикрило',
  'received outside assistance': 'стороння допомога',
  retirement: 'сход',
  'safety concerns': 'міркування безпеки',
  'safety switch': 'аварійний вимикач',
  'spark plugs': 'свічки запалювання',
  spin: 'розворот',
  steering: 'кермове керування',
  'technical defect': 'технічна несправність',
  throttle: 'дросель',
  'track rod': 'кермова тяга',
  'traction control': 'трекшн-контроль',
  turbocharger: 'турбокомпресор',
  'tyre shortage': 'брак шин',
  undertray: 'днище',
  unwell: 'погане самопочуття',
  vibrations: 'вібрації',
  'wheel bearing': 'колісний підшипник',
  'wheel hub': 'маточина колеса',
  'wheel nut': 'гайка колеса',
  'wheel rim': 'колісний диск',
}

// The reason as written in the interface language (f1db publishes English).
export function retirementReason(reason: string, lang: Lang): string {
  const key = reason.trim().toLowerCase()
  if (lang === 'uk') return REASON_UK[key] ?? key
  return key
}

const ukLaps = (n: number) => {
  const d = n % 10
  const dd = n % 100
  return d === 1 && dd !== 11 ? 'коло' : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'кола' : 'кіл'
}

// A result's time column in the interface language: a time or gap as it is,
// laps behind ("+1 lap" → "+1 коло") and a retirement reason translated.
export function resultTime(display: string, lang: Lang): string {
  if (lang !== 'uk') return display
  const laps = /^\+(\d+) laps?$/.exec(display)
  if (laps) return `+${laps[1]} ${ukLaps(Number(laps[1]))}`
  if (/^[+\d—-]/.test(display)) return display
  const r = retirementReason(display, lang)
  return r.charAt(0).toUpperCase() + r.slice(1)
}
