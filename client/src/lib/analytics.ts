// Google Analytics 4 (gtag.js). The measurement ID is public by design — it
// ships to every visitor's browser — so it lives in the repo rather than an env
// var (Render env vars aren't reachable while the dashboard is blocked anyway).
//
// We only load GA on the live site, so local dev and the Capacitor iOS app don't
// pollute the stats. Page views are sent manually on each route change because
// this is a single-page app: without that, GA would only ever see the first load.
const GA_ID = 'G-VQLFDX40N4'

const PROD_HOST = 'f1-dashboard-bryzhak.onrender.com'
const enabled =
  typeof window !== 'undefined' && window.location.hostname === PROD_HOST

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function initAnalytics(): void {
  if (!enabled) return

  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)

  window.dataLayer = window.dataLayer || []
  // gtag pushes the raw `arguments` object onto dataLayer; with a rest param we
  // push the equivalent arguments array, which GA reads the same way.
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }
  window.gtag('js', new Date())
  // We fire page_view ourselves on every route change, so turn off the automatic
  // one to avoid double-counting the initial load.
  window.gtag('config', GA_ID, { send_page_view: false })
}

export function trackPageView(path: string): void {
  if (!enabled || typeof window.gtag !== 'function') return
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
