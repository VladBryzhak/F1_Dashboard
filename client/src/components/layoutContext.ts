import { useOutletContext } from 'react-router-dom'

// What the site frame (components/Layout.tsx) hands the pages inside it
// through its <Outlet>: for now, a way to open the header's search.
export interface LayoutContext {
  openSearch: () => void
}

// Undefined outside the frame (a page rendered on its own, e.g. in a test).
export const useLayout = () => useOutletContext<LayoutContext | undefined>()
