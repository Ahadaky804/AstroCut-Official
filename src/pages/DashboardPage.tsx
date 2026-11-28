import { ArrowRight, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  GettingStartedSection,
  QuickActionsSection,
  RecentActivitySection,
  RecentVideosSection,
  StatCardsGrid,
} from '../components/dashboard'
import { Badge, buttonStyles, PageHeader } from '../components/ui'
import {
  GETTING_STARTED_STEPS,
  INITIAL_DASHBOARD_STATS,
  QUICK_ACTIONS,
  RECENT_ACTIVITY,
  RECENT_VIDEOS,
} from '../config/dashboard'
import { APP_META } from '../config/navigation'

function formatDashboardDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/**
 * AstroCut Phase 3 Dashboard providing workspace overview, statistics, quick actions,
 * recent media/activity states, and onboarding roadmap.
 */
export function DashboardPage() {
  const formattedDate = formatDashboardDate(new Date())

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            {APP_META.phaseLabel}
          </Badge>
        }
        title="Welcome to AstroCut"
        description="Your AI-powered video content workspace."
        actions={
          <>
            <Badge
              variant="neutral"
              icon={<Calendar className="h-3.5 w-3.5" aria-hidden="true" />}
              className="h-9 px-3 text-xs"
            >
              {formattedDate}
            </Badge>
            <Link
              to="/settings"
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              <span>Workspace Settings</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <StatCardsGrid stats={INITIAL_DASHBOARD_STATS} />

      <QuickActionsSection actions={QUICK_ACTIONS} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentVideosSection videos={RECENT_VIDEOS} />
        <RecentActivitySection activities={RECENT_ACTIVITY} />
      </div>

      <GettingStartedSection steps={GETTING_STARTED_STEPS} />
    </div>
  )
}
