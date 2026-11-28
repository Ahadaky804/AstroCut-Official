import { useStudio } from '../../context/StudioContext'
import type { StudioPlatform } from '../../types/studio'
import type { VideoRecord } from '../../types/video'
import { PlatformContentPreview } from './PlatformContentPreview'

interface StudioPlatformPreviewProps {
  platforms: StudioPlatform[]
  video?: VideoRecord
}

/**
 * Displays clean platform-specific previews connected to StudioContext.
 */
export function StudioPlatformPreview({
  platforms,
  video,
}: StudioPlatformPreviewProps) {
  const { content, settings } = useStudio()
  return (
    <PlatformContentPreview
      platforms={platforms}
      content={content}
      settings={settings}
      video={video}
    />
  )
}
