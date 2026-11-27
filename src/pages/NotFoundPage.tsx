import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'

/**
 * Fallback route view for unmatched application paths.
 */
export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-indigo-400 ring-1 ring-slate-700">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-slate-100">Page not found</h2>
      <p className="mt-2 text-sm text-slate-400">
        The route you requested does not exist in the Phase 1 foundation.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </Card>
  )
}
