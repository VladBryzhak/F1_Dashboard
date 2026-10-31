import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
// The landing page ships in the main bundle: no extra chunk round trip before
// the first (and largest) paint.
import Home from './pages/Home'
import { isSeason } from './hooks/useSeasonRoute'
import { useI18n } from './i18n/core'
import { trackPageView } from './lib/analytics'

// Route-level code splitting: each page becomes its own chunk, so the initial
// load no longer ships every page (and heavy deps like recharts) up front. A
// failed dynamic import almost always means a stale chunk after a redeploy:
// reload to pick up the new hashes instead of surfacing an error. At most once
// a minute, so a chunk that really can't be loaded (a network fault) ends on
// the error screen (ErrorBoundary in Layout) instead of reloading forever.
const RELOAD_KEY = 'chunkReloadedAt'
const RELOAD_EVERY_MS = 60_000

function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < RELOAD_EVERY_MS
  } catch {
    return true // no storage to remember it: don't risk a loop
  }
}

function lazyPage<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
) {
  return lazy(() =>
    factory().catch((err) => {
      if (!reloadedRecently()) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        } catch {
          throw err
        }
        window.location.reload()
        return new Promise<{ default: ComponentType<P> }>(() => {}) // reload underway; never resolve
      }
      throw err
    }),
  )
}

const Standings = lazyPage(() => import('./pages/Standings'))
const Calendar = lazyPage(() => import('./pages/Calendar'))
const RaceWeekend = lazyPage(() => import('./pages/RaceWeekend'))
const Circuits = lazyPage(() => import('./pages/Circuits'))
const CircuitProfile = lazyPage(() => import('./pages/CircuitProfile'))
const Drivers = lazyPage(() => import('./pages/Drivers'))
const DriverProfile = lazyPage(() => import('./pages/DriverProfile'))
const Teams = lazyPage(() => import('./pages/Teams'))
const TeamProfile = lazyPage(() => import('./pages/TeamProfile'))
const Compare = lazyPage(() => import('./pages/Compare'))
const Telemetry = lazyPage(() => import('./pages/Telemetry'))
const Live = lazyPage(() => import('./pages/Live'))
const Feedback = lazyPage(() => import('./pages/Feedback'))
const About = lazyPage(() => import('./pages/About'))
const Privacy = lazyPage(() => import('./pages/Privacy'))
const Support = lazyPage(() => import('./pages/Support'))
// Its own small chunk, shared with the pages that show it in their place.
const NotFound = lazyPage(() => import('./pages/NotFound'))

// Reports a GA4 page_view whenever the SPA route changes (react-router keeps the
// page mounted, so there's no real document load for GA to catch on its own).
function usePageViews() {
  const location = useLocation()
  useEffect(() => {
    // The full address (router paths leave out the /uk basename).
    trackPageView(window.location.pathname + window.location.search)
  }, [location.pathname, location.search])
}

// /drivers/:slug and /teams/:slug are shared between the season list and an
// individual profile — a 4-digit slug is a season, anything else is an entity id
// (ids are never bare years), so one route dispatches to the right page.
function DriversOrProfile() {
  const { slug } = useParams()
  return isSeason(slug) ? <Drivers /> : <DriverProfile />
}

function TeamsOrProfile() {
  const { slug } = useParams()
  return isSeason(slug) ? <Teams /> : <TeamProfile />
}

// While a page's code loads.
function PageLoading() {
  const { t } = useI18n()
  return (
    <p className="muted" style={{ padding: '2rem' }}>
      {t('common.loading')}
    </p>
  )
}

export default function App() {
  usePageViews()
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="standings" element={<Standings />} />
          <Route path="standings/:season" element={<Standings />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="calendar/:season" element={<Calendar />} />
          <Route path="calendar/:season/:round" element={<RaceWeekend />} />
          <Route path="circuits" element={<Circuits />} />
          <Route path="circuits/:circuitId" element={<CircuitProfile />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:slug" element={<DriversOrProfile />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:slug" element={<TeamsOrProfile />} />
          <Route path="compare" element={<Compare />} />
          <Route path="telemetry" element={<Telemetry />} />
          <Route path="live" element={<Live />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="about" element={<About />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="support" element={<Support />} />
          {/* Anything else: the "not found" page (the server answers 404). */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
