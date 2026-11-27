import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles, EmptyState } from '../components/ui'

/**
 * Fallback route view for unmatched application paths.
 */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-8">
      <EmptyState
        icon={<Compass className="h-5 w-5" aria-hidden="true" />}
        title="Page not found"
        description="The route you requested does not exist in the current AstroCut workspace."
        action={
          <Link to="/" className={buttonStyles({ variant: 'primary' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
        }
      />
    </div>
  )
}
