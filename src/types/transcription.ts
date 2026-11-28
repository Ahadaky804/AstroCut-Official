import type { SupportedVideoExtension } from './video.ts'

export type TranscriptionStatus =
  | 'not_transcribed'
  | 'waiting'
  | 'processing'
  | 'completed'
  | 'failed'

export type TranscriptionStage =
  | 'waiting'
  | 'preparing_audio'
  | 'loading_model'
  | 'transcribing'
  | 'saving_transcript'
  | 'completed'
  | 'failed'

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium'

export type TranscriptionLanguageCode =
  | 'auto'
  | 'en'
  | 'ur'
  | 'hi'
  | 'ar'
  | 'bn'
  | 'fr'
  | 'de'
  | 'es'
  | 'tr'
  | 'id'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'pt'
  | 'ru'
  | 'pa'
  | 'fa'

export interface TranscriptSegment {
  id: string
  startSeconds: number
  endSeconds: number
  text: string
}

export interface VideoTranscriptRecord {
  videoId: string
  originalText: string
  segments: TranscriptSegment[]
  languageCode: string
  detectedLanguage?: string
  modelSize: WhisperModelSize
  engineName: string
  deviceUsed: string
  fallbackNote?: string
  romanUrduText?: string
  englishTranslationText?: string
  translationProvider?: string
  transcribedAt: string
  updatedAt: string
}

export interface TranscriptionJobResult {
  languageCode: string
  detectedLanguage: string
  modelSize: WhisperModelSize
  engineName: string
  deviceUsed: string
  fallbackNote?: string
  segments: TranscriptSegment[]
  originalText: string
}

export interface TranscriptionJobSnapshot {
  jobId: string
  videoId: string
  fileName: string
  fileExtension: SupportedVideoExtension
  modelSize: WhisperModelSize
  requestedLanguage: TranscriptionLanguageCode
  status: 'waiting' | 'processing' | 'completed' | 'failed'
  stage: TranscriptionStage
  stageMessage: string
  createdAt: string
  updatedAt: string
  error?: string
  result?: TranscriptionJobResult
}

export interface WhisperModelOptionMeta {
  id: WhisperModelSize
  label: string
  approxSizeLabel: string
  ramNote: string
  downloaded: boolean
}

export interface TranscriptionEnvironmentStatus {
  ffmpegAvailable: boolean
  ffmpegVersion?: string
  ffmpegPath?: string
  ffmpegError?: string
  pythonAvailable: boolean
  pythonCommand?: string
  whisperEngine: 'faster-whisper' | 'openai-whisper' | 'custom' | 'none'
  whisperReady: boolean
  whisperError?: string
  gpuDetectedName?: string
  gpuCompatible: boolean
  computeDeviceSummary: string
  cacheDir: string
  models: WhisperModelOptionMeta[]
}

export type TranscriptTransformMode = 'roman_urdu' | 'english_translation'

export interface TranscriptTransformRequest {
  mode: TranscriptTransformMode
  transcriptText: string
  sourceLanguage?: string
  providerId?: string
  model?: string
}

export interface TranscriptTransformResult {
  mode: TranscriptTransformMode
  text: string
  providerId: string
  providerName: string
  model: string
}
