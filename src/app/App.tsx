import { RouterProvider } from 'react-router-dom'
import { router } from './router'

/**
 * Root application component providing client-side routing.
 */
export function App() {
  return <RouterProvider router={router} />
}

export default App
