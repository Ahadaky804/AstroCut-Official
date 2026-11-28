import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import type { AiContentProvider, AiModelInfo } from '../services/aiProvider'
import {
  createOllamaProvider,
  DEFAULT_OLLAMA_BASE_URL,
} from '../services/ollamaProvider'
import type {
  AiConnectionStatus,
  InstagramContent,
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
  StudioSubTab,
  TikTokContent,
  YouTubeContent,
} from '../types/studio'
import { useVideoLibrary } from './VideoLibraryContext'

const OLLAMA_URL_STORAGE_KEY = 'astrocut-ollama-url'
const OLLAMA_MODEL_STORAGE_KEY = 'astrocut-ollama-model'

function readStoredValue(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function writeStoredValue(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Ignore restricted storage errors
  }
}

interface StudioContextValue {
  selectedVideoId: string
  setSelectedVideoId: (videoId: string) => void
  videoContext: string
  setVideoContext: (context: string) => void
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
  // AI Engine state & actions
  providerName: string
  ollamaBaseUrl: string
  setOllamaBaseUrl: (url: string) => void
  connectionStatus: AiConnectionStatus
  connectionMessage: string
  installedModels: AiModelInfo[]
  selectedModel: string
  setSelectedModel: (model: string) => void
  isRefreshingModels: boolean
  isGenerating: boolean
  generationError: string | null
  generationSuccess: string | null
  generationWarnings: string[]
  clearGenerationFeedback: () => void
  generatedCount: number
  canGenerate: boolean
  testConnection: () => Promise<void>
  refreshModels: () => Promise<void>
  generateContent: () => Promise<void>
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined)

/**
 * Holds AI Content Studio state, local Ollama provider connection, and generation actions.
 * Note: Full persistent Draft Management belongs to Phase 8.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const { videos } = useVideoLibrary()
  const [explicitVideoId, setExplicitVideoId] = useState<string>('')
  const [videoContext, setVideoContext] = useState<string>('')
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

  const [ollamaBaseUrl, setOllamaBaseUrlState] = useState<string>(() =>
    readStoredValue(OLLAMA_URL_STORAGE_KEY, DEFAULT_OLLAMA_BASE_URL),
  )
  const [connectionStatus, setConnectionStatus] =
    useState<AiConnectionStatus>('checking')
  const [connectionMessage, setConnectionMessage] = useState<string>(
    'Checking local Ollama service...',
  )
  const [installedModels, setInstalledModels] = useState<AiModelInfo[]>([])
  const [preferredModel, setPreferredModel] = useState<string>(() =>
    readStoredValue(OLLAMA_MODEL_STORAGE_KEY, ''),
  )
  const [isRefreshingModels, setIsRefreshingModels] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(
    null,
  )
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([])
  const [generatedCount, setGeneratedCount] = useState(0)

  const isGeneratingRef = useRef(false)

  const provider: AiContentProvider = useMemo(
    () => createOllamaProvider(ollamaBaseUrl),
    [ollamaBaseUrl],
  )

  const selectedVideoId = useMemo(() => {
    if (explicitVideoId && videos.some((v) => v.id === explicitVideoId)) {
      return explicitVideoId
    }
    return videos[0]?.id ?? ''
  }, [explicitVideoId, videos])

  const selectedModel = useMemo(() => {
    if (preferredModel && installedModels.some((m) => m.name === preferredModel)) {
      return preferredModel
    }
    return installedModels[0]?.name ?? ''
  }, [preferredModel, installedModels])

  const applyConnectionResult = useCallback(
    (result: Awaited<ReturnType<AiContentProvider['testConnection']>>) => {
      setInstalledModels(result.models)
      setConnectionMessage(result.message)
      setConnectionStatus(result.connected ? 'connected' : 'disconnected')
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    void provider
      .testConnection(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        applyConnectionResult(result)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setInstalledModels([])
        setConnectionStatus('disconnected')
        setConnectionMessage(
          err instanceof Error
            ? err.message
            : 'Unable to reach local Ollama service.',
        )
      })

    return () => controller.abort()
  }, [provider, applyConnectionResult])

  const setOllamaBaseUrl = useCallback((url: string) => {
    const clean = url.trim() || DEFAULT_OLLAMA_BASE_URL
    setConnectionStatus('checking')
    setConnectionMessage(`Checking Ollama at ${clean}...`)
    setOllamaBaseUrlState(clean)
    writeStoredValue(OLLAMA_URL_STORAGE_KEY, clean)
  }, [])

  const setSelectedModel = useCallback((model: string) => {
    setPreferredModel(model)
    writeStoredValue(OLLAMA_MODEL_STORAGE_KEY, model)
  }, [])

  const testConnection = useCallback(async () => {
    setConnectionStatus('checking')
    setConnectionMessage(`Testing connection to ${provider.baseUrl}...`)
    const result = await provider.testConnection()
    applyConnectionResult(result)
  }, [provider, applyConnectionResult])

  const refreshModels = useCallback(async () => {
    setIsRefreshingModels(true)
    try {
      const result = await provider.testConnection()
      applyConnectionResult(result)
    } finally {
      setIsRefreshingModels(false)
    }
  }, [provider, applyConnectionResult])

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
    setGenerationSuccess(null)
    setGenerationWarnings([])
  }, [])

  const activePlatforms = useMemo(
    () => getActivePlatforms(settings.platformSelection),
    [settings.platformSelection],
  )

  const canGenerate =
    connectionStatus === 'connected' &&
    Boolean(selectedModel) &&
    installedModels.some((m) => m.name === selectedModel) &&
    Boolean(selectedVideoId) &&
    !isGenerating

  const generateContent = useCallback(async () => {
    if (isGeneratingRef.current) return

    const video = videos.find((v) => v.id === selectedVideoId)
    if (!video) {
      setGenerationError('Select a video from your Video Library before generating.')
      return
    }
    if (connectionStatus !== 'connected') {
      setGenerationError(
        'Ollama is currently disconnected. Start Ollama and click Test Connection.',
      )
      return
    }
    if (!selectedModel) {
      setGenerationError(
        'No installed Ollama model is selected. Pull a model and click Refresh Models.',
      )
      return
    }

    isGeneratingRef.current = true
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationSuccess(null)
    setGenerationWarnings([])

    try {
      const result = await provider.generate({
        videoId: video.id,
        videoTitle: video.title,
        fileExtension: video.fileExtension,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
        videoContext,
        settings,
        platforms: activePlatforms,
        model: selectedModel,
      })

      // Update only selected platforms that returned valid content; preserve other user edits
      setContent((prev) => ({
        youtube: result.content.youtube ?? prev.youtube,
        instagram: result.content.instagram ?? prev.instagram,
        tiktok: result.content.tiktok ?? prev.tiktok,
      }))

      setGeneratedCount((prev) => prev + 1)
      setGenerationWarnings(result.warnings ?? [])
      setGenerationSuccess(
        `Generated content using ${result.model} (${activePlatforms.join(', ')}).`,
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to generate content from Ollama.'
      setGenerationError(message)
      if (message.toLowerCase().includes('unable to reach')) {
        setConnectionStatus('disconnected')
        setConnectionMessage(message)
      }
    } finally {
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }, [
    videos,
    selectedVideoId,
    connectionStatus,
    selectedModel,
    provider,
    videoContext,
    settings,
    activePlatforms,
  ])

  const value = useMemo<StudioContextValue>(
    () => ({
      selectedVideoId,
      setSelectedVideoId,
      videoContext,
      setVideoContext,
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
      providerName: provider.name,
      ollamaBaseUrl,
      setOllamaBaseUrl,
      connectionStatus,
      connectionMessage,
      installedModels,
      selectedModel,
      setSelectedModel,
      isRefreshingModels,
      isGenerating,
      generationError,
      generationSuccess,
      generationWarnings,
      clearGenerationFeedback,
      generatedCount,
      canGenerate,
      testConnection,
      refreshModels,
      generateContent,
    }),
    [
      selectedVideoId,
      setSelectedVideoId,
      videoContext,
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
      provider.name,
      ollamaBaseUrl,
      setOllamaBaseUrl,
      connectionStatus,
      connectionMessage,
      installedModels,
      selectedModel,
      setSelectedModel,
      isRefreshingModels,
      isGenerating,
      generationError,
      generationSuccess,
      generationWarnings,
      clearGenerationFeedback,
      generatedCount,
      canGenerate,
      testConnection,
      refreshModels,
      generateContent,
    ],
  )

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  )
}

/**
 * Accesses AI Content Studio workspace state and local Ollama engine controls.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider')
  }
  return context
}
