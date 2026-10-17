import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/core'
import { setAnalyticsConsent, storedConsent, type ConsentChoice } from '../lib/analytics'
import './CookieBanner.css'

// Cookie-consent notice. Shown until the visitor answers; "Cookie settings" in
// the footer reopens it (OPEN_EVENT) so the choice can be changed any time.
// The answer drives Google Consent Mode (see lib/analytics).
export const OPEN_EVENT = 'open-cookie-settings'

export default function CookieBanner() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<ConsentChoice | null>(null)

  useEffect(() => {
    const choice = storedConsent()
    setCurrent(choice)
    if (!choice) setVisible(true)
    const reopen = () => {
      setCurrent(storedConsent())
      setVisible(true)
    }
    window.addEventListener(OPEN_EVENT, reopen)
    return () => window.removeEventListener(OPEN_EVENT, reopen)
  }, [])

  if (!visible) return null

  function choose(choice: ConsentChoice) {
    setAnalyticsConsent(choice)
    setCurrent(choice)
    setVisible(false)
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('cookie.label')}>
      <p className="cookie-text">
        {t('cookie.text')}{' '}
        <Link to="/privacy">{t('cookie.more')}</Link>
        {current && (
          <span className="cookie-current">
            {' '}
            {t(current === 'accepted' ? 'cookie.nowAccepted' : 'cookie.nowDeclined')}
          </span>
        )}
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
