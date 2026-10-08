import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useSeo } from '../hooks/useSeo'

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (message.trim().length < 3) {
      setError('Please write a little more.')
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
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStatus('error')
    }
  }

  return (
    <section className="feedback">
      <h1>Feedback</h1>
      <p className="muted feedback-intro">
        Found a bug, have an idea, or just want to say hi? Send a message — it
        goes straight to the person who builds this site.
      </p>

      {status === 'sent' ? (
        <p className="banner banner-ok">
          Thanks! Your message was sent. 🏁
        </p>
      ) : (
        <form className="feedback-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              required
              placeholder="Your feedback…"
            />
          </label>

          <label className="field">
            <span>Contact (optional)</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder="Email or @telegram, if you'd like a reply"
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
            {status === 'sending' ? 'Sending…' : 'Send feedback'}
          </button>
        </form>
      )}
    </section>
  )
}
