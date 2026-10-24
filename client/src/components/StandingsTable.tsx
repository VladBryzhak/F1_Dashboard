import { useEffect, useState } from 'react'
import { driverPortraitUrl, teamColor } from '../lib/f1meta'
import type { ConstructorStanding, DriverStanding } from '../types/f1'
import Flag from './Flag'
import { useI18n } from '../i18n/core'
import { countryName } from '../lib/countries'

// Circular driver photo for a standings row. Tries the season/team-accurate
// portrait first, falls back to the season-agnostic OpenF1 headshot, then to
// a colour chip with the driver's code if both images fail.
function DriverAvatar({
  portraitUrl,
  fallbackUrl,
  code,
  color,
}: {
  portraitUrl?: string | null
  fallbackUrl?: string
  code: string | null
  color: string
}) {
  const candidates = [portraitUrl, fallbackUrl].filter((u): u is string => !!u)
  const key = candidates.join('|')
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [key])
  const src = candidates[idx]
  if (src) {
    return (
      <img
        className="avatar"
        src={src}
        alt=""
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
      />
    )
  }
  return (
    <span className="avatar avatar-fallback" style={{ background: `${color}33`, color }}>
      {code ?? '–'}
    </span>
  )
}

export function DriverStandingsTable({
  rows,
  season,
  headshots,
}: {
  rows: DriverStanding[]
  season: string
  headshots?: Record<string, string>
}) {
  const { t, lang, locale } = useI18n()
  const leaderPoints = rows[0]?.points ?? 0
  return (
    <div className="card">
      <table className="standings standings--rank">
        <thead>
          <tr>
            <th className="pos">{t('wk.colPos')}</th>
            <th>{t('wk.colDriver')}</th>
            <th>{t('wk.colTeam')}</th>
            <th>{t('st.country')}</th>
            <th className="num">{t('drv.colWins')}</th>
            <th className="num">{t('drv.colPoints')}</th>
            <th className="num">{t('wk.colGap')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gap = leaderPoints - r.points
            return (
              <tr key={r.driverId}>
                <td className="pos">{r.position}</td>
                <td>
                  <span className="entity">
                    <DriverAvatar
                      portraitUrl={driverPortraitUrl(r.driverId, r.constructorId, season)}
                      fallbackUrl={r.code ? headshots?.[r.code] : undefined}
                      code={r.code}
                      color={teamColor(r.constructorId)}
                    />
                    <span className="name">
                      {r.givenName} {r.familyName}
                    </span>
                    {r.code ? <span className="code">{r.code}</span> : null}
                  </span>
                </td>
                <td>
                  <span className="team">
                    <span
                      className="dot"
                      style={{ background: teamColor(r.constructorId) }}
                    />
                    {r.constructorName}
                  </span>
                </td>
                <td>
                  <span className="country">
                    <Flag code={r.countryCode} nationality={r.nationality} />
                    {lang === 'uk' && r.countryCode ? countryName(r.countryCode, locale) : r.nationality}
                  </span>
                </td>
                <td className="num">{r.wins}</td>
                <td className="num points">{r.points}</td>
                <td className="num muted">{gap > 0 ? `-${gap}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ConstructorStandingsTable({
  rows,
}: {
  rows: ConstructorStanding[]
}) {
  const { t, lang, locale } = useI18n()
  const leaderPoints = rows[0]?.points ?? 0
  return (
    <div className="card">
      <table className="standings standings--rank">
        <thead>
          <tr>
            <th className="pos">{t('wk.colPos')}</th>
            <th>{t('wk.colTeam')}</th>
            <th>{t('st.country')}</th>
            <th className="num">{t('drv.colWins')}</th>
            <th className="num">{t('drv.colPoints')}</th>
            <th className="num">{t('wk.colGap')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gap = leaderPoints - r.points
            return (
              <tr key={`${r.constructorId}:${r.name}`}>
                <td className="pos">{r.position}</td>
                <td>
                  <span className="team">
                    <span
                      className="dot"
                      style={{ background: teamColor(r.constructorId) }}
                    />
                    <span className="name">{r.name}</span>
                  </span>
                </td>
                <td>
                  <span className="country">
                    <Flag code={r.countryCode} nationality={r.nationality} />
                    {lang === 'uk' && r.countryCode ? countryName(r.countryCode, locale) : r.nationality}
                  </span>
                </td>
                <td className="num">{r.wins}</td>
                <td className="num points">{r.points}</td>
                <td className="num muted">{gap > 0 ? `-${gap}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
