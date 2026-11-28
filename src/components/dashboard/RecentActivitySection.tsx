import {
  Activity,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import type {
  DashboardActivityEventType,
  DashboardActivityItem,
} from '../../types/dashboard'
import { cn } from '../../utils/cn'
import { Badge, Card, EmptyState } from '../ui'

interface RecentActivitySectionProps {
  activities: DashboardActivityItem[]
}

const EVENT_CONFIG: Record<
  DashboardActivityEventType,
  { icon: LucideIcon; toneClass: string }
> = {
  video_uploaded: {
    icon: Upload,
    toneClass: 'border-secondary/25 bg-secondary-soft text-secondary',
  },
  ai_content_generated: {
    icon: Sparkles,
    toneClass: 'border-accent/25 bg-accent-soft text-accent',
  },
  draft_saved: {
    icon: FileText,
    toneClass: 'border-edge-default bg-elevated text-content-secondary',
  },
  video_published: {
    icon: CheckCircle2,
    toneClass: 'border-success/25 bg-success-soft text-success',
  },
}

/**
 * Displays recorded workspace activity events or an informative empty state.
 */
export function RecentActivitySection({
  activities,
}: RecentActivitySectionProps) {
  return (
    <Card
      title="Recent Activity"
      subtitle="Recorded events for uploads, AI generation, drafts, and publishing."
      headerAction={
        <Badge variant="neutral">{activities.length} events</Badge>
      }
    >
      {activities.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
          title="No activity recorded yet"
          description="Workspace activity will appear here once videos are uploaded, AI content is generated, drafts are saved, or videos are published."
        />
      ) : (
        <ul className="space-y-3">
          {activities.map((item) => {
            const eventMeta = EVENT_CONFIG[item.type]
            const Icon = eventMeta.icon
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-edge-subtle bg-elevated/45 p-3.5"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                    eventMeta.toneClass,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-content-primary">
                      {item.title}
                    </p>
                    <span className="text-xs text-content-muted">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                    {item.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
