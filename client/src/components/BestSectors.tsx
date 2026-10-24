import { useI18n } from '../i18n/core'
import { fmtTime, teamColor } from '../lib/live'
import './BestSectors.css'

export interface SectorRecord {
  time: number | null // seconds
  code: string | null // holder's three-letter code
  colour: string | null // holder's team colour (OpenF1 hex, no '#')
}

export interface LapRecord extends SectorRecord {
  lap: number | null // lap number it was set on
}

function Holder({ code, colour }: { code: string | null; colour: string | null }) {
  if (!code) return <span className="bs-drv" />
  return (
    <span className="bs-drv">
      <span className="lb-stripe" style={{ background: teamColor(colour) }} />
      {code}
    </span>
  )
}

// Session bests and who holds them: the fastest lap, the best time in each
// sector, and the "ideal lap" (the three best sectors added up) against the
// fastest actual lap. Used by the live board and by the replay, where the
// records are as of the replay clock.
export default function BestSectors({
  sectors,
  fastest,
}: {
  sectors: SectorRecord[]
  fastest: LapRecord | null
}) {
  const { t, fmtNum } = useI18n()
  const known = sectors.every((s) => s.time != null)
  const ideal = known ? sectors.reduce((sum, s) => sum + (s.time ?? 0), 0) : null
  const gain = ideal != null && fastest?.time != null ? fastest.time - ideal : null
  const empty = fastest?.time == null && sectors.every((s) => s.time == null)

  return (
    <div className="rp-side-card bs-card">
      <h4 className="rp-side-title">{t('bs.title')}</h4>
      {empty ? (
        <p className="bs-empty">{t('bs.none')}</p>
      ) : (
        <>
          {fastest?.time != null && (
            <div className="bs-row bs-lap">
              <span className="bs-sec">{t('bs.lap')}</span>
              <span className="bs-who">
                <Holder code={fastest.code} colour={fastest.colour} />
                {fastest.lap != null && (
                  <span className="bs-lapno">{t('bs.onLap', { n: fastest.lap })}</span>
                )}
              </span>
              <span className="bs-time mono">{fmtTime(fastest.time)}</span>
            </div>
          )}
          {sectors.map((s, i) => (
            <div className="bs-row" key={i}>
              <span className="bs-sec">S{i + 1}</span>
              <Holder code={s.code} colour={s.colour} />
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
