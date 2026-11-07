import { useI18n } from '../i18n/core'
import { TELEGRAM_URL } from '../lib/telegram'
import './TelegramLink.css'

// "Results right after the flag, on Telegram": a link to the site's channel,
// shown once the channel is set (lib/telegram.ts).
export default function TelegramLink({ short = false, className }: { short?: boolean; className?: string }) {
  const { t } = useI18n()
  if (!TELEGRAM_URL) return null
  return (
    <p className={className}>
      <a className={`tg-link${short ? ' is-short' : ''}`} href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 4 3 11.2l6.6 2.3L18 7.5l-6.3 7 .4 5.5 3-3.6 3.9 3L21 4z" fill="currentColor" />
      </svg>
      {t(short ? 'tg.short' : 'tg.follow')}
      </a>
    </p>
  )
}
