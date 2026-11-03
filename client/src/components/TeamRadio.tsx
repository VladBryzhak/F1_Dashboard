import type { CSSProperties } from 'react'
import { useI18n } from '../i18n/core'
import type { RadioAudio, RadioClip } from '../lib/teamRadio'
import './TeamRadio.css'

// Team radio in the race replay: the clips the broadcast aired,
// with captions made on the owner's Mac (tools/team-radio). A clip shows as a
// small toast over the track map while the replay passes it, the driver's row
// gets a speaker cue, and every clip is listed under the board as a dialogue.
// Clips and lines nobody could make out are left out. The audio plays from
// F1's own server.

function PlayButton({ clip, audio }: { clip: RadioClip; audio: RadioAudio }) {
  const { t } = useI18n()
  const on = audio.playing === clip.id
  return (
    <button
      type="button"
      className={`rad-play${on ? ' is-on' : ''}`}
      onClick={() => audio.toggle(clip)}
      aria-label={t(on ? 'radio.stop' : 'radio.listen', { name: clip.surname })}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        {on ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M4.5 2.5v11L13 8z" fill="currentColor" />}
      </svg>
    </button>
  )
}

export function SpeakerCue() {
  const { t } = useI18n()
  return (
    <span className="rad-cue" title={t('radio.onAir')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="rad-sr">{t('radio.onAir')}</span>
    </span>
  )
}

// The toast over the track map: who, and their first line.
export function RadioToast({ clip, audio }: { clip: RadioClip; audio: RadioAudio }) {
  const { lang } = useI18n()
  return (
    <div className="rad-toast" style={{ '--team': clip.colour } as CSSProperties} role="status">
      <span className="rad-stripe" aria-hidden="true" />
      <span className="rad-toast-body">
        <span className="rad-toast-name">{clip.surname}</span>
        <span className="rad-toast-text">{clip.lines[0][lang]}</span>
      </span>
      <PlayButton clip={clip} audio={audio} />
    </div>
  )
}

// Every clip under the board, as a dialogue: the engineer on the left, the
// driver on the right in their team's colour. The lap jumps the replay there.
export function RadioThreads({
  clips,
  audio,
  onSeek,
}: {
  clips: RadioClip[]
  audio: RadioAudio
  onSeek: (clip: RadioClip) => void
}) {
  const { t, lang } = useI18n()
  if (!clips.length) return null
  return (
    <section className="rad">
      <h2 className="rad-title">{t('radio.title')}</h2>
      <div className="rad-grid">
        {clips.map((c) => (
          <article key={c.id} className="rad-thread" style={{ '--team': c.colour } as CSSProperties}>
            <header className="rad-head">
              <span className="rad-stripe" aria-hidden="true" />
              <span className="rad-name">{c.surname}</span>
              <button type="button" className="rad-lap" onClick={() => onSeek(c)} title={t('radio.seek')}>
                {c.lap != null ? t('tel.lapN', { n: c.lap }) : t('radio.beforeStart')}
              </button>
              <PlayButton clip={c} audio={audio} />
            </header>
            {c.lines.map((l, i) => (
              <p key={i} className={`rad-bubble${l.who === 'driver' ? ' is-drv' : ''}`}>
                {l.who && <span className="rad-sr">{t(l.who === 'driver' ? 'radio.driver' : 'radio.engineer')}: </span>}
                {l[lang]}
              </p>
            ))}
          </article>
        ))}
      </div>
      <p className="rad-note">{t('radio.note')}</p>
    </section>
  )
}
