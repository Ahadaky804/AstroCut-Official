import type {
  TranscriptionStage,
  TranscriptionStatus,
} from './transcription.ts'

export type SupportedVideoExtension = 'mp4' | 'mov' | 'webm'

export type VideoTypeFilter = 'all' | SupportedVideoExtension

export type VideoSortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc'

export interface VideoRecord {
  id: string
  title: string
  fileName: string
  fileExtension: SupportedVideoExtension
  mimeType: string
  sizeBytes: number
  durationSeconds?: number
  thumbnailDataUrl?: string
  uploadedAt: string
  updatedAt: string
  status: 'ready'
  transcriptionStatus?: TranscriptionStatus
  transcriptionStage?: TranscriptionStage
  transcriptionError?: string
  lastTranscribedAt?: string
}

export interface VideoUploadProgress {
  fileName: string
  percent: number
  stage: 'validating' | 'processing' | 'saving'
}
