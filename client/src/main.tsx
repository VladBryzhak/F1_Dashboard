import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Global styles first; components and pages import their own CSS after.
import './styles/tokens.css'
import './styles/base.css'
import './styles/shared.css'
import App from './App.tsx'
import { langFromPath, localizedPath, preferredLang } from './i18n/core'
import I18nProvider from './i18n/I18nProvider'
import LangRouter from './i18n/LangRouter'
import { initAnalytics } from './lib/analytics'

// An unprefixed (English) address opens in Ukrainian for a visitor who chose
// Ukrainian or whose browser asks for it. Done before the first render, by
// rewriting the address in place (no reload, the inlined home data still
// applies). Crawlers keep no choice and ask for English, so they get the
// address they requested; /uk/… addresses always stay Ukrainian.
if (langFromPath(window.location.pathname) === 'en' && preferredLang() === 'uk') {
  const { pathname, search, hash } = window.location
  window.history.replaceState(window.history.state, '', localizedPath(pathname, 'uk') + search + hash)
}

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <LangRouter>
        <App />
      </LangRouter>
    </I18nProvider>
  </StrictMode>,
)
