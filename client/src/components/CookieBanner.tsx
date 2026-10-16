import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/core'

// Cookie-consent notice. Flip ENABLED to false to hide it everywhere (the code
// stays in place); flip it back to true to render it again when we actually
// need consent — e.g. for EU/GDPR compliance once we gate analytics on it.
//
// For now this only records the visitor's choice; wiring Google Analytics to
// respect a "declined" choice is the separate "make it real" step.
const ENABLED = true

const STORAGE_KEY = 'cookieConsent' // 'accepted' | 'declined'

export default function CookieBanner() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ENABLED) return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // storage blocked (private mode / disabled) — show it anyway
      setVisible(true)
    }
  }, [])

  if (!ENABLED || !visible) return null

  function choose(choice: 'accepted' | 'declined') {
    try {
      localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // ignore storage failure; we still dismiss for this session
    }
    setVisible(false)
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('cookie.label')}>
      <p className="cookie-text">
        {t('cookie.text')}
      </p>
      <div className="cookie-actions">
        <button
          type="button"
          className="cookie-btn cookie-decline"
          onClick={() => choose('declined')}
        >
          {t('cookie.decline')}
        </button>
        <button
          type="button"
          className="cookie-btn cookie-accept"
          onClick={() => choose('accepted')}
        >
          {t('cookie.accept')}
        </button>
      </div>
    </div>
  )
}
