import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { afterLoadIdle } from '../lib/idle'
import type { LiveStatus } from '../types/f1'

// Polls /api/live/status so both the header dot and the Live page know whether a
// session is live now, what's next, and which session the board should show.
// `defer`: the first request waits until the page has loaded and the browser
// is idle (the header's dot), so it isn't part of the chain the first paint
// waits on (HTML → app bundle → this call, in PageSpeed's network tree).
export function useLiveStatus(pollMs = 60000, defer = false): LiveStatus | null {
  const [status, setStatus] = useState<LiveStatus | null>(null)

  useEffect(() => {
    let alive = true
    let id: number | undefined
    const load = () =>
      api
        .liveStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => {})
    const start = () => {
      load()
      id = window.setInterval(load, pollMs)
    }
    const cancelStart = defer ? afterLoadIdle(start) : (start(), () => {})
    return () => {
      alive = false
      cancelStart()
      window.clearInterval(id)
    }
  }, [pollMs, defer])

  return status
}
