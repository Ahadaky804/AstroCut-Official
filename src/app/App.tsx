import { RouterProvider } from 'react-router-dom'
import { AiProvidersProvider } from '../context/AiProvidersContext'
import { DraftsProvider } from '../context/DraftsContext'
import { StudioProvider } from '../context/StudioContext'
import { ThemeProvider } from '../context/ThemeContext'
import { VideoLibraryProvider } from '../context/VideoLibraryContext'
import { router } from './router'

/**
 * Root application component providing theme state, video library storage, drafts, multi-provider AI, and routing.
 */
export function App() {
  return (
    <ThemeProvider>
      <AiProvidersProvider>
        <VideoLibraryProvider>
          <DraftsProvider>
            <StudioProvider>
              <RouterProvider router={router} />
            </StudioProvider>
          </DraftsProvider>
        </VideoLibraryProvider>
      </AiProvidersProvider>
    </ThemeProvider>
  )
}

export default App
