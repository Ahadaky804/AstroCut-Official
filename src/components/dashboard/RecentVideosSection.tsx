import { Calendar, Clock, Film } from 'lucide-react'
import type { DashboardVideoItem, VideoStatus } from '../../types/dashboard'
import { Badge, Card, EmptyState, type BadgeVariant } from '../ui'

interface RecentVideosSectionProps {
  videos: DashboardVideoItem[]
}

const STATUS_BADGE_MAP: Record<
  VideoStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  processing: { label: 'Processing', variant: 'secondary' },
  ready: { label: 'Ready', variant: 'primary' },
  published: { label: 'Published', variant: 'success' },
}

/**
 * Displays recent workspace videos or an empty state when no videos exist.
 */
export function RecentVideosSection({ videos }: RecentVideosSectionProps) {
  return (
    <Card
      title="Recent Videos"
      subtitle="Latest uploaded video assets and their current status."
      headerAction={
        <Badge variant="neutral">{videos.length} videos</Badge>
      }
    >
      {videos.length === 0 ? (
        <EmptyState
          icon={<Film className="h-5 w-5" aria-hidden="true" />}
          title="No videos yet"
          description="No videos yet. Upload your first video to get started."
        />
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => {
            const statusMeta = STATUS_BADGE_MAP[video.status]
            return (
              <li
                key={video.id}
                className="flex flex-col gap-3 rounded-xl border border-edge-subtle bg-elevated/45 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-edge-subtle bg-card sm:w-28">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Film
                      className="h-5 w-5 text-content-muted"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-medium text-content-primary">
                      {video.title}
                    </h3>
                    <Badge variant={statusMeta.variant}>
                      {statusMeta.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-content-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{video.uploadedAt}</span>
                    </span>
                    {video.duration && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{video.duration}</span>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
