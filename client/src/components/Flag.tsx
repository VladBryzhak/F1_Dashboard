import { useState } from 'react'
import { flagFor } from '../lib/f1meta'

// Real country flag image from the free flagcdn.com CDN (ISO alpha-2 code).
// Falls back to the emoji flag if the code is missing or the image fails.
export default function Flag({
  code,
  nationality,
}: {
  code: string | null
  nationality: string
}) {
  const [failed, setFailed] = useState(false)

  if (!code || failed) {
    return (
      <span className="flag flag-emoji" title={nationality}>
        {flagFor(nationality)}
      </span>
    )
  }
  return (
    <img
      className="flag"
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      width={26}
      height={18}
      alt={nationality}
      title={nationality}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
