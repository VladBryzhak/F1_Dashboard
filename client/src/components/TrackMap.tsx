import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/core'
import { teamColor } from '../lib/live'
import type { TrackModel } from '../lib/trackModel'
import type { ReplayData } from '../types/f1'
import './TrackMap.css'

// Live track map for the replay: every car as a dot in its team colour on the
// circuit's racing line, with the pit lane. Between the replay clock's ticks
// (every 200 ms of real time) positions are extrapolated with
// requestAnimationFrame so cars glide instead of jumping, even at 60×.
// Dot radius in map units (the drawing's longest side is 100).
const R = 2.4

// Black or white digits, whichever reads better on the team colour.
function inkOn(hex: string | null): string {
  const h = (hex ?? '888888').replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.55 ? '#0e0e13' : '#fff'
}

export default function TrackMap({
  data,
  model,
  time,
  playing,
  speed,
  order,
  highlight,
}: {
  data: ReplayData
  model: TrackModel
  time: number // replay clock, epoch ms
  playing: boolean
  speed: number
  order: number[] // driver numbers in race order (leader first)
  highlight: Set<number> // expanded rows get a label
}) {
  const { t } = useI18n()
  const [now, setNow] = useState(time)
  const anchor = useRef({ time, wall: performance.now() })

  useEffect(() => {
    anchor.current = { time, wall: performance.now() }
    setNow(time)
  }, [time])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      // Don't run ahead of the next replay tick by more than one step.
      const ahead = Math.min((performance.now() - anchor.current.wall) * speed, 200 * speed)
      setNow(anchor.current.time + ahead)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const { track } = model
  const cars = model.stateAt(now)
  const rank = new Map(order.map((n, i) => [n, i]))
  // Leaders drawn last so they sit on top.
  cars.sort((a, b) => (rank.get(b.num) ?? 99) - (rank.get(a.num) ?? 99))
  const drivers = new Map(data.drivers.map((d) => [d.num, d]))
  const leader = order[0]
  const pad = 6

  // Labels for cars running close together would overlap: stack each one
  // below any label already placed near it.
  const labelDy = new Map<number, number>()
  const placed: [number, number][] = []
  for (const num of order) {
    const c = cars.find((x) => x.num === num)
    if (!c || c.inGarage || !(highlight.has(num) || num === leader)) continue
    let dy = 0
    while (placed.some(([x, y]) => Math.abs(x - c.x) < 10 && Math.abs(y - (c.y + dy)) < 3.6)) dy += 3.8
    placed.push([c.x, c.y + dy])
    labelDy.set(num, dy)
  }

  return (
    <div className="track-map">
      <svg
        viewBox={`${-pad} ${-pad} ${track.w + pad * 2} ${track.h + pad * 2}`}
        role="img"
        aria-label={t('rp.mapLabel')}
      >
        {model.pitPath && <path className="tm-pit" d={model.pitPath} />}
        <path className="tm-track" d={model.linePath} />
        <path className="tm-line" d={model.linePath} />
        <circle className="tm-finish" cx={model.finish[0]} cy={model.finish[1]} r={1.3} />
        {cars.map((c) => {
          const drv = drivers.get(c.num)
          const labelled = highlight.has(c.num) || c.num === leader
          return (
            <g
              key={c.num}
              className={`tm-car${c.inGarage ? ' garage' : ''}${c.inPit ? ' pit' : ''}`}
              transform={`translate(${c.x.toFixed(2)} ${c.y.toFixed(2)})`}
            >
              <circle r={R} fill={teamColor(drv?.colour ?? null)} />
              <text className="tm-num" fill={inkOn(drv?.colour ?? null)} dy="0.36em">
                {c.num}
              </text>
              {labelled && !c.inGarage && (
                <text className="tm-code" x={R + 1} y={1.1 + (labelDy.get(c.num) ?? 0)}>
                  {drv?.code}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="tm-note">{t('rp.mapNote')}</p>
    </div>
  )
}
