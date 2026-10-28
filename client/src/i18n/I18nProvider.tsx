import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  I18nContext,
  LANG_STORAGE_KEY,
  langFromPath,
  localizedPath,
  makeI18n,
  setCurrentLang,
  type Lang,
} from './core'

// The language comes from the address (/uk/… is Ukrainian). Switching moves
// to the same page's address in the other language; the router remounts
// with the matching basename (main.tsx).
export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = langFromPath(window.location.pathname)
    setCurrentLang(l) // before the first render, for helpers that read it
    return l
  })

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l)
    } catch {
      // ignore — the choice still applies for this visit
    }
    const { pathname, search, hash } = window.location
    const next = localizedPath(pathname, l)
    // Replace, not push: changing language isn't a step back/forward should undo.
    if (next !== pathname) window.history.replaceState(window.history.state, '', next + search + hash)
    setCurrentLang(l)
    setLangState(l)
  }, [])

  // Back/forward can land on the other language's address.
  useEffect(() => {
    const onPop = () => {
      const l = langFromPath(window.location.pathname)
      setCurrentLang(l)
      setLangState(l)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    setCurrentLang(lang)
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => makeI18n(lang, setLang), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
