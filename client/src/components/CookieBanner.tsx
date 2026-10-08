import { useEffect, useState } from 'react'

// Cookie-consent notice. Flip ENABLED to false to hide it everywhere (the code
// stays in place); flip it back to true to render it again when we actually
// need consent — e.g. for EU/GDPR compliance once we gate analytics on it.
//
// For now this only records the visitor's choice; wiring Google Analytics to
// respect a "declined" choice is the separate "make it real" step.
const ENABLED = true

const STORAGE_KEY = 'cookieConsent' // 'accepted' | 'declined'

export default function CookieBanner() {
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
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <p className="cookie-text">
        F1 Dashboard uses cookies for analytics to understand how the site is
        used. You can accept or decline.
      </p>
      <div className="cookie-actions">
        <button
          type="button"
          className="cookie-btn cookie-decline"
          onClick={() => choose('declined')}
        >
          Decline
        </button>
        <button
          type="button"
          className="cookie-btn cookie-accept"
          onClick={() => choose('accepted')}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
