import { Film } from 'lucide-react'
import { PLATFORM_META } from '../../config/studio'
import type {
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
} from '../../types/studio'
import type { VideoRecord } from '../../types/video'
import { formatDuration } from '../../utils/videoFormat'
import { Badge, Card } from '../ui'

export interface PlatformContentPreviewProps {
  platforms: StudioPlatform[]
  content: StudioDraftContent
  settings: StudioSettings
  video?: VideoRecord
}

/**
 * Shared reusable platform preview component used in AI Studio and Draft Editor.
 */
export function PlatformContentPreview({
  platforms,
  content,
  settings,
  video,
}: PlatformContentPreviewProps) {
  const duration = formatDuration(video?.durationSeconds)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {platforms.map((platform) => {
        const meta = PLATFORM_META[platform]
        const PlatformIcon = meta.icon

        if (platform === 'youtube') {
          const yt = content.youtube
          return (
            <Card
              key="preview-youtube"
              title="YouTube Preview"
              headerAction={
                <Badge
                  variant={meta.badgeVariant}
                  icon={<PlatformIcon className="h-3 w-3" aria-hidden="true" />}
                >
                  {meta.label}
                </Badge>
              }
            >
              <div className="overflow-hidden rounded-xl border border-edge-subtle bg-elevated">
                <div className="relative flex aspect-video items-center justify-center bg-card">
                  {video?.thumbnailDataUrl ? (
                    <img
                      src={video.thumbnailDataUrl}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Film className="h-8 w-8 text-content-muted" aria-hidden="true" />
                  )}
                  {duration && (
                    <span className="absolute right-2.5 bottom-2.5 rounded bg-sidebar/90 px-2 py-0.5 text-[11px] font-medium text-content-primary tabular-nums">
                      {duration}
                    </span>
                  )}
                </div>

                <div className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold text-content-primary">
                    {yt.title.trim() || 'No YouTube title entered yet'}
                  </h3>
                  <p className="text-xs text-content-muted">
                    Tone: {settings.tone} · Language: {settings.language}
                  </p>
                  <p className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-content-secondary">
                    {yt.description.trim() ||
                      'Enter a YouTube description in the editor to preview it here.'}
                  </p>
                  {yt.hashtags.trim() && (
                    <p className="text-xs font-medium text-accent">
                      {yt.hashtags}
                    </p>
                  )}
                  {yt.keywords.trim() && (
                    <p className="border-t border-edge-subtle pt-2 text-[11px] text-content-muted">
                      Keywords: {yt.keywords}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )
        }

        const social =
          platform === 'instagram' ? content.instagram : content.tiktok

        return (
          <Card
            key={`preview-${platform}`}
            title={`${meta.label} Preview`}
            headerAction={
              <Badge
                variant={meta.badgeVariant}
                icon={<PlatformIcon className="h-3 w-3" aria-hidden="true" />}
              >
                {meta.label}
              </Badge>
            }
          >
            <div className="overflow-hidden rounded-xl border border-edge-subtle bg-elevated">
              <div className="relative flex aspect-video items-center justify-center bg-card">
                {video?.thumbnailDataUrl ? (
                  <img
                    src={video.thumbnailDataUrl}
                    alt={video.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Film className="h-8 w-8 text-content-muted" aria-hidden="true" />
                )}
              </div>

              <div className="space-y-2 p-4">
                <p className="text-xs text-content-muted">
                  Tone: {settings.tone} · Language: {settings.language}
                </p>
                <p className="whitespace-pre-line text-xs leading-relaxed text-content-secondary">
                  {social.caption.trim() ||
                    `Enter a ${meta.label} caption in the editor to preview it here.`}
                </p>
                {social.hashtags.trim() && (
                  <p className="text-xs font-medium text-accent">
                    {social.hashtags}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
