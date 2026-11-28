import { RouterProvider } from 'react-router-dom'
import { StudioProvider } from '../context/StudioContext'
import { ThemeProvider } from '../context/ThemeContext'
import { VideoLibraryProvider } from '../context/VideoLibraryContext'
import { router } from './router'

/**
 * Root application component providing theme state, video library storage, studio state, and routing.
 */
export function App() {
  return (
    <ThemeProvider>
      <VideoLibraryProvider>
        <StudioProvider>
          <RouterProvider router={router} />
        </StudioProvider>
      </VideoLibraryProvider>
    </ThemeProvider>
  )
}

export default App
