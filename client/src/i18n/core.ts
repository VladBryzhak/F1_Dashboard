import { createContext, useContext } from 'react'
import en, { type Dict } from './en'
import uk from './uk'

// Interface language. No URL prefix: the choice lives in the browser
// (localStorage), and a first-time visitor gets their browser's language when
// we have it (Ukrainian), English otherwise. Search engines therefore always
// see — and index — the English version.

export type Lang = 'en' | 'uk'
export type TKey = keyof Dict
type Vars = Record<string, string | number>

export const LANG_STORAGE_KEY = 'lang'
export const dicts: Record<Lang, Dict> = { en, uk }
// BCP-47 locale used for dates and numbers.
export const locales: Record<Lang, string> = { en: 'en-GB', uk: 'uk-UA' }

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'uk') return saved
  } catch {
    // storage blocked — fall through to the browser language
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return prefs.some((l) => l?.toLowerCase().startsWith('uk')) ? 'uk' : 'en'
}

// Module-level mirror of the current language, for plain helpers (lib/*) that
// build text outside React components. The provider keeps it in sync.
let current: Lang = detectLang()
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
