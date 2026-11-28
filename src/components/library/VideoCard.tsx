import {
  Calendar,
  Clock,
  Film,
  HardDrive,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react'
import type { VideoRecord } from '../../types/video'
import {
  formatDuration,
  formatFileSize,
  formatUploadDate,
} from '../../utils/videoFormat'
import { Badge, Button, Card, Tooltip } from '../ui'

interface VideoCardProps {
  video: VideoRecord
  onPreview: (video: VideoRecord) => void
  onRename: (video: VideoRecord) => void
  onDelete: (video: VideoRecord) => void
}

/**
 * Displays a stored video asset with thumbnail preview, metadata, status badge, and actions.
 */
export function VideoCard({
  video,
  onPreview,
  onRename,
  onDelete,
}: VideoCardProps) {
  const formattedDuration = formatDuration(video.durationSeconds)
  const formattedSize = formatFileSize(video.sizeBytes)
  const formattedDate = formatUploadDate(video.uploadedAt)

  return (
    <Card padding="none" variant="interactive" className="flex flex-col overflow-hidden">
      <div className="group relative aspect-video w-full overflow-hidden border-b border-edge-subtle bg-elevated">
        {video.thumbnailDataUrl ? (
          <img
            src={video.thumbnailDataUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-content-muted">
            <Film className="h-8 w-8" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-wider">
              {video.fileExtension}
            </span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5">
          <Badge variant="outline" className="bg-sidebar/85 backdrop-blur-xs uppercase">
            {video.fileExtension}
          </Badge>
        </div>

        {formattedDuration && (
          <div className="absolute right-2.5 bottom-2.5 rounded-md bg-sidebar/90 px-2 py-0.5 text-[11px] font-medium text-content-primary backdrop-blur-xs tabular-nums">
            {formattedDuration}
          </div>
        )}

        <button
          type="button"
          onClick={() => onPreview(video)}
          aria-label={`Play preview for ${video.title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent shadow-md">
            <Play className="ml-0.5 h-5 w-5" aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3
              title={video.title}
              className="line-clamp-1 text-sm font-semibold text-content-primary"
            >
              {video.title}
            </h3>
            <Badge variant="success" dot>
              Ready
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-content-secondary">
            <span className="inline-flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
              <span>{formattedSize}</span>
            </span>

            {formattedDuration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
                <span>{formattedDuration}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
              <span>{formattedDate}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-edge-subtle pt-3">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => onPreview(video)}
          >
            Preview
          </Button>

          <div className="flex items-center gap-1.5">
            <Tooltip content="Rename video">
              <Button
                variant="outline"
                size="icon"
                aria-label={`Rename ${video.title}`}
                onClick={() => onRename(video)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>

            <Tooltip content="Delete video">
              <Button
                variant="danger"
                size="icon"
                aria-label={`Delete ${video.title}`}
                onClick={() => onDelete(video)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  )
}
