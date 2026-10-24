import { useI18n } from '../i18n/core'
import { fmtTime, teamColor } from '../lib/live'
import './BestSectors.css'

export interface SectorRecord {
  time: number | null // seconds
  code: string | null // holder's three-letter code
  colour: string | null // holder's team colour (OpenF1 hex, no '#')
}

// Session-best sector times and who holds them, plus the "ideal lap" (the
// three bests added up) against the fastest actual lap. Used by the live board
// and by the replay, where the records are as of the replay clock.
export default function BestSectors({
  sectors,
  fastestLap,
}: {
  sectors: SectorRecord[]
  fastestLap: number | null
}) {
  const { t, fmtNum } = useI18n()
  const known = sectors.every((s) => s.time != null)
  const ideal = known ? sectors.reduce((sum, s) => sum + (s.time ?? 0), 0) : null
  const gain = ideal != null && fastestLap != null ? fastestLap - ideal : null

  return (
    <div className="rp-side-card bs-card">
      <h4 className="rp-side-title">{t('bs.title')}</h4>
      {sectors.every((s) => s.time == null) ? (
        <p className="bs-empty">{t('bs.none')}</p>
      ) : (
        <>
          {sectors.map((s, i) => (
            <div className="bs-row" key={i}>
              <span className="bs-sec">S{i + 1}</span>
              <span className="bs-drv">
                {s.code && (
                  <>
                    <span className="lb-stripe" style={{ background: teamColor(s.colour) }} />
                    {s.code}
                  </>
                )}
              </span>
              <span className="bs-time mono">{fmtTime(s.time)}</span>
            </div>
          ))}
          {ideal != null && (
            <div className="bs-row bs-ideal" title={t('bs.idealHint')}>
              <span className="bs-label">{t('bs.ideal')}</span>
              <span className="bs-time mono">
                {fmtTime(ideal)}
                {gain != null && gain > 0.0005 && (
                  <em className="bs-gain">
                    −{fmtNum(gain, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </em>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
