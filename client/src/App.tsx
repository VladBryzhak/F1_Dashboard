import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Drivers from './pages/Drivers'
import Placeholder from './pages/Placeholder'
import Standings from './pages/Standings'
import Teams from './pages/Teams'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Standings />} />
        <Route
          path="calendar"
          element={<Placeholder title="Race Calendar" milestone="M2" />}
        />
        <Route path="drivers" element={<Drivers />} />
        <Route path="teams" element={<Teams />} />
        <Route
          path="telemetry"
          element={<Placeholder title="Telemetry" milestone="M4" />}
        />
      </Route>
    </Routes>
  )
}
