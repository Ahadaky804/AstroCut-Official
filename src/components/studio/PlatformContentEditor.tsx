import { RotateCcw } from 'lucide-react'
import { PLATFORM_LIMITS, PLATFORM_META } from '../../config/studio'
import type {
  InstagramContent,
  StudioDraftContent,
  StudioPlatform,
  TikTokContent,
  YouTubeContent,
} from '../../types/studio'
import { Badge, Button, Card, Input, Textarea } from '../ui'
import { CopyButton } from './CopyButton'
import { StudioField } from './StudioField'

function buildCopyBundle(
  platform: StudioPlatform,
  content: StudioDraftContent,
): string {
  if (platform === 'youtube') {
    const yt = content.youtube
    return [
      yt.title && `Title:\n${yt.title}`,
      yt.description && `Description:\n${yt.description}`,
      yt.keywords && `Keywords:\n${yt.keywords}`,
      yt.hashtags && `Hashtags:\n${yt.hashtags}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  const social = content[platform]
  return [social.caption, social.hashtags].filter(Boolean).join('\n\n')
}

export interface PlatformContentEditorProps {
  platforms: StudioPlatform[]
  content: StudioDraftContent
  onUpdateYouTube: (patch: Partial<YouTubeContent>) => void
  onUpdateInstagram: (patch: Partial<InstagramContent>) => void
  onUpdateTikTok: (patch: Partial<TikTokContent>) => void
  onClearPlatform: (platform: StudioPlatform) => void
}

/**
 * Shared reusable multi-platform editor preserving separate content per platform.
 */
export function PlatformContentEditor({
  platforms,
  content,
  onUpdateYouTube,
  onUpdateInstagram,
  onUpdateTikTok,
  onClearPlatform,
}: PlatformContentEditorProps) {
  return (
    <div className="space-y-5">
      {platforms.map((platform) => {
        const copyBundle = buildCopyBundle(platform, content)
        const hasContent = copyBundle.length > 0

        const platformMeta = PLATFORM_META[platform]
        const PlatformIcon = platformMeta.icon

        if (platform === 'youtube') {
          const yt = content.youtube
          return (
            <Card
              key="youtube"
              title="YouTube Content"
              subtitle="Optimize title, description, search keywords, and hashtags."
              headerAction={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={platformMeta.badgeVariant}
                    icon={<PlatformIcon className="h-3 w-3" aria-hidden="true" />}
                  >
                    {platformMeta.label}
                  </Badge>
                  <CopyButton text={copyBundle} label="Copy All" />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasContent}
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => onClearPlatform('youtube')}
                  >
                    Clear
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <StudioField
                  label="Title"
                  value={yt.title}
                  maxLength={PLATFORM_LIMITS.youtubeTitle}
                >
                  <Input
                    aria-label="YouTube Title"
                    value={yt.title}
                    onChange={(e) => onUpdateYouTube({ title: e.target.value })}
                    placeholder="Enter your YouTube video title..."
                  />
                </StudioField>

                <StudioField
                  label="Description"
                  value={yt.description}
                  maxLength={PLATFORM_LIMITS.youtubeDescription}
                >
                  <Textarea
                    aria-label="YouTube Description"
                    rows={5}
                    value={yt.description}
                    onChange={(e) =>
                      onUpdateYouTube({ description: e.target.value })
                    }
                    placeholder="Write a clear video summary, key timestamps, and call to action..."
                  />
                </StudioField>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <StudioField
                    label="Keywords"
                    value={yt.keywords}
                    maxLength={PLATFORM_LIMITS.youtubeKeywords}
                  >
                    <Input
                      aria-label="YouTube Keywords"
                      value={yt.keywords}
                      onChange={(e) =>
                        onUpdateYouTube({ keywords: e.target.value })
                      }
                      placeholder="video editing, tutorial, creator workflow"
                    />
                  </StudioField>

                  <StudioField label="Hashtags" value={yt.hashtags}>
                    <Input
                      aria-label="YouTube Hashtags"
                      value={yt.hashtags}
                      onChange={(e) =>
                        onUpdateYouTube({ hashtags: e.target.value })
                      }
                      placeholder="#AstroCut #VideoEditing #Creator"
                    />
                  </StudioField>
                </div>
              </div>
            </Card>
          )
        }

        const isInstagram = platform === 'instagram'
        const social = isInstagram ? content.instagram : content.tiktok
        const updateSocial = isInstagram ? onUpdateInstagram : onUpdateTikTok
        const captionLimit = isInstagram
          ? PLATFORM_LIMITS.instagramCaption
          : PLATFORM_LIMITS.tiktokCaption

        return (
          <Card
            key={platform}
            title={`${platformMeta.label} Content`}
            subtitle={`Prepare engaging ${platformMeta.label} caption copy and relevant hashtags.`}
            headerAction={
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={platformMeta.badgeVariant}
                  icon={<PlatformIcon className="h-3 w-3" aria-hidden="true" />}
                >
                  {platformMeta.label}
                </Badge>
                <CopyButton text={copyBundle} label="Copy All" />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!hasContent}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => onClearPlatform(platform)}
                >
                  Clear
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <StudioField
                label="Caption"
                value={social.caption}
                maxLength={captionLimit}
              >
                <Textarea
                  aria-label={`${platformMeta.label} Caption`}
                  rows={4}
                  value={social.caption}
                  onChange={(e) => updateSocial({ caption: e.target.value })}
                  placeholder={`Write your ${platformMeta.label} caption here...`}
                />
              </StudioField>

              <StudioField label="Hashtags" value={social.hashtags}>
                <Input
                  aria-label={`${platformMeta.label} Hashtags`}
                  value={social.hashtags}
                  onChange={(e) => updateSocial({ hashtags: e.target.value })}
                  placeholder={
                    isInstagram
                      ? '#reels #contentcreator #astrocut'
                      : '#tiktok #videoediting #creator'
                  }
                />
              </StudioField>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
