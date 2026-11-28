import {
  Calendar,
  Copy,
  Film,
  Pencil,
  PenLine,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLATFORM_META } from '../../config/studio'
import type { ContentDraftRecord, DraftStatus } from '../../types/draft'
import { DRAFT_STATUS_LABELS } from '../../utils/draftFilters'
import { formatUploadDate } from '../../utils/videoFormat'
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  Tooltip,
  type BadgeVariant,
} from '../ui'

const DRAFT_STATUS_BADGE: Record<DraftStatus, BadgeVariant> = {
  draft: 'neutral',
  ready_for_review: 'warning',
  approved: 'success',
}

interface DraftCardProps {
  draft: ContentDraftRecord
  videoTitle?: string
  onRename: (draft: ContentDraftRecord) => void
  onDuplicate: (draft: ContentDraftRecord) => void
  onDelete: (draft: ContentDraftRecord) => void
}

/**
 * Displays a saved content draft with status, associated video, platforms, timestamps, and actions.
 */
export function DraftCard({
  draft,
  videoTitle,
  onRename,
  onDuplicate,
  onDelete,
}: DraftCardProps) {
  const previewSnippet =
    draft.content.youtube.title.trim() ||
    draft.content.instagram.caption.trim() ||
    draft.content.tiktok.caption.trim() ||
    'No platform copy added yet.'

  return (
    <Card padding="md" variant="interactive" className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              title={draft.name}
              className="line-clamp-1 text-sm font-semibold text-content-primary"
            >
              {draft.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-content-secondary">
              <Film className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
              <span className="truncate">
                {videoTitle || 'Original video unavailable'}
              </span>
            </p>
          </div>

          <Badge variant={DRAFT_STATUS_BADGE[draft.status]} dot>
            {DRAFT_STATUS_LABELS[draft.status]}
          </Badge>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-content-secondary">
          {previewSnippet}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {draft.platforms.map((platform) => {
            const meta = PLATFORM_META[platform]
            const Icon = meta.icon
            return (
              <Badge
                key={platform}
                variant={meta.badgeVariant}
                icon={<Icon className="h-3 w-3" aria-hidden="true" />}
              >
                {meta.label}
              </Badge>
            )
          })}
          <Badge variant="outline" className="capitalize">
            {draft.language} · {draft.tone}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-content-muted">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            <span>Created {formatUploadDate(draft.createdAt)}</span>
          </span>
          <span>Updated {formatUploadDate(draft.updatedAt)}</span>
          {draft.generationMeta && (
            <span className="truncate">
              AI: {draft.generationMeta.providerName} · {draft.generationMeta.model}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge-subtle pt-3">
        <Link
          to={`/drafts/${encodeURIComponent(draft.id)}`}
          className={buttonStyles({ variant: 'secondary', size: 'sm' })}
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Edit Draft</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Tooltip content="Duplicate draft">
            <Button
              variant="outline"
              size="icon"
              aria-label={`Duplicate ${draft.name}`}
              onClick={() => onDuplicate(draft)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>

          <Tooltip content="Rename draft">
            <Button
              variant="outline"
              size="icon"
              aria-label={`Rename ${draft.name}`}
              onClick={() => onRename(draft)}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>

          <Tooltip content="Delete draft">
            <Button
              variant="danger"
              size="icon"
              aria-label={`Delete ${draft.name}`}
              onClick={() => onDelete(draft)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </Card>
  )
}
