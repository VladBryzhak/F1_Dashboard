import { createContext, useContext } from 'react'
import en, { type Dict } from './en'
import uk from './uk'

// Interface language, taken from the URL: English pages live at /…, their
// Ukrainian twins at /uk/… (the router's basename, see main.tsx), so each
// language has its own addresses for search engines and shared links. The
// visitor's choice is still remembered in the browser: an unprefixed address
// opens in Ukrainian for someone who picked it (or whose browser asks for it),
// see preferredLang() and main.tsx.

export type Lang = 'en' | 'uk'
export type TKey = keyof Dict
type Vars = Record<string, string | number>

export const LANG_STORAGE_KEY = 'lang'
export const dicts: Record<Lang, Dict> = { en, uk }
// BCP-47 locale used for dates and numbers.
export const locales: Record<Lang, string> = { en: 'en-GB', uk: 'uk-UA' }

// The Ukrainian pages' path prefix (also the router basename for them).
export const UK_BASE = '/uk'
const UK_PREFIX = /^\/uk(?=\/|$)/

// Which language a path belongs to: /uk and /uk/… are Ukrainian.
export function langFromPath(path: string): Lang {
  return UK_PREFIX.test(path) ? 'uk' : 'en'
}

// The same page in the given language: /standings ↔ /uk/standings, / ↔ /uk.
export function localizedPath(path: string, lang: Lang): string {
  const bare = path.replace(UK_PREFIX, '') || '/'
  if (lang === 'en') return bare
  return bare === '/' ? UK_BASE : UK_BASE + bare
}

// The language this visitor asked for: their saved choice from the EN/UA
// switch, else their browser's language when we have it (Ukrainian), else
// none. Used only to open an unprefixed address in Ukrainian.
export function preferredLang(): Lang | null {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'uk') return saved
  } catch {
    // storage blocked — fall through to the browser language
  }
  if (typeof navigator === 'undefined') return null
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return prefs.some((l) => l?.toLowerCase().startsWith('uk')) ? 'uk' : null
}

// Module-level mirror of the current language, for plain helpers (lib/*) that
// build text outside React components. The provider keeps it in sync.
let current: Lang = typeof window === 'undefined' ? 'en' : langFromPath(window.location.pathname)
export const getLang = (): Lang => current
export const getLocale = (): string => locales[current]
export const setCurrentLang = (l: Lang) => {
  current = l
}

export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

// Translate outside React (uses the current language).
export function translate(key: TKey, vars?: Vars, lang: Lang = current): string {
  return interpolate(dicts[lang][key] ?? en[key], vars)
}

// Plural keys are written as `base_one`, `base_few`, `base_many`, `base_other`
// (Ukrainian uses all four, English one/other). `{n}` is filled in.
export function plural(base: string, n: number, vars?: Vars, lang: Lang = current): string {
  const cat = new Intl.PluralRules(locales[lang]).select(n)
  const d = dicts[lang] as Record<string, string>
  const fallback = en as Record<string, string>
  const s = d[`${base}_${cat}`] ?? d[`${base}_other`] ?? fallback[`${base}_other`] ?? base
  return interpolate(s, { n, ...vars })
}

export interface I18n {
  lang: Lang
  locale: string
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Vars) => string
  tn: (base: string, n: number, vars?: Vars) => string
  fmtDate: (d: Date | string, opts: Intl.DateTimeFormatOptions) => string
  fmtTime: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string
  fmtNum: (n: number, opts?: Intl.NumberFormatOptions) => string
}

export function makeI18n(lang: Lang, setLang: (l: Lang) => void): I18n {
  const locale = locales[lang]
  const toDate = (d: Date | string) => (typeof d === 'string' ? new Date(d) : d)
  return {
    lang,
    locale,
    setLang,
    t: (key, vars) => translate(key, vars, lang),
    tn: (base, n, vars) => plural(base, n, vars, lang),
    fmtDate: (d, opts) => {
      const date = toDate(d)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale, opts)
    },
    fmtTime: (d, opts = { hour: '2-digit', minute: '2-digit' }) => {
      const date = toDate(d)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(locale, opts)
    },
    fmtNum: (n, opts) => n.toLocaleString(locale, opts),
  }
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
