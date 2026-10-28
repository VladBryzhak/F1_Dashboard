// Google Analytics 4 (gtag.js) with Google Consent Mode v2. The measurement ID
// is public by design — it ships to every visitor's browser — so it lives in
// the repo rather than an env var.
//
// Consent: nothing is stored until the visitor accepts the cookie notice.
// - 'advanced' (current): gtag loads with every consent type denied, so GA
//   sets no cookies and only receives cookieless signals; accepting grants
//   analytics_storage and full measurement starts.
// - 'basic': gtag isn't loaded at all until the visitor accepts.
// Ad-related consent stays denied — the site shows no ads.
//
// We only load GA on the live site, so local dev and the Capacitor iOS app
// don't pollute the stats. Page views are sent manually on each route change
// because this is a single-page app.
const GA_ID = 'G-VQLFDX40N4'
const CONSENT_MODE: 'advanced' | 'basic' = 'advanced'

const PROD_HOST = 'f1-dashboard-bryzhak.onrender.com'
// Dev-only test hook: ?ga_test=G-XXXX loads gtag locally with a throwaway ID
// so the consent flow can be checked without touching the real property.
const testId =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('ga_test')
    : null
const enabled =
  typeof window !== 'undefined' && (window.location.hostname === PROD_HOST || !!testId)
const measurementId = testId || GA_ID

export const CONSENT_KEY = 'cookieConsent' // 'accepted' | 'declined'
export type ConsentChoice = 'accepted' | 'declined'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function storedConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'declined' ? v : null
  } catch {
    return null
  }
}

let loaded = false

function loadGtag(granted: boolean): void {
  if (loaded) return
  loaded = true
  window.dataLayer = window.dataLayer || []
  // Must push the real `arguments` object, exactly like Google's snippet:
  // gtag.js only treats Arguments objects as gtag commands. A plain array
  // (what a rest parameter gives) is read as something else, so consent,
  // config and every event were silently ignored and nothing reached GA.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  } as Window['gtag']
  // The default must be set before config so the first hit respects it.
  window.gtag('consent', 'default', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  window.gtag('js', new Date())
  // We fire page_view ourselves on every route change, so turn off the
  // automatic one to avoid double-counting the initial load.
  window.gtag('config', measurementId, { send_page_view: false })

  // gtag.js is ~180 KB; fetch it once the page has loaded and the browser is
  // idle so it doesn't compete with the page's own content. Everything above
  // (consent, config, page views) waits in dataLayer until it runs.
  const add = () => {
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(s)
  }
  const whenIdle = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(add, { timeout: 4000 })
      : setTimeout(add, 2000)
  if (document.readyState === 'complete') whenIdle()
  else window.addEventListener('load', whenIdle, { once: true })
}

export function initAnalytics(): void {
  if (!enabled) return
  const granted = storedConsent() === 'accepted'
  if (CONSENT_MODE === 'advanced' || granted) loadGtag(granted)
}

// Called by the cookie notice (and its "Cookie settings" reopen).
export function setAnalyticsConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    // storage blocked — the choice still applies for this visit
  }
  if (!enabled) return
  const granted = choice === 'accepted'
  if (!loaded) {
    if (!granted) return // basic mode: nothing loaded, nothing to change
    loadGtag(true)
    trackPageView(window.location.pathname + window.location.search)
    return
  }
  window.gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' })
  if (!granted) clearGaCookies()
}

// Withdrawing consent removes the cookies GA set while it was granted.
function clearGaCookies(): void {
  const host = window.location.hostname
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim()
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of ['', host, `.${host}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
      }
    }
  }
}

export function trackPageView(path: string): void {
  if (!enabled || !loaded || typeof window.gtag !== 'function') return
  // Defer to the next tick so useSeo() has already updated document.title for
  // the new route before we read it here.
  setTimeout(() => {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, 0)
}

// A named GA4 event (e.g. a click on the donation button). Like page views it
// only goes out on the live site, and GA honours the visitor's consent.
export function trackEvent(name: string, params: Record<string, string> = {}): void {
  if (!enabled || !loaded || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
