import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../pages/DashboardPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ProvidersPage } from '../pages/ProvidersPage'
import { SettingsPage } from '../pages/SettingsPage'
import { StudioPage } from '../pages/StudioPage'
import { VideoLibraryPage } from '../pages/VideoLibraryPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'library',
        element: <VideoLibraryPage />,
      },
      {
        path: 'studio',
        element: <StudioPage />,
      },
      {
        path: 'providers',
        element: <ProvidersPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
