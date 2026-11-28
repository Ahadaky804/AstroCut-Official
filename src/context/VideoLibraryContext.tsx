import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { indexedDbVideoStorage } from '../services/videoStorage'
import type { VideoRecord, VideoUploadProgress } from '../types/video'
import { extractVideoMetadata, validateVideoFile } from '../utils/videoFormat'

interface VideoLibraryContextValue {
  videos: VideoRecord[]
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

/**
 * Provides reactive local Video Library state synchronized with IndexedDB storage.
 */
export function VideoLibraryProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] =
    useState<VideoUploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshVideos = useCallback(async () => {
    setIsLoading(true)
    try {
      const records = await indexedDbVideoStorage.list()
      setVideos(records)
      setError(null)
    } catch (err) {
      setError(
        getErrorMessage(err, 'Failed to load videos from local IndexedDB storage.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void indexedDbVideoStorage
      .list()
      .then((records) => {
        if (!active) return
        setVideos(records)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(
          getErrorMessage(
            err,
            'Failed to load videos from local IndexedDB storage.',
          ),
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

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

  const deleteVideo = useCallback(async (id: string) => {
    try {
      await indexedDbVideoStorage.remove(id)
      setVideos((prev) => prev.filter((v) => v.id !== id))
      setError(null)
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to delete video.')
      setError(message)
      throw new Error(message, { cause: err })
    }
  }, [])

  const getVideoBlob = useCallback(async (id: string) => {
    try {
      return await indexedDbVideoStorage.getBlob(id)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load video file for playback.'))
      return null
    }
  }, [])

  const value = useMemo<VideoLibraryContextValue>(
    () => ({
      videos,
      isLoading,
      isUploading,
      uploadProgress,
      error,
      clearError,
      uploadFiles,
      renameVideo,
      deleteVideo,
      getVideoBlob,
      refreshVideos,
    }),
    [
      videos,
      isLoading,
      isUploading,
      uploadProgress,
      error,
      clearError,
      uploadFiles,
      renameVideo,
      deleteVideo,
      getVideoBlob,
      refreshVideos,
    ],
  )

  return (
    <VideoLibraryContext.Provider value={value}>
      {children}
    </VideoLibraryContext.Provider>
  )
}

/**
 * Accesses the shared AstroCut Video Library state and IndexedDB actions.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useVideoLibrary(): VideoLibraryContextValue {
  const context = useContext(VideoLibraryContext)
  if (!context) {
    throw new Error('useVideoLibrary must be used within a VideoLibraryProvider')
  }
  return context
}
