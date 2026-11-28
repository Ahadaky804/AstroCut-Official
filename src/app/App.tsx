import { RouterProvider } from 'react-router-dom'
import { AiProvidersProvider } from '../context/AiProvidersContext'
import { StudioProvider } from '../context/StudioContext'
import { ThemeProvider } from '../context/ThemeContext'
import { VideoLibraryProvider } from '../context/VideoLibraryContext'
import { router } from './router'

/**
 * Root application component providing theme state, video library storage, multi-provider AI, and routing.
 */
export function App() {
  return (
    <ThemeProvider>
      <AiProvidersProvider>
        <VideoLibraryProvider>
          <StudioProvider>
            <RouterProvider router={router} />
          </StudioProvider>
        </VideoLibraryProvider>
      </AiProvidersProvider>
    </ThemeProvider>
  )
}

export default App
