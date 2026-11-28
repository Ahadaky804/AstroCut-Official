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
import { transcriptionClient } from '../services/transcriptionClient'
import { indexedDbVideoStorage } from '../services/videoStorage'
import type {
  TranscriptSegment,
  TranscriptionEnvironmentStatus,
  TranscriptionJobSnapshot,
  TranscriptionLanguageCode,
  VideoTranscriptRecord,
  WhisperModelSize,
} from '../types/transcription'
import type { VideoRecord, VideoUploadProgress } from '../types/video'
import { joinSegmentsText } from '../utils/transcriptExport'
import { extractVideoMetadata, validateVideoFile } from '../utils/videoFormat'

interface VideoLibraryContextValue {
  videos: VideoRecord[]
  transcriptsByVideoId: Record<string, VideoTranscriptRecord>
  activeJobsByVideoId: Record<string, TranscriptionJobSnapshot>
  environment: TranscriptionEnvironmentStatus | null
  isCheckingEnvironment: boolean
  isLoading: boolean
  isUploading: boolean
  uploadProgress: VideoUploadProgress | null
  error: string | null
  clearError: () => void
  uploadFiles: (files: FileList | File[]) => Promise<VideoRecord[]>
  renameVideo: (id: string, title: string) => Promise<void>
  deleteVideo: (id: string) => Promise<void>
  getVideoBlob: (id: string) => Promise<Blob | null>
  refreshVideos: () => Promise<void>
  refreshEnvironment: () => Promise<TranscriptionEnvironmentStatus | null>
  startTranscription: (
    videoId: string,
    modelSize: WhisperModelSize,
    language: TranscriptionLanguageCode,
  ) => Promise<void>
  saveEditedSegments: (
    videoId: string,
    segments: TranscriptSegment[],
  ) => Promise<VideoTranscriptRecord>
  saveTranscriptTranslation: (
    videoId: string,
    patch: {
      romanUrduText?: string
      englishTranslationText?: string
      translationProvider?: string
    },
  ) => Promise<VideoTranscriptRecord>
}

const VideoLibraryContext = createContext<VideoLibraryContextValue | undefined>(
  undefined,
)

function createVideoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function normalizeTranscriptMap(
  list: VideoTranscriptRecord[],
): Record<string, VideoTranscriptRecord> {
  const map: Record<string, VideoTranscriptRecord> = {}
  for (const item of list) {
    map[item.videoId] = item
  }
  return map
}

/**
 * Provides reactive local Video Library & Transcription state synchronized with IndexedDB storage.
 */
export function VideoLibraryProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [transcriptsByVideoId, setTranscriptsByVideoId] = useState<
    Record<string, VideoTranscriptRecord>
  >({})
  const [activeJobsByVideoId, setActiveJobsByVideoId] = useState<
    Record<string, TranscriptionJobSnapshot>
  >({})
  const [environment, setEnvironment] =
    useState<TranscriptionEnvironmentStatus | null>(null)
  const [isCheckingEnvironment, setIsCheckingEnvironment] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] =
    useState<VideoUploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inFlightVideoIdsRef = useRef<Set<string>>(new Set())
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const mountedRef = useRef(true)

  const clearPollTimer = useCallback((videoId: string) => {
    const timer = pollTimersRef.current.get(videoId)
    if (timer) {
      clearTimeout(timer)
      pollTimersRef.current.delete(videoId)
    }
  }, [])

  const applyVideoState = useCallback((updated: VideoRecord) => {
    if (!mountedRef.current) return
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
  }, [])

  const commitJobSnapshot = useCallback(
    async (job: TranscriptionJobSnapshot) => {
      if (!mountedRef.current) return

      setActiveJobsByVideoId((prev) => ({
        ...prev,
        [job.videoId]: job,
      }))

      if (job.status === 'waiting' || job.status === 'processing') {
        const updated = await indexedDbVideoStorage
          .updateTranscriptionState(job.videoId, {
            transcriptionStatus: job.status,
            transcriptionStage: job.stage,
            transcriptionError: undefined,
          })
          .catch(() => null)
        if (updated) applyVideoState(updated)
        return
      }

      clearPollTimer(job.videoId)
      inFlightVideoIdsRef.current.delete(job.videoId)

      if (job.status === 'completed' && job.result) {
        const savingRecord = await indexedDbVideoStorage
          .updateTranscriptionState(job.videoId, {
            transcriptionStatus: 'processing',
            transcriptionStage: 'saving_transcript',
            transcriptionError: undefined,
          })
          .catch(() => null)
        if (savingRecord) applyVideoState(savingRecord)

        const now = new Date().toISOString()
        const existingTranscript = await indexedDbVideoStorage
          .getTranscript(job.videoId)
          .catch(() => null)

        const transcriptRecord: VideoTranscriptRecord = {
          videoId: job.videoId,
          originalText: job.result.originalText,
          segments: job.result.segments,
          languageCode: job.result.languageCode,
          detectedLanguage: job.result.detectedLanguage,
          modelSize: job.result.modelSize,
          engineName: job.result.engineName,
          deviceUsed: job.result.deviceUsed,
          fallbackNote: job.result.fallbackNote,
          // Keep explicit separate AI transforms if re-transcribing, or reset only if user regenerates
          romanUrduText: existingTranscript?.romanUrduText,
          englishTranslationText: existingTranscript?.englishTranslationText,
          translationProvider: existingTranscript?.translationProvider,
          transcribedAt: now,
          updatedAt: now,
        }

        await indexedDbVideoStorage.saveTranscript(transcriptRecord)
        if (mountedRef.current) {
          setTranscriptsByVideoId((prev) => ({
            ...prev,
            [job.videoId]: transcriptRecord,
          }))
        }

        const completedRecord = await indexedDbVideoStorage
          .updateTranscriptionState(job.videoId, {
            transcriptionStatus: 'completed',
            transcriptionStage: 'completed',
            transcriptionError: undefined,
            lastTranscribedAt: now,
          })
          .catch(() => null)
        if (completedRecord) applyVideoState(completedRecord)
        return
      }

      if (job.status === 'failed') {
        const errMsg = job.error || job.stageMessage || 'Transcription failed.'
        const failedRecord = await indexedDbVideoStorage
          .updateTranscriptionState(job.videoId, {
            transcriptionStatus: 'failed',
            transcriptionStage: 'failed',
            transcriptionError: errMsg,
          })
          .catch(() => null)
        if (failedRecord) applyVideoState(failedRecord)
      }
    },
    [applyVideoState, clearPollTimer],
  )

  const schedulePoll = useCallback(
    (jobId: string, videoId: string) => {
      clearPollTimer(videoId)

      const tick = async () => {
        if (!mountedRef.current) return
        try {
          const snapshot = await transcriptionClient.getJob(jobId)
          await commitJobSnapshot(snapshot)

          if (
            mountedRef.current &&
            (snapshot.status === 'waiting' || snapshot.status === 'processing')
          ) {
            const next = setTimeout(() => void tick(), 900)
            pollTimersRef.current.set(videoId, next)
          }
        } catch (err) {
          clearPollTimer(videoId)
          inFlightVideoIdsRef.current.delete(videoId)
          const msg = getErrorMessage(
            err,
            'Lost connection to local transcription server.',
          )
          const failed = await indexedDbVideoStorage
            .updateTranscriptionState(videoId, {
              transcriptionStatus: 'failed',
              transcriptionStage: 'failed',
              transcriptionError: msg,
            })
            .catch(() => null)
          if (failed) applyVideoState(failed)
        }
      }

      const timer = setTimeout(() => void tick(), 700)
      pollTimersRef.current.set(videoId, timer)
    },
    [applyVideoState, clearPollTimer, commitJobSnapshot],
  )

  const refreshEnvironment = useCallback(async () => {
    setIsCheckingEnvironment(true)
    try {
      const envStatus = await transcriptionClient.getEnvironment()
      if (mountedRef.current) setEnvironment(envStatus)
      return envStatus
    } catch {
      return null
    } finally {
      if (mountedRef.current) setIsCheckingEnvironment(false)
    }
  }, [])

  const fetchReconciledSnapshot = useCallback(async () => {
    const [records, transcripts, serverJobs] = await Promise.all([
      indexedDbVideoStorage.list(),
      indexedDbVideoStorage.listTranscripts(),
      transcriptionClient.listJobs().catch(() => [] as TranscriptionJobSnapshot[]),
    ])

    const transcriptMap = normalizeTranscriptMap(transcripts)
    const jobByVideo = new Map<string, TranscriptionJobSnapshot>()
    for (const job of serverJobs) {
      if (!jobByVideo.has(job.videoId)) {
        jobByVideo.set(job.videoId, job)
      }
    }

    const reconciledVideos: VideoRecord[] = []
    const runningJobs: TranscriptionJobSnapshot[] = []

    for (const video of records) {
      const currentStatus =
        video.transcriptionStatus ??
        (transcriptMap[video.id] ? 'completed' : 'not_transcribed')
      const serverJob = jobByVideo.get(video.id)

      if (
        serverJob &&
        (serverJob.status === 'waiting' || serverJob.status === 'processing')
      ) {
        runningJobs.push(serverJob)
        const synced = await indexedDbVideoStorage.updateTranscriptionState(
          video.id,
          {
            transcriptionStatus: serverJob.status,
            transcriptionStage: serverJob.stage,
          },
        )
        reconciledVideos.push(synced)
      } else if (
        (currentStatus === 'waiting' || currentStatus === 'processing') &&
        serverJob?.status === 'completed' &&
        serverJob.result
      ) {
        const now = new Date().toISOString()
        const existingTx = transcriptMap[video.id]
        const savedTx: VideoTranscriptRecord = {
          videoId: video.id,
          originalText: serverJob.result.originalText,
          segments: serverJob.result.segments,
          languageCode: serverJob.result.languageCode,
          detectedLanguage: serverJob.result.detectedLanguage,
          modelSize: serverJob.result.modelSize,
          engineName: serverJob.result.engineName,
          deviceUsed: serverJob.result.deviceUsed,
          fallbackNote: serverJob.result.fallbackNote,
          romanUrduText: existingTx?.romanUrduText,
          englishTranslationText: existingTx?.englishTranslationText,
          translationProvider: existingTx?.translationProvider,
          transcribedAt: now,
          updatedAt: now,
        }
        await indexedDbVideoStorage.saveTranscript(savedTx)
        transcriptMap[video.id] = savedTx
        const done = await indexedDbVideoStorage.updateTranscriptionState(
          video.id,
          {
            transcriptionStatus: 'completed',
            transcriptionStage: 'completed',
            transcriptionError: undefined,
            lastTranscribedAt: now,
          },
        )
        reconciledVideos.push(done)
      } else if (
        currentStatus === 'waiting' ||
        currentStatus === 'processing'
      ) {
        const interrupted =
          await indexedDbVideoStorage.updateTranscriptionState(video.id, {
            transcriptionStatus: 'failed',
            transcriptionStage: 'failed',
            transcriptionError:
              'Transcription was interrupted before completion. Click Retry to run again.',
          })
        reconciledVideos.push(interrupted)
      } else if (!video.transcriptionStatus) {
        reconciledVideos.push({
          ...video,
          transcriptionStatus: transcriptMap[video.id]
            ? 'completed'
            : 'not_transcribed',
        })
      } else {
        reconciledVideos.push(video)
      }
    }

    return { reconciledVideos, transcriptMap, runningJobs }
  }, [])

  const applyInitialSnapshot = useCallback(
    (snapshot: {
      reconciledVideos: VideoRecord[]
      transcriptMap: Record<string, VideoTranscriptRecord>
      runningJobs: TranscriptionJobSnapshot[]
    }) => {
      if (!mountedRef.current) return
      for (const job of snapshot.runningJobs) {
        inFlightVideoIdsRef.current.add(job.videoId)
        setActiveJobsByVideoId((prev) => ({ ...prev, [job.videoId]: job }))
        schedulePoll(job.jobId, job.videoId)
      }
      setVideos(snapshot.reconciledVideos)
      setTranscriptsByVideoId(snapshot.transcriptMap)
      setError(null)
    },
    [schedulePoll],
  )

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const snapshot = await fetchReconciledSnapshot()
      applyInitialSnapshot(snapshot)
    } catch (err) {
      if (!mountedRef.current) return
      setError(
        getErrorMessage(
          err,
          'Failed to load videos from local IndexedDB storage.',
        ),
      )
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [applyInitialSnapshot, fetchReconciledSnapshot])

  useEffect(() => {
    mountedRef.current = true
    const timers = pollTimersRef.current

    void fetchReconciledSnapshot()
      .then((snapshot) => {
        applyInitialSnapshot(snapshot)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        setError(
          getErrorMessage(
            err,
            'Failed to load videos from local IndexedDB storage.',
          ),
        )
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false)
      })

    void transcriptionClient
      .getEnvironment()
      .then((envStatus) => {
        if (mountedRef.current) setEnvironment(envStatus)
      })
      .catch(() => undefined)

    return () => {
      mountedRef.current = false
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [applyInitialSnapshot, fetchReconciledSnapshot])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const uploadFiles = useCallback(
    async (input: FileList | File[]): Promise<VideoRecord[]> => {
      const fileList = Array.from(input)
      if (fileList.length === 0) return []

      setIsUploading(true)
      setError(null)
      const savedRecords: VideoRecord[] = []
      const errors: string[] = []

      try {
        for (const file of fileList) {
          try {
            setUploadProgress({
              fileName: file.name,
              percent: 20,
              stage: 'validating',
            })
            const validated = validateVideoFile(file)

            setUploadProgress({
              fileName: file.name,
              percent: 55,
              stage: 'processing',
            })
            const metadata = await extractVideoMetadata(file)

            setUploadProgress({
              fileName: file.name,
              percent: 85,
              stage: 'saving',
            })
            const now = new Date().toISOString()
            const record: VideoRecord = {
              id: createVideoId(),
              title: validated.defaultTitle,
              fileName: file.name,
              fileExtension: validated.extension,
              mimeType: validated.mimeType,
              sizeBytes: file.size,
              durationSeconds: metadata.durationSeconds,
              thumbnailDataUrl: metadata.thumbnailDataUrl,
              uploadedAt: now,
              updatedAt: now,
              status: 'ready',
              transcriptionStatus: 'not_transcribed',
            }

            await indexedDbVideoStorage.save(record, file)
            savedRecords.push(record)
            setUploadProgress({
              fileName: file.name,
              percent: 100,
              stage: 'saving',
            })
          } catch (err) {
            errors.push(
              getErrorMessage(err, `Failed to save "${file.name}".`),
            )
          }
        }

        if (savedRecords.length > 0) {
          setVideos((prev) => [...savedRecords.reverse(), ...prev])
        }

        if (errors.length > 0) {
          setError(errors.join(' '))
        }

        return savedRecords
      } finally {
        setIsUploading(false)
        setUploadProgress(null)
      }
    },
    [],
  )

  const renameVideo = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('Video title cannot be empty.')
    }
    try {
      const updated = await indexedDbVideoStorage.rename(id, trimmed)
      setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)))
      setError(null)
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to rename video.')
      setError(message)
      throw new Error(message, { cause: err })
    }
  }, [])

  const deleteVideo = useCallback(
    async (id: string) => {
      try {
        clearPollTimer(id)
        inFlightVideoIdsRef.current.delete(id)
        await Promise.all([
          indexedDbVideoStorage.remove(id),
          transcriptionClient.deleteVideoJobs(id).catch(() => undefined),
        ])
        setVideos((prev) => prev.filter((v) => v.id !== id))
        setTranscriptsByVideoId((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setActiveJobsByVideoId((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setError(null)
      } catch (err) {
        const message = getErrorMessage(err, 'Failed to delete video.')
        setError(message)
        throw new Error(message, { cause: err })
      }
    },
    [clearPollTimer],
  )

  const getVideoBlob = useCallback(async (id: string) => {
    try {
      return await indexedDbVideoStorage.getBlob(id)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load video file for playback.'))
      return null
    }
  }, [])

  const startTranscription = useCallback(
    async (
      videoId: string,
      modelSize: WhisperModelSize,
      language: TranscriptionLanguageCode,
    ) => {
      const targetVideo = videos.find((v) => v.id === videoId)
      if (!targetVideo) {
        throw new Error('Selected video was not found in Video Library.')
      }

      if (
        inFlightVideoIdsRef.current.has(videoId) ||
        targetVideo.transcriptionStatus === 'waiting' ||
        targetVideo.transcriptionStatus === 'processing'
      ) {
        throw new Error(
          'Transcription is already in progress for this video.',
        )
      }

      inFlightVideoIdsRef.current.add(videoId)
      setError(null)

      try {
        const waitingState =
          await indexedDbVideoStorage.updateTranscriptionState(videoId, {
            transcriptionStatus: 'waiting',
            transcriptionStage: 'waiting',
            transcriptionError: undefined,
          })
        applyVideoState(waitingState)

        const blob = await indexedDbVideoStorage.getBlob(videoId)
        if (!blob) {
          throw new Error(
            'The video file could not be read from IndexedDB storage.',
          )
        }

        const job = await transcriptionClient.startTranscription({
          videoId,
          fileName: targetVideo.fileName,
          blob,
          modelSize,
          language,
        })

        await commitJobSnapshot(job)
        if (job.status === 'waiting' || job.status === 'processing') {
          schedulePoll(job.jobId, videoId)
        }
      } catch (err) {
        inFlightVideoIdsRef.current.delete(videoId)
        const msg = getErrorMessage(
          err,
          'Unable to start local video transcription.',
        )
        const failedState = await indexedDbVideoStorage
          .updateTranscriptionState(videoId, {
            transcriptionStatus: 'failed',
            transcriptionStage: 'failed',
            transcriptionError: msg,
          })
          .catch(() => null)
        if (failedState) applyVideoState(failedState)
        throw new Error(msg, { cause: err })
      }
    },
    [applyVideoState, commitJobSnapshot, schedulePoll, videos],
  )

  const saveEditedSegments = useCallback(
    async (
      videoId: string,
      segments: TranscriptSegment[],
    ): Promise<VideoTranscriptRecord> => {
      const existing =
        transcriptsByVideoId[videoId] ??
        (await indexedDbVideoStorage.getTranscript(videoId))
      if (!existing) {
        throw new Error('No saved transcript found for this video.')
      }

      const cleanedSegments = segments.map((seg, idx) => ({
        id: seg.id || `seg-${idx + 1}`,
        startSeconds: seg.startSeconds,
        endSeconds: seg.endSeconds,
        text: seg.text.trim(),
      }))

      const updated: VideoTranscriptRecord = {
        ...existing,
        segments: cleanedSegments,
        originalText: joinSegmentsText(cleanedSegments),
        updatedAt: new Date().toISOString(),
      }

      await indexedDbVideoStorage.saveTranscript(updated)
      setTranscriptsByVideoId((prev) => ({
        ...prev,
        [videoId]: updated,
      }))
      return updated
    },
    [transcriptsByVideoId],
  )

  const saveTranscriptTranslation = useCallback(
    async (
      videoId: string,
      patch: {
        romanUrduText?: string
        englishTranslationText?: string
        translationProvider?: string
      },
    ): Promise<VideoTranscriptRecord> => {
      const existing =
        transcriptsByVideoId[videoId] ??
        (await indexedDbVideoStorage.getTranscript(videoId))
      if (!existing) {
        throw new Error('Transcribe this video before saving translations.')
      }

      const updated: VideoTranscriptRecord = {
        ...existing,
        romanUrduText: patch.romanUrduText ?? existing.romanUrduText,
        englishTranslationText:
          patch.englishTranslationText ?? existing.englishTranslationText,
        translationProvider:
          patch.translationProvider ?? existing.translationProvider,
        updatedAt: new Date().toISOString(),
      }

      await indexedDbVideoStorage.saveTranscript(updated)
      setTranscriptsByVideoId((prev) => ({
        ...prev,
        [videoId]: updated,
      }))
      return updated
    },
    [transcriptsByVideoId],
  )

  const value = useMemo<VideoLibraryContextValue>(
    () => ({
      videos,
      transcriptsByVideoId,
      activeJobsByVideoId,
      environment,
      isCheckingEnvironment,
      isLoading,
      isUploading,
      uploadProgress,
      error,
      clearError,
      uploadFiles,
      renameVideo,
      deleteVideo,
      getVideoBlob,
      refreshVideos: loadAll,
      refreshEnvironment,
      startTranscription,
      saveEditedSegments,
      saveTranscriptTranslation,
    }),
    [
      videos,
      transcriptsByVideoId,
      activeJobsByVideoId,
      environment,
      isCheckingEnvironment,
      isLoading,
      isUploading,
      uploadProgress,
      error,
      clearError,
      uploadFiles,
      renameVideo,
      deleteVideo,
      getVideoBlob,
      loadAll,
      refreshEnvironment,
      startTranscription,
      saveEditedSegments,
      saveTranscriptTranslation,
    ],
  )

  return (
    <VideoLibraryContext.Provider value={value}>
      {children}
    </VideoLibraryContext.Provider>
  )
}

/**
 * Accesses the shared AstroCut Video Library & Transcription state and IndexedDB actions.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useVideoLibrary(): VideoLibraryContextValue {
  const context = useContext(VideoLibraryContext)
  if (!context) {
    throw new Error('useVideoLibrary must be used within a VideoLibraryProvider')
  }
  return context
}
