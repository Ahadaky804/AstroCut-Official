import { ArrowRight, Calendar, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLATFORM_LABELS } from '../../config/studio'
import type { ContentDraftRecord, DraftStatus } from '../../types/draft'
import { DRAFT_STATUS_LABELS } from '../../utils/draftFilters'
import { formatUploadDate } from '../../utils/videoFormat'
import { Badge, buttonStyles, Card, EmptyState, type BadgeVariant } from '../ui'

const STATUS_BADGE: Record<DraftStatus, BadgeVariant> = {
  draft: 'neutral',
  ready_for_review: 'warning',
  approved: 'success',
}

interface RecentDraftsSectionProps {
  drafts: ContentDraftRecord[]
  videoTitlesById: Record<string, string>
}

/**
 * Displays recently updated drafts from IndexedDB on the AstroCut Dashboard.
 */
export function RecentDraftsSection({
  drafts,
  videoTitlesById,
}: RecentDraftsSectionProps) {
  return (
    <Card
      title="Recently Updated Drafts"
      subtitle="Latest saved drafts and review progress from IndexedDB."
      headerAction={
        <div className="flex items-center gap-2">
          <Badge variant="neutral">
            {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
          </Badge>
          <Link
            to="/drafts"
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            <span>View all</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      }
    >
      {drafts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          title="No saved drafts yet"
          description="Save or auto-save content in AI Content Studio to manage drafts here."
          action={
            <Link
              to="/studio"
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              <span>Open AI Studio</span>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                to={`/drafts/${encodeURIComponent(draft.id)}`}
                className="flex flex-col justify-between gap-2 rounded-xl border border-edge-subtle bg-elevated p-3 transition-colors hover:border-edge-strong sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-content-primary">
                      {draft.name}
                    </h3>
                    <Badge variant={STATUS_BADGE[draft.status]} dot>
                      {DRAFT_STATUS_LABELS[draft.status]}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-content-secondary">
                    Video: {videoTitlesById[draft.videoId] || 'Unavailable'} ·{' '}
                    {draft.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}
                  </p>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-content-muted">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{formatUploadDate(draft.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
