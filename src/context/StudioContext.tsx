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
import { aiClient } from '../services/aiClient'
import { cloneDraftContent, createDraftId } from '../services/draftStorage'
import type {
  AiGenerationResult,
  AiTaskType,
  ProviderId,
} from '../types/ai'
import type {
  ContentDraftRecord,
  DraftGenerationMetadata,
  DraftStatus,
} from '../types/draft'
import type {
  InstagramContent,
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
  StudioSubTab,
  TikTokContent,
  YouTubeContent,
} from '../types/studio'
import { exportTranscriptToSrt } from '../utils/transcriptExport'
import { useAiProviders } from './AiProvidersContext'
import { useDrafts } from './DraftsContext'
import { useVideoLibrary } from './VideoLibraryContext'

const ACTIVE_DRAFT_STORAGE_KEY = 'astrocut.studio.activeDraftId'

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

function readStoredActiveDraftId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(ACTIVE_DRAFT_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredActiveDraftId(draftId: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (draftId) {
      localStorage.setItem(ACTIVE_DRAFT_STORAGE_KEY, draftId)
    } else {
      localStorage.removeItem(ACTIVE_DRAFT_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors for lightweight ID pointer
  }
}

function hasContentText(content: StudioDraftContent): boolean {
  return Boolean(
    content.youtube.title.trim() ||
      content.youtube.description.trim() ||
      content.youtube.keywords.trim() ||
      content.youtube.hashtags.trim() ||
      content.instagram.caption.trim() ||
      content.instagram.hashtags.trim() ||
      content.tiktok.caption.trim() ||
      content.tiktok.hashtags.trim(),
  )
}

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
  activeDraftId: string | null
  draftName: string
  setDraftName: (name: string) => void
  draftStatus: DraftStatus
  setDraftStatus: (status: DraftStatus) => void
  saveStatus: DraftSaveStatus
  saveError: string | null
  lastSavedAt: string | null
  saveDraftNow: () => Promise<ContentDraftRecord | null>
  loadDraftById: (draftId: string) => boolean
  startNewDraft: () => void
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined)

/**
 * Holds AI Content Studio workspace state, runs AI generation grounded in transcripts,
 * and persists/auto-saves drafts in IndexedDB via DraftsContext.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const { videos, transcriptsByVideoId } = useVideoLibrary()
  const { providers, routing, refreshSnapshot } = useAiProviders()
  const { drafts, isLoading: isLoadingDrafts, saveDraft } = useDrafts()

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

  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [draftName, setDraftNameState] = useState<string>('')
  const [draftStatus, setDraftStatusState] = useState<DraftStatus>('draft')
  const [generationMeta, setGenerationMeta] =
    useState<DraftGenerationMetadata | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [dirtyCounter, setDirtyCounter] = useState(0)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationResult, setGenerationResult] =
    useState<AiGenerationResult | null>(null)
  const [generatedCount, setGeneratedCount] = useState(0)

  const isGeneratingRef = useRef(false)
  const activeDraftIdRef = useRef<string | null>(null)
  const createdAtRef = useRef<string | null>(null)
  const saveChainRef = useRef<Promise<ContentDraftRecord | null>>(
    Promise.resolve(null),
  )
  const initialRestoreAttemptedRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedVideoId = useMemo(() => {
    if (explicitVideoId && videos.some((v) => v.id === explicitVideoId)) {
      return explicitVideoId
    }
    return videos[0]?.id ?? ''
  }, [explicitVideoId, videos])

  const selectedVideo = useMemo(
    () => videos.find((v) => v.id === selectedVideoId),
    [videos, selectedVideoId],
  )

  const selectedTranscript = selectedVideoId
    ? (transcriptsByVideoId[selectedVideoId] ?? null)
    : null
  const hasTranscript = Boolean(selectedTranscript?.originalText.trim())

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

  const hydrateDraftRecord = useCallback((record: ContentDraftRecord) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    activeDraftIdRef.current = record.id
    createdAtRef.current = record.createdAt
    setActiveDraftId(record.id)
    writeStoredActiveDraftId(record.id)
    setExplicitVideoId(record.videoId)
    setDraftNameState(record.name)
    setDraftStatusState(record.status)
    setSettings({
      language: record.language,
      platformSelection: record.platformSelection,
      tone: record.tone,
    })
    setContent(cloneDraftContent(record.content))
    setGenerationMeta(record.generationMeta)
    setSaveStatus('saved')
    setSaveError(null)
    setLastSavedAt(record.updatedAt)
  }, [])

  // Restore last active saved draft cleanly after initial IndexedDB load (browser refresh recovery)
  useEffect(() => {
    if (isLoadingDrafts || initialRestoreAttemptedRef.current) return
    initialRestoreAttemptedRef.current = true

    const storedId = readStoredActiveDraftId()
    if (!storedId) return
    const found = drafts.find((d) => d.id === storedId)
    if (!found) {
      writeStoredActiveDraftId(null)
      return
    }

    queueMicrotask(() => {
      hydrateDraftRecord(found)
    })
  }, [drafts, isLoadingDrafts, hydrateDraftRecord])

  const loadDraftById = useCallback(
    (draftId: string): boolean => {
      const found = drafts.find((d) => d.id === draftId)
      if (!found) return false
      hydrateDraftRecord(found)
      return true
    },
    [drafts, hydrateDraftRecord],
  )

  const startNewDraft = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    activeDraftIdRef.current = null
    createdAtRef.current = null
    setActiveDraftId(null)
    writeStoredActiveDraftId(null)
    setDraftNameState('')
    setDraftStatusState('draft')
    setGenerationMeta(undefined)
    setContent(createEmptyStudioContent())
    setSaveStatus('idle')
    setSaveError(null)
    setLastSavedAt(null)
  }, [])

  const persistSnapshot = useCallback(
    (overrides?: {
      content?: StudioDraftContent
      settings?: StudioSettings
      draftName?: string
      draftStatus?: DraftStatus
      generationMeta?: DraftGenerationMetadata
      videoId?: string
    }): Promise<ContentDraftRecord | null> => {
      const run = saveChainRef.current.then(async () => {
        const targetVideoId = overrides?.videoId ?? selectedVideoId
        if (!targetVideoId) return null

        const nextContent = overrides?.content ?? content
        const nextSettings = overrides?.settings ?? settings
        const nextPlatforms = getActivePlatforms(nextSettings.platformSelection)
        const targetVideo =
          videos.find((v) => v.id === targetVideoId) ?? selectedVideo
        const targetTranscript = transcriptsByVideoId[targetVideoId]

        const existingId = activeDraftIdRef.current
        const draftId = existingId ?? createDraftId()
        activeDraftIdRef.current = draftId
        const now = new Date().toISOString()
        const createdAt = createdAtRef.current ?? now
        createdAtRef.current = createdAt

        const rawName = (overrides?.draftName ?? draftName).trim()
        const resolvedName =
          rawName ||
          nextContent.youtube.title.trim() ||
          `${targetVideo?.title ?? 'Untitled Video'} — Draft`

        const subtitlesText = targetTranscript
          ? exportTranscriptToSrt(targetTranscript.segments) ||
            targetTranscript.originalText
          : undefined

        const record: ContentDraftRecord = {
          id: draftId,
          videoId: targetVideoId,
          name: resolvedName,
          platformSelection: nextSettings.platformSelection,
          platforms: nextPlatforms,
          language: nextSettings.language,
          tone: nextSettings.tone,
          content: cloneDraftContent(nextContent),
          subtitlesText,
          transcriptLanguage:
            targetTranscript?.detectedLanguage || targetTranscript?.languageCode,
          status: overrides?.draftStatus ?? draftStatus,
          generationMeta: overrides?.generationMeta ?? generationMeta,
          createdAt,
          updatedAt: now,
        }

        setSaveStatus('saving')
        setSaveError(null)

        try {
          const saved = await saveDraft(record)
          setActiveDraftId(saved.id)
          if (!rawName) setDraftNameState(saved.name)
          writeStoredActiveDraftId(saved.id)
          setSaveStatus('saved')
          setSaveError(null)
          setLastSavedAt(saved.updatedAt)
          return saved
        } catch (err) {
          const msg =
            err instanceof Error && err.message
              ? err.message
              : 'Failed to save draft to IndexedDB.'
          if (!existingId) {
            // Keep activeDraftIdRef clean if initial creation failed
            activeDraftIdRef.current = null
            createdAtRef.current = null
          }
          setSaveStatus('failed')
          setSaveError(msg)
          return null
        }
      })

      saveChainRef.current = run.catch(() => null)
      return run
    },
    [
      content,
      draftName,
      draftStatus,
      generationMeta,
      saveDraft,
      selectedVideo,
      selectedVideoId,
      settings,
      transcriptsByVideoId,
      videos,
    ],
  )

  const saveDraftNow = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    return persistSnapshot()
  }, [persistSnapshot])

  // Reliable debounced auto-save for user edits
  useEffect(() => {
    if (dirtyCounter === 0 || !selectedVideoId) return
    if (!activeDraftIdRef.current && !hasContentText(content)) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistSnapshot()
    }, 700)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [dirtyCounter, selectedVideoId, content, persistSnapshot])

  const markDirty = useCallback(() => {
    setDirtyCounter((c) => c + 1)
  }, [])

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

  const setDraftName = useCallback(
    (name: string) => {
      setDraftNameState(name)
      markDirty()
    },
    [markDirty],
  )

  const setDraftStatus = useCallback(
    (status: DraftStatus) => {
      setDraftStatusState(status)
      markDirty()
    },
    [markDirty],
  )

  const updateSettings = useCallback(
    (patch: Partial<StudioSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }))
      markDirty()
    },
    [markDirty],
  )

  const updateYouTube = useCallback(
    (patch: Partial<YouTubeContent>) => {
      setContent((prev) => ({
        ...prev,
        youtube: { ...prev.youtube, ...patch },
      }))
      markDirty()
    },
    [markDirty],
  )

  const updateInstagram = useCallback(
    (patch: Partial<InstagramContent>) => {
      setContent((prev) => ({
        ...prev,
        instagram: { ...prev.instagram, ...patch },
      }))
      markDirty()
    },
    [markDirty],
  )

  const updateTikTok = useCallback(
    (patch: Partial<TikTokContent>) => {
      setContent((prev) => ({
        ...prev,
        tiktok: { ...prev.tiktok, ...patch },
      }))
      markDirty()
    },
    [markDirty],
  )

  const clearPlatformContent = useCallback(
    (platform: StudioPlatform) => {
      const empty = createEmptyStudioContent()
      setContent((prev) => ({
        ...prev,
        [platform]: empty[platform],
      }))
      markDirty()
    },
    [markDirty],
  )

  const clearAllContent = useCallback(() => {
    setContent(createEmptyStudioContent())
    markDirty()
  }, [markDirty])

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

      const mergedContent: StudioDraftContent = {
        youtube: result.content.youtube ?? content.youtube,
        instagram: result.content.instagram ?? content.instagram,
        tiktok: result.content.tiktok ?? content.tiktok,
      }
      setContent(mergedContent)

      const meta: DraftGenerationMetadata = {
        providerId: result.providerId,
        providerName: result.providerName,
        model: result.model,
        modeUsed: result.modeUsed,
        generatedAt: new Date().toISOString(),
      }
      setGenerationMeta(meta)
      setGeneratedCount((prev) => prev + 1)
      setGenerationResult(result)
      void refreshSnapshot()

      await persistSnapshot({
        content: mergedContent,
        generationMeta: meta,
        videoId: video.id,
      })
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
    content,
    persistSnapshot,
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
      activeDraftId,
      draftName,
      setDraftName,
      draftStatus,
      setDraftStatus,
      saveStatus,
      saveError,
      lastSavedAt,
      saveDraftNow,
      loadDraftById,
      startNewDraft,
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
      activeDraftId,
      draftName,
      setDraftName,
      draftStatus,
      setDraftStatus,
      saveStatus,
      saveError,
      lastSavedAt,
      saveDraftNow,
      loadDraftById,
      startNewDraft,
    ],
  )

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  )
}

/**
 * Accesses AI Content Studio workspace state and persistent draft controls.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider')
  }
  return context
}
