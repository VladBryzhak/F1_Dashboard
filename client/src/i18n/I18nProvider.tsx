import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getLang, I18nContext, LANG_STORAGE_KEY, makeI18n, setCurrentLang, type Lang } from './core'

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang)

  const setLang = useCallback((l: Lang) => {
    setCurrentLang(l)
    setLangState(l)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l)
    } catch {
      // ignore — the choice still applies for this visit
    }
  }, [])

  useEffect(() => {
    setCurrentLang(lang)
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => makeI18n(lang, setLang), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
