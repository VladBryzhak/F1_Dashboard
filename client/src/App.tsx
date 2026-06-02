import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Placeholder from './pages/Placeholder'
import Standings from './pages/Standings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Standings />} />
        <Route
          path="calendar"
          element={<Placeholder title="Race Calendar" milestone="M2" />}
        />
        <Route
          path="drivers"
          element={<Placeholder title="Drivers" milestone="M3" />}
        />
        <Route
          path="teams"
          element={<Placeholder title="Teams" milestone="M3" />}
        />
        <Route
          path="telemetry"
          element={<Placeholder title="Telemetry" milestone="M4" />}
        />
      </Route>
    </Routes>
  )
}
