import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createEmptyStudioContent,
  DEFAULT_STUDIO_SETTINGS,
  getActivePlatforms,
} from '../config/studio'
import type {
  InstagramContent,
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
  StudioSubTab,
  TikTokContent,
  YouTubeContent,
} from '../types/studio'
import { useVideoLibrary } from './VideoLibraryContext'

interface StudioContextValue {
  selectedVideoId: string
  setSelectedVideoId: (videoId: string) => void
  settings: StudioSettings
  updateSettings: (patch: Partial<StudioSettings>) => void
  activeView: StudioSubTab
  setActiveView: (view: StudioSubTab) => void
  focusedPlatform: StudioPlatform | 'all'
  setFocusedPlatform: (platform: StudioPlatform | 'all') => void
  content: StudioDraftContent
  updateYouTube: (patch: Partial<YouTubeContent>) => void
  updateInstagram: (patch: Partial<InstagramContent>) => void
  updateTikTok: (patch: Partial<TikTokContent>) => void
  clearPlatformContent: (platform: StudioPlatform) => void
  clearAllContent: () => void
  activePlatforms: StudioPlatform[]
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined)

/**
 * Holds temporary in-session AI Content Studio editing state across navigation within the app.
 * Note: Full persistent Draft Management belongs to Phase 8.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const { videos } = useVideoLibrary()
  const [explicitVideoId, setExplicitVideoId] = useState<string>('')
  const [settings, setSettings] = useState<StudioSettings>(
    DEFAULT_STUDIO_SETTINGS,
  )
  const [activeView, setActiveView] = useState<StudioSubTab>('editor')
  const [focusedPlatform, setFocusedPlatform] = useState<
    StudioPlatform | 'all'
  >('all')
  const [content, setContent] = useState<StudioDraftContent>(
    createEmptyStudioContent,
  )

  const selectedVideoId = useMemo(() => {
    if (explicitVideoId && videos.some((v) => v.id === explicitVideoId)) {
      return explicitVideoId
    }
    return videos[0]?.id ?? ''
  }, [explicitVideoId, videos])

  const setSelectedVideoId = useCallback((videoId: string) => {
    setExplicitVideoId(videoId)
  }, [])

  const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateYouTube = useCallback((patch: Partial<YouTubeContent>) => {
    setContent((prev) => ({
      ...prev,
      youtube: { ...prev.youtube, ...patch },
    }))
  }, [])

  const updateInstagram = useCallback((patch: Partial<InstagramContent>) => {
    setContent((prev) => ({
      ...prev,
      instagram: { ...prev.instagram, ...patch },
    }))
  }, [])

  const updateTikTok = useCallback((patch: Partial<TikTokContent>) => {
    setContent((prev) => ({
      ...prev,
      tiktok: { ...prev.tiktok, ...patch },
    }))
  }, [])

  const clearPlatformContent = useCallback((platform: StudioPlatform) => {
    const empty = createEmptyStudioContent()
    setContent((prev) => ({
      ...prev,
      [platform]: empty[platform],
    }))
  }, [])

  const clearAllContent = useCallback(() => {
    setContent(createEmptyStudioContent())
  }, [])

  const activePlatforms = useMemo(
    () => getActivePlatforms(settings.platformSelection),
    [settings.platformSelection],
  )

  const value = useMemo<StudioContextValue>(
    () => ({
      selectedVideoId,
      setSelectedVideoId,
      settings,
      updateSettings,
      activeView,
      setActiveView,
      focusedPlatform,
      setFocusedPlatform,
      content,
      updateYouTube,
      updateInstagram,
      updateTikTok,
      clearPlatformContent,
      clearAllContent,
      activePlatforms,
    }),
    [
      selectedVideoId,
      setSelectedVideoId,
      settings,
      updateSettings,
      activeView,
      focusedPlatform,
      content,
      updateYouTube,
      updateInstagram,
      updateTikTok,
      clearPlatformContent,
      clearAllContent,
      activePlatforms,
    ],
  )

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  )
}

/**
 * Accesses temporary AI Content Studio workspace state.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider')
  }
  return context
}
