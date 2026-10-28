import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { UK_BASE, useI18n } from './core'

// One router per language: Ukrainian pages run under the /uk basename, so
// every in-app link (<Link to="/standings">) keeps the current language. A
// language switch remounts it with the other basename.
export default function LangRouter({ children }: { children: ReactNode }) {
  const { lang } = useI18n()
  return (
    <BrowserRouter key={lang} basename={lang === 'uk' ? UK_BASE : undefined}>
      {children}
    </BrowserRouter>
  )
}
