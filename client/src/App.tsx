import { useEffect } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import Calendar from './pages/Calendar'
import Compare from './pages/Compare'
import DriverProfile from './pages/DriverProfile'
import Drivers from './pages/Drivers'
import Home from './pages/Home'
import RaceWeekend from './pages/RaceWeekend'
import Standings from './pages/Standings'
import TeamProfile from './pages/TeamProfile'
import Teams from './pages/Teams'
import Telemetry from './pages/Telemetry'
import { trackPageView } from './lib/analytics'
import { isSeason } from './hooks/useSeasonRoute'

// Reports a GA4 page_view whenever the SPA route changes (react-router keeps the
// page mounted, so there's no real document load for GA to catch on its own).
function usePageViews() {
  const location = useLocation()
  useEffect(() => {
    trackPageView(location.pathname + location.search)
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
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="standings" element={<Standings />} />
        <Route path="standings/:season" element={<Standings />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="calendar/:season" element={<Calendar />} />
        <Route path="calendar/:season/:round" element={<RaceWeekend />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="drivers/:slug" element={<DriversOrProfile />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:slug" element={<TeamsOrProfile />} />
        <Route path="compare" element={<Compare />} />
        <Route path="telemetry" element={<Telemetry />} />
      </Route>
    </Routes>
  )
}
