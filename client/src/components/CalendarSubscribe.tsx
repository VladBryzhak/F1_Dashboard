import { useState } from 'react'
import { useI18n } from '../i18n/core'
import './CalendarSubscribe.css'

// "Subscribe" on the calendar page: a webcal feed served by our backend
// (/api/calendar/f1[-races]-<lang>.ics) that calendar apps poll, so the season
// stays up to date without re-importing. Event names follow the UI language.
// The toggle sits in the page head; the panel opens below it.

export function SubscribeToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className={`sub-toggle${open ? ' on' : ''}`}
      aria-expanded={open}
      aria-controls="cal-subscribe"
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 7v5m-2.5-2.5h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {t('cal.subscribe')}
    </button>
  )
}

export default function SubscribePanel() {
  const { t, lang } = useI18n()
  const [racesOnly, setRacesOnly] = useState(false)
  const [copied, setCopied] = useState(false)

  const httpUrl = `${window.location.origin}/api/calendar/f1${racesOnly ? '-races' : ''}-${lang}.ics`
  const webcalUrl = httpUrl.replace(/^https?:/, 'webcal:')
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the link is still visible to copy by hand.
    }
  }

  return (
    <div id="cal-subscribe" className="card sub-panel">
      <h2 className="sub-title">{t('cal.subTitle')}</h2>
      <p className="sub-text">{t('cal.subText')}</p>

      <div className="seg-switch" role="group">
        <button
          type="button"
          className={racesOnly ? undefined : 'on'}
          aria-pressed={!racesOnly}
          onClick={() => setRacesOnly(false)}
        >
          {t('cal.subAll')}
        </button>
        <button
          type="button"
          className={racesOnly ? 'on' : undefined}
          aria-pressed={racesOnly}
          onClick={() => setRacesOnly(true)}
        >
          {t('cal.subRaces')}
        </button>
      </div>

      <div className="sub-actions">
        <a className="sub-btn" href={googleUrl} target="_blank" rel="noopener noreferrer">
          {t('cal.subGoogle')}
        </a>
        <a className="sub-btn" href={webcalUrl}>
          {t('cal.subApple')}
        </a>
        <button type="button" className="sub-btn sub-btn--ghost" onClick={copy}>
          {copied ? t('cal.subCopied') : t('cal.subCopy')}
        </button>
      </div>
      <code className="sub-url">{httpUrl}</code>
      <p className="sub-note">{t('cal.subNote')}</p>
    </div>
  )
}
