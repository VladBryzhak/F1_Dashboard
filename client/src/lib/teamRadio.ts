import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { teamColor } from './live'
import type { ReplayData, TeamRadioClip, TeamRadioLine } from '../types/f1'

// The replay's team radio (components/TeamRadio.tsx shows it): the session's
// clips with their lap, surname and team colour, which one is on air, and
// one-at-a-time playback.

export interface RadioClip extends TeamRadioClip {
  at: number // when it was aired, ms since the epoch
  // When the replay shows it: within the replay (a clip after the flag, as
  // the winner's, comes up at the end).
  showAt: number
  lap: number | null
  surname: string
  colour: string
  lines: (TeamRadioLine & { en: string; uk: string })[]
}

// How long a clip stays on screen, in real seconds at any playback speed.
const SHOW_MS = 7000

export function useTeamRadio(sessionKey: number | null, data: ReplayData | null): RadioClip[] {
  const radio = useAsync(
    () => (sessionKey ? api.teamRadio(sessionKey) : Promise.resolve(null)),
    [sessionKey],
  )
  return useMemo(() => {
    if (!data || !radio.data || radio.data.sessionKey !== data.session.sessionKey) return []
    const drivers = new Map(data.drivers.map((d) => [d.num, d]))
    const out: RadioClip[] = []
    for (const c of radio.data.clips) {
      const lines = c.lines.filter((l): l is RadioClip['lines'][number] => !!l.en && !!l.uk)
      if (c.unclear || !lines.length) continue
      const at = Date.parse(c.date)
      let lap: number | null = null
      for (const l of data.laps) if (l.num === c.driverNumber && l.t <= at && (lap == null || l.lap > lap)) lap = l.lap
      const d = drivers.get(c.driverNumber)
      const parts = (d?.name ?? c.code).trim().split(/\s+/)
      out.push({
        ...c,
        lines,
        at,
        showAt: Math.min(Math.max(at, data.startMs), data.endMs),
        lap,
        surname: parts[parts.length - 1].toUpperCase(),
        colour: teamColor(d?.colour ?? null),
      })
    }
    return out
  }, [data, radio.data])
}

// The clip on screen at replay time `absT`: the latest one aired before it,
// for SHOW_MS of real time.
export function activeClip(clips: RadioClip[], absT: number, speed: number): RadioClip | null {
  let hit: RadioClip | null = null
  for (const c of clips) if (c.showAt <= absT && absT - c.showAt <= SHOW_MS * speed) hit = c
  return hit
}

// One clip plays at a time.
export function useRadioAudio() {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  useEffect(() => () => ref.current?.pause(), [])
  const toggle = (c: RadioClip) => {
    ref.current?.pause()
    if (playing === c.id) {
      setPlaying(null)
      return
    }
    const a = new Audio(c.url)
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    ref.current = a
    setPlaying(c.id)
  }
  return { playing, toggle }
}

export type RadioAudio = ReturnType<typeof useRadioAudio>
