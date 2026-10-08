import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { LiveStatus } from '../types/f1'

// Polls /api/live/status so both the header dot and the Live page know whether a
// session is live now, what's next, and which session the board should show.
export function useLiveStatus(pollMs = 60000): LiveStatus | null {
  const [status, setStatus] = useState<LiveStatus | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .liveStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => {})
    load()
    const id = setInterval(load, pollMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [pollMs])

  return status
}
