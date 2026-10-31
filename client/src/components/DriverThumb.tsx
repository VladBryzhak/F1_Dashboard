import { useEffect, useState } from 'react'
import { f1SrcSet } from '../lib/f1meta'

// A driver's head and shoulders on a small tile: tries each URL in turn (the
// official portrait for a team and season, then a Wikimedia photo) and falls
// back to the driver's code on a blank tile. Styles: .drv-thumb in shared.css.
export default function DriverThumb({
  urls,
  code,
  className,
}: {
  urls: (string | null | undefined)[]
  code: string
  className?: string
}) {
  const list = urls.filter((u): u is string => !!u)
  const key = list.join('|')
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [key])
  const url = list[idx]
  return (
    <span className={`drv-thumb${className ? ` ${className}` : ''}`} aria-hidden="true">
      {url ? (
        <img
          src={url}
          // The tile is about 90 px wide (formula1.com portraits only).
          srcSet={f1SrcSet(url)}
          sizes="90px"
          alt=""
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <span className="drv-thumb-code">{code}</span>
      )}
    </span>
  )
}
