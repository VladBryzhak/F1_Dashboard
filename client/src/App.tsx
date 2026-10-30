import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
// The landing page ships in the main bundle: no extra chunk round trip before
// the first (and largest) paint.
import Home from './pages/Home'
import { isSeason } from './hooks/useSeasonRoute'
import { trackPageView } from './lib/analytics'

// Route-level code splitting: each page becomes its own chunk, so the initial
// load no longer ships every page (and heavy deps like recharts) up front. A
// failed dynamic import almost always means a stale chunk after a redeploy —
// reload once to pick up the new hashes instead of surfacing an error.
function lazyPage<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
) {
  return lazy(() =>
    factory().catch((err) => {
      if (!sessionStorage.getItem('chunkReloaded')) {
        sessionStorage.setItem('chunkReloaded', '1')
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

export default function App() {
  usePageViews()
  // Clear the stale-chunk reload guard once the app has mounted successfully, so
  // a later deploy can trigger its own one-time reload.
  useEffect(() => {
    sessionStorage.removeItem('chunkReloaded')
  }, [])

  return (
    <Suspense
      fallback={
        <p className="muted" style={{ padding: '2rem' }}>
          Loading…
        </p>
      }
    >
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
