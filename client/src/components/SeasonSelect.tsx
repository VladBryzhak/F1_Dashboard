import { SEASONS } from '../lib/seasons'

export default function SeasonSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (season: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Season"
    >
      {SEASONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}
