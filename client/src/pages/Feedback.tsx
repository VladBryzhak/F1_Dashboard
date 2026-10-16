import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import './Feedback.css'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function Feedback() {
  useSeo({
    title: 'Feedback',
    description:
      'Send feedback, report a bug or suggest a feature for F1 Dashboard.',
  })

  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('') // honeypot — real users leave empty
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const { t } = useI18n()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (message.trim().length < 3) {
      setError(t('fb.tooShort'))
      setStatus('error')
      return
    }
    setStatus('sending')
    setError('')
    try {
      await api.feedback({
        message: message.trim(),
        contact: contact.trim() || undefined,
        website,
      })
      setStatus('sent')
      setMessage('')
      setContact('')
    } catch (err) {
      // Server messages are English; show ours unless it's the rate limit.
      const msg = err instanceof Error ? err.message : ''
      setError(/too many/i.test(msg) ? t('fb.rateLimited') : t('fb.failed'))
      setStatus('error')
    }
  }

  return (
    <section className="feedback">
      <h1>{t('nav.feedback')}</h1>
      <p className="muted feedback-intro">{t('fb.intro')}</p>

      {status === 'sent' ? (
        <p className="banner banner-ok">
          {t('fb.sent')} 🏁
        </p>
      ) : (
        <form className="feedback-form" onSubmit={onSubmit}>
          <label className="field">
            <span>{t('fb.message')}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              required
              placeholder={t('fb.messagePh')}
            />
          </label>

          <label className="field">
            <span>{t('fb.contact')}</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder={t('fb.contactPh')}
            />
          </label>

          {/* Honeypot: hidden from people, tempting to bots. */}
          <input
            className="hp-field"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          {status === 'error' && <p className="banner">{error}</p>}

          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? t('fb.sending') : t('fb.send')}
          </button>
        </form>
      )}
    </section>
  )
}
