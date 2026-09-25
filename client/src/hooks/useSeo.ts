import { useEffect } from 'react'

// Per-page SEO for the SPA: sets a unique <title>, meta description, Open Graph
// / Twitter title+description and a canonical URL as the user navigates.
// Google renders client-side JS, so these are picked up for indexing.

const SITE = 'F1 Dashboard'
const DEFAULT_TITLE = `${SITE} — Formula 1 Standings, Calendar & Stats`
const BASE_DESC =
  'Formula 1 standings, race calendar, driver & team career stats, head-to-head comparisons and past-race telemetry — every season from 1950 to today.'

function upsert(selector: string, make: () => HTMLMetaElement, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = make()
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function useSeo(opts: { title?: string; description?: string } = {}) {
  const title = opts.title ? `${opts.title} · ${SITE}` : DEFAULT_TITLE
  const description = opts.description ?? BASE_DESC

  useEffect(() => {
    document.title = title

    upsert(
      'meta[name="description"]',
      () => {
        const m = document.createElement('meta')
        m.setAttribute('name', 'description')
        return m
      },
      description,
    )
    upsert(
      'meta[property="og:title"]',
      () => {
        const m = document.createElement('meta')
        m.setAttribute('property', 'og:title')
        return m
      },
      title,
    )
    upsert(
      'meta[property="og:description"]',
      () => {
        const m = document.createElement('meta')
        m.setAttribute('property', 'og:description')
        return m
      },
      description,
    )
    upsert(
      'meta[name="twitter:title"]',
      () => {
        const m = document.createElement('meta')
        m.setAttribute('name', 'twitter:title')
        return m
      },
      title,
    )
    upsert(
      'meta[name="twitter:description"]',
      () => {
        const m = document.createElement('meta')
        m.setAttribute('name', 'twitter:description')
        return m
      },
      description,
    )

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', window.location.origin + window.location.pathname)
  }, [title, description])
}
