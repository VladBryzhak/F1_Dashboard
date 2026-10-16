import { useEffect, useState } from 'react'
import { api } from '../api/client'
import ReplayPlayer from '../components/ReplayPlayer'
import WeatherCard from '../components/WeatherCard'
import { useLiveStatus } from '../hooks/useLiveStatus'
import { useSeo } from '../hooks/useSeo'
import { useI18n } from '../i18n/core'
import {
  fmtCountdown,
  fmtTime,
  sectorClass,
  segmentClass,
  sessionLabel,
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
  const { t, tn } = useI18n()
  const latest: LiveLap | undefined = detail.laps[0]
  return (
    <div className="ld-detail">
      {latest && (
        <div className="ld-sectors">
          {[0, 1, 2].map((i) => (
            <div className="ld-sector" key={i}>
              <div className="ld-sector-head">
                <span>{t('rp.sectorN', { n: i + 1 })}</span>
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
          <h4>{t('rp.best')}</h4>
          <div className="ld-kv">
            <span>{t('tel.lap')}</span>
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
              <span>{t('rp.speedTrap')}</span>
              <span className="mono">
                {latest.speeds.st != null ? `${latest.speeds.st} ${t('tel.kmh')}` : '—'}
              </span>
            </div>
          )}
        </div>

        <div className="ld-col">
          <h4>{t('rp.tyres')}</h4>
          {detail.stints.length === 0 && <p className="muted">—</p>}
          {detail.stints.map((s) => {
            const ty = tyre(s.compound)
            const n = s.lapEnd - s.lapStart + 1
            return (
              <div className="ld-kv" key={s.stintNumber}>
                <span>
                  <span className={`tyre tyre-${ty.cls}`}>{ty.label}</span>{' '}
                  {t('strat.laps', { from: s.lapStart, to: s.lapEnd })}{' '}
                  <span className="muted">· {tn('plural.lapsN', n)}</span>
                </span>
                <span className="muted">{s.compound ?? ''}</span>
              </div>
            )
          })}
        </div>

        <div className="ld-col">
          <h4>{t('rp.pitStops')}</h4>
          {detail.pits.length === 0 && <p className="muted">{t('rp.none')}</p>}
          {detail.pits.map((p, i) => (
            <div className="ld-kv" key={i}>
              <span>{t('tel.lapN', { n: p.lapNumber ?? '—' })}</span>
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
  const { t } = useI18n()
  const sessionName = (name: string) => sessionLabel(name, t)
  const now = useNow()
  const [mode, setMode] = useState<'live' | 'replay'>('live')
  const sessionKey = status?.boardSessionKey ?? null

  const [board, setBoard] = useState<LiveBoard | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [detail, setDetail] = useState<LiveDriverDetail | null>(null)

  // Poll the board while a session is selected.
  useEffect(() => {
    if (sessionKey == null) {
      setBoard(null)
      return
    }
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
        <h1>{t('live.title')}</h1>
      </div>

      <div className="tabs">
        <button
          className={mode === 'live' ? 'tab active' : 'tab'}
          onClick={() => setMode('live')}
        >
          {t('nav.live')}
        </button>
        <button
          className={mode === 'replay' ? 'tab active' : 'tab'}
          onClick={() => setMode('replay')}
        >
          {t('live.replay')}
        </button>
      </div>

      {mode === 'replay' && <ReplayPlayer />}

      {mode === 'live' && (
        <>
          {!status && <p className="muted">{t('common.loading')}</p>}

      {status?.locked && (
        <p className="banner">
          <span className="live-dot on" /> {t('live.locked')}
        </p>
      )}

      {status && !status.locked && status.live ? (
        <p className="live-session">
          <span className="live-dot on" /> {t('sched.live')} · {sessionName(status.live.sessionName)} ·{' '}
          {status.live.location}
          {status.live.dateEnd && (
            <span className="live-count">
              {t('live.endsIn', { time: fmtCountdown(status.live.dateEnd, now, t('sched.dayShort')) })}
            </span>
          )}
        </p>
      ) : (
        status && (
          <>
            {status.next && (
              <div className="next-card">
                <span className="next-label">{t('sched.nextSession')}</span>
                <span className="next-name">
                  {sessionName(status.next.sessionName)} · {status.next.location}
                </span>
                <span className="next-count">
                  {t('live.in', { time: fmtCountdown(status.next.dateStart, now, t('sched.dayShort')) })}
                </span>
              </div>
            )}
            {status.last && (
              <p className="live-session">
                <span className="live-dot" /> {sessionName(status.last.sessionName)} ·{' '}
                {status.last.location} · {status.last.year}
                <span className="live-replay">{t('live.replayTag')}</span>
              </p>
            )}
          </>
        )
      )}

      {boardError && !board && (
        <p className="banner">{t('live.boardError', { error: boardError })}</p>
      )}

      {board && (
        <div className="rp-layout">
        <div className="rp-main">
        <div className="live-board">
          <div className="lb-head">
            <span className="lb-pos">#</span>
            <span className="lb-drv">{t('wk.colDriver')}</span>
            <span className="lb-gap">{t('wk.colGap')}</span>
            <span className="lb-int">{t('live.interval')}</span>
            <span className="lb-lap">{t('rp.last')}</span>
            <span className="lb-best">{t('rp.best')}</span>
            <span className="lb-tyre">{t('rp.tyre')}</span>
          </div>

          {board.rows.map((r) => {
            const ty = tyre(r.tyreCompound)
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
                    <span className={`tyre tyre-${ty.cls}`}>{ty.label}</span>
                    {r.tyreAge != null && <span className="tyre-age">{r.tyreAge}</span>}
                  </span>
                </button>

                {open &&
                  (detail && detail.driverNumber === r.driverNumber ? (
                    <DriverDetail detail={detail} sessionBest={board.sessionBest} />
                  ) : (
                    <div className="ld-detail">
                      <p className="muted">{t('common.loading')}</p>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
        </div>
        <aside className="rp-side">
          <div className="rp-side-card">
            <h4 className="rp-side-title">{t('rp.session')}</h4>
            <div className="rp-kv"><span>{t('rp.session')}</span><span>{sessionName(board.session.sessionName)}</span></div>
            <div className="rp-kv"><span>{t('rp.circuit')}</span><span>{board.session.location}</span></div>
            <div className="rp-kv">
              <span>{t('rp.status')}</span>
              <span className={`rp-side-status rp-side-status--${status?.live ? 'red' : 'chequered'}`}>
                {status?.live ? t('nav.live') : t('live.finished')}
              </span>
            </div>
            <div className="rp-kv"><span>{t('wk.fastestLap')}</span><span className="mono">{fmtTime(board.sessionBest.lap)}</span></div>
            {board.sessionBest.sectors.map((s, i) => (
              <div className="rp-kv" key={i}><span>{t('live.bestS', { n: i + 1 })}</span><span className="mono">{fmtTime(s)}</span></div>
            ))}
          </div>
          <WeatherCard sample={board.weather} />
        </aside>
        </div>
      )}
        </>
      )}
    </section>
  )
}
