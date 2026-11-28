import { RouterProvider } from 'react-router-dom'
import { AiProvidersProvider } from '../context/AiProvidersContext'
import { DraftsProvider } from '../context/DraftsContext'
import { SocialAccountsProvider } from '../context/SocialAccountsContext'
import { StudioProvider } from '../context/StudioContext'
import { ThemeProvider } from '../context/ThemeContext'
import { VideoLibraryProvider } from '../context/VideoLibraryContext'
import { router } from './router'

/**
 * Root application component providing theme state, video library storage, drafts, social OAuth, multi-provider AI, and routing.
 */
export function App() {
  return (
    <ThemeProvider>
      <AiProvidersProvider>
        <VideoLibraryProvider>
          <DraftsProvider>
            <SocialAccountsProvider>
              <StudioProvider>
                <RouterProvider router={router} />
              </StudioProvider>
            </SocialAccountsProvider>
          </DraftsProvider>
        </VideoLibraryProvider>
      </AiProvidersProvider>
    </ThemeProvider>
  )
}

export default App
