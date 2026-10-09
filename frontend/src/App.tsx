import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import NotFound from '@/pages/NotFound'

// Route-level code splitting: the dashboard ships in the main bundle,
// everything else loads on demand.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    hydrateFallbackElement: null,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'plots', lazy: page(() => import('@/pages/Plots')) },
      { path: 'plots/new', lazy: page(() => import('@/pages/PlotNew')) },
      { path: 'plots/:id', lazy: page(() => import('@/pages/PlotDetail')) },
      { path: 'assess', lazy: page(() => import('@/pages/Assess')) },
      { path: 'observations/:id', lazy: page(() => import('@/pages/ObservationResult')) },
      { path: 'alerts', lazy: page(() => import('@/pages/Alerts')) },
      { path: 'knowledge', lazy: page(() => import('@/pages/Knowledge')) },
      { path: 'model', lazy: page(() => import('@/pages/ModelEval')) },
      { path: 'settings', lazy: page(() => import('@/pages/Settings')) },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
