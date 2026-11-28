import type { OperatingMode, ProviderId } from './ai.ts'
import type {
  StudioDraftContent,
  StudioLanguage,
  StudioPlatform,
  StudioPlatformSelection,
  StudioTone,
} from './studio.ts'

export type DraftStatus = 'draft' | 'ready_for_review' | 'approved'

export type DraftSortOption =
  | 'updated-desc'
  | 'newest'
  | 'oldest'
  | 'name-asc'

export type DraftPlatformFilter = 'all' | StudioPlatformSelection

export type DraftStatusFilter = 'all' | DraftStatus

export interface DraftGenerationMetadata {
  providerId: ProviderId
  providerName: string
  model: string
  modeUsed?: OperatingMode
  generatedAt: string
}

export interface ContentDraftRecord {
  id: string
  videoId: string
  name: string
  platformSelection: StudioPlatformSelection
  platforms: StudioPlatform[]
  language: StudioLanguage
  tone: StudioTone
  content: StudioDraftContent
  subtitlesText?: string
  transcriptLanguage?: string
  status: DraftStatus
  generationMeta?: DraftGenerationMetadata
  createdAt: string
  updatedAt: string
}
