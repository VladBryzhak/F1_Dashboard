import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/core'
import './HeroSlider.css'

export interface Slide {
  key: string
  label: string // names the slide for its dot and screen readers
  node: ReactNode
}

// How long a slide stays before the next one comes in.
const INTERVAL_MS = 20_000

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The home hero's slides, stacked in one place (the tallest sets the height,
// so nothing below moves) and cross-faded. They move on by themselves every
// 20 seconds, except while the pointer or focus is on them, while the tab is
// hidden, after the pause button, or for people who ask for reduced motion.
// Dots pick a slide; a swipe moves one on or back.
export default function HeroSlider({ slides, label }: { slides: Slide[]; label: string }) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const count = slides.length
  const running = playing && !hovered && !focused && !hidden

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // A fresh timer for each slide shown, so a slide picked by hand gets its
  // full time too.
  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS)
    return () => clearTimeout(id)
  }, [running, index, count])

  const go = (i: number) => setIndex(((i % count) + count) % count)

  return (
    <div
      className={`hero-slider${running ? ' is-running' : ''}`}
      role="region"
      aria-roledescription={t('slider.carousel')}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      onTouchStart={(e) => {
        const p = e.touches[0]
        touch.current = { x: p.clientX, y: p.clientY }
      }}
      onTouchEnd={(e) => {
        const start = touch.current
        touch.current = null
        if (!start) return
        const p = e.changedTouches[0]
        const dx = p.clientX - start.x
        // A sideways swipe, not a scroll.
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(p.clientY - start.y)) go(index + (dx < 0 ? 1 : -1))
      }}
    >
      <div className="hero-slides">
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`hero-slide${i === index ? ' is-active' : ''}`}
            role="group"
            aria-roledescription={t('slider.slide')}
            aria-label={`${i + 1} / ${count}: ${s.label}`}
            aria-hidden={i !== index}
            // A slide out of view takes no focus or clicks.
            ref={(el) => {
              if (el) el.inert = i !== index
            }}
          >
            {s.node}
          </div>
        ))}
      </div>

      <div className="hero-slider-controls">
        <button
          type="button"
          className="hs-play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={t(playing ? 'slider.pause' : 'slider.play')}
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="1.5" width="2.6" height="9" rx="0.6" fill="currentColor" />
              <rect x="7.4" y="1.5" width="2.6" height="9" rx="0.6" fill="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5Z" fill="currentColor" />
            </svg>
          )}
        </button>
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`hs-dot${i === index ? ' is-active' : ''}`}
            onClick={() => go(i)}
            aria-label={s.label}
            aria-current={i === index}
          >
            {/* The active dot fills up over the slide's time (from the start
                again after a pause, as the timer does). */}
            {i === index && running && <span className="hs-dot-fill" />}
          </button>
        ))}
      </div>
    </div>
  )
}
