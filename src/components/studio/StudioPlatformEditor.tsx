import { useStudio } from '../../context/StudioContext'
import type { StudioPlatform } from '../../types/studio'
import { PlatformContentEditor } from './PlatformContentEditor'

interface StudioPlatformEditorProps {
  platforms: StudioPlatform[]
}

/**
 * Renders separate editable platform-specific content sections connected to StudioContext.
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
    <PlatformContentEditor
      platforms={platforms}
      content={content}
      onUpdateYouTube={updateYouTube}
      onUpdateInstagram={updateInstagram}
      onUpdateTikTok={updateTikTok}
      onClearPlatform={clearPlatformContent}
    />
  )
}
