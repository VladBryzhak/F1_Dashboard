import type { CircuitOutline as Outline } from '../types/f1'
import './CircuitOutline.css'

// A circuit drawn as a single red line (with a dot where the drawing starts),
// from the open f1-circuits geodata. Scales to its container.
export default function CircuitOutline({
  outline,
  label,
  className,
  strokeWidth = 2.8,
}: {
  outline: Outline
  label: string
  className?: string
  strokeWidth?: number
}) {
  // Strokes don't scale with the drawing (non-scaling-stroke), so the line and
  // the start dot keep the same on-screen weight on a small card and a big hero.
  const pad = 4
  const [sx, sy] = outline.start
  return (
    <svg
      className={`circuit-outline${className ? ` ${className}` : ''}`}
      viewBox={`${-pad} ${-pad} ${outline.w + pad * 2} ${outline.h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      <path className="co-track" d={outline.d} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      <path
        className="co-start"
        d={`M${sx} ${sy}h0`}
        strokeWidth={strokeWidth * 2.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
