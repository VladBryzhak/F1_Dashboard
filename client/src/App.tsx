import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
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

// Reports a GA4 page_view whenever the SPA route changes (react-router keeps the
// page mounted, so there's no real document load for GA to catch on its own).
function usePageViews() {
  const location = useLocation()
  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])
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
        <Route path="calendar/:season/:round" element={<RaceWeekend />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="drivers/:driverId" element={<DriverProfile />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:constructorId" element={<TeamProfile />} />
        <Route path="compare" element={<Compare />} />
        <Route path="telemetry" element={<Telemetry />} />
      </Route>
    </Routes>
  )
}
