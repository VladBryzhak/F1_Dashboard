import { useI18n } from '../i18n/core'
import type { WeatherSample } from '../types/f1'
import './WeatherCard.css'

// The latest sample at or before `time` (OpenF1 posts about one a minute).
// eslint-disable-next-line react-refresh/only-export-components
export function weatherAt(samples: WeatherSample[], time: number): WeatherSample | null {
  if (samples.length === 0) return null
  let lo = 0
  let hi = samples.length - 1
  if (time < samples[0].t) return samples[0]
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (samples[mid].t <= time) lo = mid
    else hi = mid - 1
  }
  return samples[lo]
}

// Compass point for a wind direction in degrees (where it blows from).
function compass(deg: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return points[Math.round(deg / 45) % 8]
}

// Track weather for the SESSION side panel (Live and Replay).
export default function WeatherCard({ sample }: { sample: WeatherSample | null }) {
  const { t, fmtNum } = useI18n()
  if (!sample) return null
  const deg = (n: number | null) => (n == null ? '—' : `${fmtNum(n, { maximumFractionDigits: 1 })}°C`)
  return (
    <div className="rp-side-card rp-weather">
      <h4 className="rp-side-title">{t('wx.title')}</h4>
      <div className="rp-kv">
        <span>{t('wx.air')}</span>
        <span className="mono">{deg(sample.air)}</span>
      </div>
      <div className="rp-kv">
        <span>{t('wx.track')}</span>
        <span className="mono">{deg(sample.track)}</span>
      </div>
      <div className="rp-kv">
        <span>{t('wx.humidity')}</span>
        <span className="mono">
          {sample.humidity == null ? '—' : `${fmtNum(sample.humidity, { maximumFractionDigits: 0 })}%`}
        </span>
      </div>
      <div className="rp-kv">
        <span>{t('wx.wind')}</span>
        <span className="mono">
          {sample.wind == null
            ? '—'
            : `${fmtNum(sample.wind, { maximumFractionDigits: 1 })} ${t('wx.ms')}${
                sample.windDir != null ? ` · ${compass(sample.windDir)}` : ''
              }`}
        </span>
      </div>
      <div className="rp-kv">
        <span>{t('wx.rain')}</span>
        <span className={sample.rain ? 'rp-wx-rain' : undefined}>
          {sample.rain ? t('wx.rainYes') : t('wx.rainNo')}
        </span>
      </div>
    </div>
  )
}
