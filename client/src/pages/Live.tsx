import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useLiveStatus } from '../hooks/useLiveStatus'
import { useSeo } from '../hooks/useSeo'
import {
  fmtCountdown,
  fmtTime,
  sectorClass,
  segmentClass,
  teamColor,
  tyre,
} from '../lib/live'
import type { LiveBoard, LiveDriverDetail, LiveLap } from '../types/f1'

const REFRESH_MS = 7000

// A clock that ticks once a second, for the countdown.
function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// A sector's mini-sectors as a colour-coded bar.
function SegmentBar({ segments }: { segments: number[] }) {
  if (!segments.length) return <span className="muted">—</span>
  return (
    <span className="seg-bar">
      {segments.map((code, i) => (
        <span key={i} className={`seg seg-${segmentClass(code)}`} />
      ))}
    </span>
  )
}

function DriverDetail({
  detail,
  sessionBest,
}: {
  detail: LiveDriverDetail
  sessionBest: LiveBoard['sessionBest']
}) {
  const latest: LiveLap | undefined = detail.laps[0]
  return (
    <div className="ld-detail">
      {latest && (
        <div className="ld-sectors">
          {[0, 1, 2].map((i) => (
            <div className="ld-sector" key={i}>
              <div className="ld-sector-head">
                <span>Sector {i + 1}</span>
                <span
                  className={`ld-sector-time sector-${sectorClass(
                    latest.sectors[i],
                    detail.bestSectors[i],
                    sessionBest.sectors[i],
                  )}`}
                >
                  {fmtTime(latest.sectors[i])}
                </span>
              </div>
              <SegmentBar segments={latest.segments[i]} />
            </div>
          ))}
        </div>
      )}

      <div className="ld-cols">
        <div className="ld-col">
          <h4>Best</h4>
          <div className="ld-kv">
            <span>Lap</span>
            <span className="mono">{fmtTime(detail.bestLap)}</span>
          </div>
          {detail.bestSectors.map((s, i) => (
            <div className="ld-kv" key={i}>
              <span>S{i + 1}</span>
              <span className="mono">{fmtTime(s)}</span>
            </div>
          ))}
          {latest && (
            <div className="ld-kv">
              <span>Speed trap</span>
              <span className="mono">
                {latest.speeds.st != null ? `${latest.speeds.st} km/h` : '—'}
              </span>
            </div>
          )}
        </div>

        <div className="ld-col">
          <h4>Tyres</h4>
          {detail.stints.length === 0 && <p className="muted">—</p>}
          {detail.stints.map((s) => {
            const t = tyre(s.compound)
            const n = s.lapEnd - s.lapStart + 1
            return (
              <div className="ld-kv" key={s.stintNumber}>
                <span>
                  <span className={`tyre tyre-${t.cls}`}>{t.label}</span>{' '}
                  Laps {s.lapStart}–{s.lapEnd}{' '}
                  <span className="muted">· {n} {n === 1 ? 'lap' : 'laps'}</span>
                </span>
                <span className="muted">{s.compound ?? ''}</span>
              </div>
            )
          })}
        </div>

        <div className="ld-col">
          <h4>Pit stops</h4>
          {detail.pits.length === 0 && <p className="muted">None</p>}
          {detail.pits.map((p, i) => (
            <div className="ld-kv" key={i}>
              <span>Lap {p.lapNumber ?? '—'}</span>
              <span className="mono">
                {p.pitDuration != null ? `${p.pitDuration.toFixed(1)}s` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Live() {
  useSeo({
    title: 'Live Timing',
    description:
      'Live Formula 1 timing board — positions, gaps, lap times, sectors, mini-sectors and tyres, with expandable per-driver detail.',
  })

  const status = useLiveStatus(30000)
  const now = useNow()
  const sessionKey = status?.boardSessionKey ?? null

  const [board, setBoard] = useState<LiveBoard | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [detail, setDetail] = useState<LiveDriverDetail | null>(null)

  // Poll the board while a session is selected.
  useEffect(() => {
    if (sessionKey == null) return
    let alive = true
    const load = () =>
      api
        .liveBoard(sessionKey)
        .then((b) => alive && (setBoard(b), setBoardError(null)))
        .catch((e) => alive && setBoardError(e instanceof Error ? e.message : 'Error'))
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [sessionKey])

  // Poll the expanded driver's detail.
  useEffect(() => {
    if (sessionKey == null || expanded == null) {
      setDetail(null)
      return
    }
    let alive = true
    const load = () =>
      api
        .liveDriver(sessionKey, expanded)
        .then((d) => alive && setDetail(d))
        .catch(() => {})
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [sessionKey, expanded])

  return (
    <section className="live">
      <div className="page-head">
        <h1>Live Timing</h1>
      </div>

      {!status && <p className="muted">Loading…</p>}

      {status?.live ? (
        <p className="live-session">
          <span className="live-dot on" /> LIVE · {status.live.sessionName} ·{' '}
          {status.live.location}
          {status.live.dateEnd && (
            <span className="live-count">
              ends in {fmtCountdown(status.live.dateEnd, now)}
            </span>
          )}
        </p>
      ) : (
        status && (
          <>
            {status.next && (
              <div className="next-card">
                <span className="next-label">Next session</span>
                <span className="next-name">
                  {status.next.sessionName} · {status.next.location}
                </span>
                <span className="next-count">
                  in {fmtCountdown(status.next.dateStart, now)}
                </span>
              </div>
            )}
            {status.last && (
              <p className="live-session">
                <span className="live-dot" /> {status.last.sessionName} ·{' '}
                {status.last.location} · {status.last.year}
                <span className="live-replay">replay</span>
              </p>
            )}
          </>
        )
      )}

      {boardError && !board && (
        <p className="banner">Could not load the board: {boardError}</p>
      )}

      {board && (
        <div className="live-board">
          <div className="lb-head">
            <span className="lb-pos">#</span>
            <span className="lb-drv">Driver</span>
            <span className="lb-gap">Gap</span>
            <span className="lb-int">Interval</span>
            <span className="lb-lap">Last</span>
            <span className="lb-best">Best</span>
            <span className="lb-tyre">Tyre</span>
          </div>

          {board.rows.map((r) => {
            const t = tyre(r.tyreCompound)
            const open = expanded === r.driverNumber
            return (
              <div className={`lb-row-wrap${open ? ' open' : ''}`} key={r.driverNumber}>
                <button
                  className="lb-row"
                  onClick={() => setExpanded(open ? null : r.driverNumber)}
                  aria-expanded={open}
                >
                  <span className="lb-pos">{r.position ?? '–'}</span>
                  <span className="lb-drv">
                    <span className="lb-stripe" style={{ background: teamColor(r.teamColour) }} />
                    <span className="lb-code">{r.code}</span>
                    <span className="lb-team">{r.teamName}</span>
                  </span>
                  <span className="lb-gap mono">{r.gapToLeader ?? '—'}</span>
                  <span className="lb-int mono">{r.interval ?? '—'}</span>
                  <span className="lb-lap mono">{fmtTime(r.lastLap)}</span>
                  <span className="lb-best mono">{fmtTime(r.bestLap)}</span>
                  <span className="lb-tyre">
                    <span className={`tyre tyre-${t.cls}`}>{t.label}</span>
                    {r.tyreAge != null && <span className="tyre-age">{r.tyreAge}</span>}
                  </span>
                </button>

                {open &&
                  (detail && detail.driverNumber === r.driverNumber ? (
                    <DriverDetail detail={detail} sessionBest={board.sessionBest} />
                  ) : (
                    <div className="ld-detail">
                      <p className="muted">Loading detail…</p>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
