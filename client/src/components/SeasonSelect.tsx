import { SEASONS } from '../lib/seasons'

export default function SeasonSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (season: string) => void
}) {
  // Seasons reachable by direct URL (e.g. /standings/2004) may fall outside the
  // default dropdown range; include the current value so it stays selected.
  const options = SEASONS.includes(value) ? SEASONS : [value, ...SEASONS]

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Season"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}
