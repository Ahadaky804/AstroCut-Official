import { RotateCcw } from 'lucide-react'
import { PLATFORM_LIMITS, PLATFORM_META } from '../../config/studio'
import { useStudio } from '../../context/StudioContext'
import type { StudioPlatform } from '../../types/studio'
import { Badge, Button, Card, Input, Textarea } from '../ui'
import { CopyButton } from './CopyButton'
import { StudioField } from './StudioField'

function buildCopyBundle(
  platform: StudioPlatform,
  content: ReturnType<typeof useStudio>['content'],
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

interface StudioPlatformEditorProps {
  platforms: StudioPlatform[]
}

/**
 * Renders separate editable platform-specific content sections for YouTube, Instagram, and TikTok.
 */
export function StudioPlatformEditor({ platforms }: StudioPlatformEditorProps) {
  const {
    content,
    updateYouTube,
    updateInstagram,
    updateTikTok,
    clearPlatformContent,
  } = useStudio()

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
                    onClick={() => clearPlatformContent('youtube')}
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
                    onChange={(e) => updateYouTube({ title: e.target.value })}
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
                      updateYouTube({ description: e.target.value })
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
                        updateYouTube({ keywords: e.target.value })
                      }
                      placeholder="video editing, tutorial, creator workflow"
                    />
                  </StudioField>

                  <StudioField label="Hashtags" value={yt.hashtags}>
                    <Input
                      aria-label="YouTube Hashtags"
                      value={yt.hashtags}
                      onChange={(e) =>
                        updateYouTube({ hashtags: e.target.value })
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
        const updateSocial = isInstagram ? updateInstagram : updateTikTok
        const captionLimit = isInstagram
          ? PLATFORM_LIMITS.instagramCaption
          : PLATFORM_LIMITS.tiktokCaption

        return (
          <Card
            key={platform}
            title={`${platformMeta.label} Content`}
            subtitle={
              isInstagram
                ? 'Craft a compelling Reels/feed caption and hashtag set.'
                : 'Write a short, punchy hook caption and discovery hashtags.'
            }
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
                  onClick={() => clearPlatformContent(platform)}
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
                  placeholder={`Write your ${platformMeta.label} caption...`}
                />
              </StudioField>

              <StudioField label="Hashtags" value={social.hashtags}>
                <Input
                  aria-label={`${platformMeta.label} Hashtags`}
                  value={social.hashtags}
                  onChange={(e) => updateSocial({ hashtags: e.target.value })}
                  placeholder="#AstroCut #ShortForm #Creator"
                />
              </StudioField>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
