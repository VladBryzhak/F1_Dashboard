import type { CSSProperties } from 'react'
import { useI18n, type TKey } from '../i18n/core'
import { teamColor } from '../lib/f1meta'
import { eventText, storyParagraphs } from '../lib/raceStory'
import type { RaceStory as Story, StoryEvent, StoryEventKind } from '../types/f1'
import './RaceStory.css'

// "How the race unfolded": a few paragraphs written from the race facts, a
// lap-by-lap strip of key moments (neutralisations as bands, everything else
// as markers) and the same moments as a readable list.

const MARK: Record<StoryEventKind, string> = {
  lead: '◆',
  pit: '▲',
  penalty: '!',
  dnf: '✕',
  fastest: 'FL',
  sc: 'SC',
  vsc: 'VSC',
  red: '■',
}

function markColor(e: StoryEvent): string | undefined {
  if (e.kind === 'lead' || e.kind === 'pit') return teamColor(e.driver?.constructorId ?? '')
  return undefined
}

function Timeline({ story }: { story: Story }) {
  const { t, lang } = useI18n()
  const total = story.totalLaps ?? 0
  if (!total) return null
  const at = (lap: number) => `${((lap - 0.5) / total) * 100}%`
  const markers = story.events.filter((e) => !['sc', 'vsc', 'red'].includes(e.kind))
  // Several moments on one lap stack upwards.
  const stack = new Map<number, number>()
  const ticks = [
    1,
    ...Array.from({ length: Math.floor(total / 10) }, (_, i) => (i + 1) * 10),
    total,
  ].filter((v, i, a) => a.indexOf(v) === i && !(v !== total && total - v < 4))

  return (
    <div className="story-tl" aria-hidden="true">
      <div className="story-marks">
        {markers.map((e, i) => {
          const level = stack.get(e.lap) ?? 0
          stack.set(e.lap, level + 1)
          return (
            <span
              key={i}
              className={`story-mark story-mark--${e.kind}`}
              style={{ left: at(e.lap), '--lvl': level, '--c': markColor(e) } as CSSProperties}
              title={`${t('story.lap')} ${e.lap}: ${eventText(e, lang)}`}
            >
              {MARK[e.kind]}
            </span>
          )
        })}
      </div>
      <div className="story-bar">
        {story.neutralisations.map((n, i) => (
          <span
            key={i}
            className={`story-band story-band--${n.kind}`}
            style={{
              left: `${((n.from - 1) / total) * 100}%`,
              width: `${((n.to - n.from + 1) / total) * 100}%`,
            }}
            title={eventText({ lap: n.from, to: n.to, kind: n.kind }, lang)}
          />
        ))}
      </div>
      <div className="story-ticks">
        {ticks.map((v) => (
          <span key={v} style={{ left: at(v) }}>
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RaceStory({ story }: { story: Story }) {
  const { t, lang } = useI18n()
  const paragraphs = storyParagraphs(story, lang)
  if (!paragraphs.length) return null
  const kinds = [...new Set(story.events.map((e) => e.kind))]

  return (
    <div className="card story">
      <h2 className="wknd-section">{t('story.title')}</h2>
      <div className="story-text">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {story.hasTiming && story.events.length > 0 && (
        <>
          <h3 className="story-sub">{t('story.moments')}</h3>
          <Timeline story={story} />
          <div className="story-legend">
            {kinds.map((k) => (
              <span key={k}>
                <i className={`story-key story-mark--${k}`}>{MARK[k]}</i>
                {t(`story.k.${k}` as TKey)}
              </span>
            ))}
          </div>
          <ol className="story-list">
            {story.events.map((e, i) => (
              <li key={i}>
                <span className="story-lap">
                  {t('story.lap')} {e.to && e.to !== e.lap ? `${e.lap}–${e.to}` : e.lap}
                </span>
                <i
                  className={`story-key story-mark--${e.kind}`}
                  style={{ '--c': markColor(e) } as CSSProperties}
                  aria-hidden="true"
                >
                  {MARK[e.kind]}
                </i>
                <span>{eventText(e, lang, false)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="story-src">{t(story.hasTiming ? 'story.source' : 'story.sourceBasic')}</p>
    </div>
  )
}
