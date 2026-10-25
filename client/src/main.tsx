import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Global styles first; components and pages import their own CSS after.
import './styles/tokens.css'
import './styles/base.css'
import './styles/shared.css'
import App from './App.tsx'
import I18nProvider from './i18n/I18nProvider'
import { initAnalytics } from './lib/analytics'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
