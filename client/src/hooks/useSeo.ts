import { useEffect } from 'react'
import { langFromPath, localizedPath } from '../i18n/core'
import { DEFAULT_SEO } from '../lib/seoText'

// Per-page SEO for the SPA: sets a unique <title>, meta description, Open Graph
// / Twitter title+description and a canonical URL as the user navigates.
// Google renders client-side JS, so these are picked up for indexing.

const SITE = 'Paddock Times'

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
    // A page that isn't one (the "not found" page): tell search engines not
    // to index it, and drop the canonical URL and language twins, as the
    // server does when it answers 404.
    noindex?: boolean
    // Leave the tags alone: a child sets them (a profile that shows the "not
    // found" page in its place). Effects run child first, so the parent's
    // would otherwise overwrite the child's tags.
    skip?: boolean
  } = {},
) {
  // Defaults in the page's language (from its address).
  const fallback = DEFAULT_SEO[langFromPath(window.location.pathname)]
  const title = opts.title ? `${opts.title} · ${SITE}` : fallback.title
  const description = opts.description ?? fallback.description
  const canonicalPath = opts.canonicalPath
  const { noindex = false, skip = false } = opts
  // Serialize here so the effect has a stable primitive dependency (the object
  // identity changes every render, which would otherwise loop forever).
  const jsonLd = opts.jsonLd
    ? JSON.stringify(
        Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd],
      )
    : ''

  useEffect(() => {
    if (skip) return
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

    if (noindex) {
      upsert(
        'meta[name="robots"]',
        () => {
          const m = document.createElement('meta')
          m.setAttribute('name', 'robots')
          return m
        },
        'noindex',
      )
      document.head
        .querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], script[data-seo="1"]')
        .forEach((el) => el.remove())
      // Leaving the page (or it turning out to exist) lifts the noindex.
      return () => document.head.querySelector('meta[name="robots"]')?.remove()
    }

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    // An override is a language-neutral path (/standings); give it this
    // page's language prefix.
    const lang = langFromPath(window.location.pathname)
    const pagePath = canonicalPath ?? window.location.pathname
    canonical.setAttribute('href', window.location.origin + localizedPath(pagePath, lang))

    // The same page in both languages (the server sends these too; kept in
    // step here as the app moves between pages).
    for (const [hreflang, l] of [['en', 'en'], ['uk', 'uk'], ['x-default', 'en']] as const) {
      let alt = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hreflang}"]`)
      if (!alt) {
        alt = document.createElement('link')
        alt.setAttribute('rel', 'alternate')
        alt.setAttribute('hreflang', hreflang)
        document.head.appendChild(alt)
      }
      alt.setAttribute('href', window.location.origin + localizedPath(pagePath, l))
    }

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
  }, [title, description, jsonLd, canonicalPath, noindex, skip])
}
