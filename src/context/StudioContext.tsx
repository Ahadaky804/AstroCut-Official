import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createEmptyStudioContent,
  DEFAULT_STUDIO_SETTINGS,
  getActivePlatforms,
} from '../config/studio'
import { aiClient } from '../services/aiClient'
import type {
  AiGenerationResult,
  AiTaskType,
  ProviderId,
} from '../types/ai'
import type {
  InstagramContent,
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
  StudioSubTab,
  TikTokContent,
  YouTubeContent,
} from '../types/studio'
import { useAiProviders } from './AiProvidersContext'
import { useVideoLibrary } from './VideoLibraryContext'

interface StudioContextValue {
  selectedVideoId: string
  setSelectedVideoId: (videoId: string) => void
  videoContext: string
  setVideoContext: (context: string) => void
  settings: StudioSettings
  updateSettings: (patch: Partial<StudioSettings>) => void
  selectedTaskType: AiTaskType | 'auto'
  setSelectedTaskType: (task: AiTaskType | 'auto') => void
  manualProviderId: ProviderId | ''
  setManualProviderId: (id: ProviderId) => void
  manualModel: string
  setManualModel: (model: string) => void
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
  isGenerating: boolean
  generationError: string | null
  generationResult: AiGenerationResult | null
  clearGenerationFeedback: () => void
  generatedCount: number
  hasTranscript: boolean
  canGenerate: boolean
  generateContent: () => Promise<void>
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined)

/**
 * Holds AI Content Studio workspace state and executes generation via the server-side multi-provider router.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const { videos, transcriptsByVideoId } = useVideoLibrary()
  const { providers, routing, refreshSnapshot } = useAiProviders()

  const [explicitVideoId, setExplicitVideoId] = useState<string>('')
  const [videoContext, setVideoContext] = useState<string>('')
  const [settings, setSettings] = useState<StudioSettings>(
    DEFAULT_STUDIO_SETTINGS,
  )
  const [selectedTaskType, setSelectedTaskType] = useState<AiTaskType | 'auto'>(
    'auto',
  )
  const [explicitProviderId, setExplicitProviderId] = useState<ProviderId | ''>(
    '',
  )
  const [explicitModel, setExplicitModel] = useState<string>('')
  const [activeView, setActiveView] = useState<StudioSubTab>('editor')
  const [focusedPlatform, setFocusedPlatform] = useState<
    StudioPlatform | 'all'
  >('all')
  const [content, setContent] = useState<StudioDraftContent>(
    createEmptyStudioContent,
  )

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationResult, setGenerationResult] =
    useState<AiGenerationResult | null>(null)
  const [generatedCount, setGeneratedCount] = useState(0)

  const isGeneratingRef = useRef(false)

  const selectedVideoId = useMemo(() => {
    if (explicitVideoId && videos.some((v) => v.id === explicitVideoId)) {
      return explicitVideoId
    }
    return videos[0]?.id ?? ''
  }, [explicitVideoId, videos])

  const manualProviderId = useMemo<ProviderId | ''>(() => {
    if (explicitProviderId && providers.some((p) => p.id === explicitProviderId)) {
      return explicitProviderId
    }
    return routing?.defaultProviderId ?? providers[0]?.id ?? ''
  }, [explicitProviderId, providers, routing])

  const manualModel = useMemo(() => {
    if (explicitModel) return explicitModel
    const provider = providers.find((p) => p.id === manualProviderId)
    if (routing?.defaultProviderId === manualProviderId && routing?.defaultModel) {
      return routing.defaultModel
    }
    return provider?.defaultModel || provider?.discoveredModels[0]?.name || ''
  }, [explicitModel, providers, manualProviderId, routing])

  const setManualProviderId = useCallback((id: ProviderId) => {
    setExplicitProviderId(id)
    setExplicitModel('')
  }, [])

  const setManualModel = useCallback((model: string) => {
    setExplicitModel(model)
  }, [])

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

  const clearGenerationFeedback = useCallback(() => {
    setGenerationError(null)
    setGenerationResult(null)
  }, [])

  const activePlatforms = useMemo(
    () => getActivePlatforms(settings.platformSelection),
    [settings.platformSelection],
  )

  const hasEligibleProvider = useMemo(() => {
    if (!routing) return false
    if (routing.mode === 'manual') {
      const active = providers.find((p) => p.id === manualProviderId)
      if (!active || !active.enabled) return false
      if (active.capabilities.requiresApiKey && !active.hasApiKey) return false
      if (active.id === 'ollama') {
        return Boolean(manualModel || active.discoveredModels.length > 0)
      }
      return Boolean(manualModel)
    }

    return providers.some((p) => {
      if (!p.enabled) return false
      if (p.capabilities.requiresApiKey && !p.hasApiKey) return false
      if (p.id === 'ollama') {
        return p.status === 'connected' && p.discoveredModels.length > 0
      }
      return Boolean(p.defaultModel || p.discoveredModels.length > 0)
    })
  }, [routing, providers, manualProviderId, manualModel])

  const selectedTranscript = selectedVideoId
    ? (transcriptsByVideoId[selectedVideoId] ?? null)
    : null
  const hasTranscript = Boolean(selectedTranscript?.originalText.trim())

  const canGenerate =
    Boolean(selectedVideoId) &&
    hasTranscript &&
    hasEligibleProvider &&
    !isGenerating

  const generateContent = useCallback(async () => {
    if (isGeneratingRef.current) return

    const video = videos.find((v) => v.id === selectedVideoId)
    if (!video) {
      setGenerationError(
        'Select a video from your Video Library before generating.',
      )
      return
    }

    const transcript = transcriptsByVideoId[video.id]
    if (!transcript?.originalText.trim()) {
      setGenerationError(
        'Please transcribe this video first in Video Transcription so AI Content Studio can generate from actual transcript text.',
      )
      return
    }

    isGeneratingRef.current = true
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationResult(null)

    const routingMode = routing?.mode
    try {
      const result = await aiClient.generate({
        videoId: video.id,
        videoTitle: video.title,
        fileExtension: video.fileExtension,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
        videoContext,
        transcriptText: transcript.originalText,
        transcriptLanguage:
          transcript.detectedLanguage || transcript.languageCode,
        settings,
        platforms: activePlatforms,
        taskType: selectedTaskType === 'auto' ? undefined : selectedTaskType,
        ...(routingMode === 'manual' && manualProviderId
          ? {
              providerId: manualProviderId,
              model: manualModel || undefined,
            }
          : {}),
      })

      setContent((prev) => ({
        youtube: result.content.youtube ?? prev.youtube,
        instagram: result.content.instagram ?? prev.instagram,
        tiktok: result.content.tiktok ?? prev.tiktok,
      }))

      setGeneratedCount((prev) => prev + 1)
      setGenerationResult(result)
      void refreshSnapshot()
    } catch (err) {
      setGenerationError(
        err instanceof Error
          ? err.message
          : 'AI generation failed. Check AI Provider Settings.',
      )
      void refreshSnapshot()
    } finally {
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }, [
    videos,
    transcriptsByVideoId,
    selectedVideoId,
    videoContext,
    settings,
    activePlatforms,
    selectedTaskType,
    routing,
    manualProviderId,
    manualModel,
    refreshSnapshot,
  ])

  const value = useMemo<StudioContextValue>(
    () => ({
      selectedVideoId,
      setSelectedVideoId,
      videoContext,
      setVideoContext,
      settings,
      updateSettings,
      selectedTaskType,
      setSelectedTaskType,
      manualProviderId,
      setManualProviderId,
      manualModel,
      setManualModel,
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
      isGenerating,
      generationError,
      generationResult,
      clearGenerationFeedback,
      generatedCount,
      hasTranscript,
      canGenerate,
      generateContent,
    }),
    [
      selectedVideoId,
      setSelectedVideoId,
      videoContext,
      settings,
      updateSettings,
      selectedTaskType,
      manualProviderId,
      setManualProviderId,
      manualModel,
      setManualModel,
      activeView,
      focusedPlatform,
      content,
      updateYouTube,
      updateInstagram,
      updateTikTok,
      clearPlatformContent,
      clearAllContent,
      activePlatforms,
      isGenerating,
      generationError,
      generationResult,
      clearGenerationFeedback,
      generatedCount,
      hasTranscript,
      canGenerate,
      generateContent,
    ],
  )

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  )
}

/**
 * Accesses AI Content Studio workspace state.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider')
  }
  return context
}
