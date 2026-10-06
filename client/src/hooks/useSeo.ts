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

export function useSeo(
  opts: {
    title?: string
    description?: string
    // One or more schema.org objects, injected as a single JSON-LD <script> so
    // Google can show rich results (driver facts, event cards, breadcrumbs).
    jsonLd?: object | object[]
    // Override the canonical path (default: the current pathname). Used where
    // several URLs show the same content — e.g. /standings and
    // /standings/<currentSeason> both point at /standings.
    canonicalPath?: string
  } = {},
) {
  const title = opts.title ? `${opts.title} · ${SITE}` : DEFAULT_TITLE
  const description = opts.description ?? BASE_DESC
  const canonicalPath = opts.canonicalPath
  // Serialize here so the effect has a stable primitive dependency (the object
  // identity changes every render, which would otherwise loop forever).
  const jsonLd = opts.jsonLd
    ? JSON.stringify(
        Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd],
      )
    : ''

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
    canonical.setAttribute(
      'href',
      window.location.origin + (canonicalPath ?? window.location.pathname),
    )

    // JSON-LD: keep a single hook-managed script in sync with the current route.
    let ld = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"][data-seo="1"]',
    )
    if (jsonLd) {
      if (!ld) {
        ld = document.createElement('script')
        ld.setAttribute('type', 'application/ld+json')
        ld.setAttribute('data-seo', '1')
        document.head.appendChild(ld)
      }
      ld.textContent = jsonLd
    } else if (ld) {
      ld.remove()
    }
  }, [title, description, jsonLd, canonicalPath])
}
