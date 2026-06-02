import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Calendar from './pages/Calendar'
import Drivers from './pages/Drivers'
import Standings from './pages/Standings'
import Teams from './pages/Teams'
import Telemetry from './pages/Telemetry'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Standings />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="teams" element={<Teams />} />
        <Route path="telemetry" element={<Telemetry />} />
      </Route>
    </Routes>
  )
}
