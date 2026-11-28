import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { VideoLibraryProvider } from '../context/VideoLibraryContext'
import { router } from './router'

/**
 * Root application component providing theme state, video library storage, and client-side routing.
 */
export function App() {
  return (
    <ThemeProvider>
      <VideoLibraryProvider>
        <RouterProvider router={router} />
      </VideoLibraryProvider>
    </ThemeProvider>
  )
}

export default App
