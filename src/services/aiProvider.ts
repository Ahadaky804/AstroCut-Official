import type {
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
} from '../types/studio'

export interface AiGenerationRequest {
  videoId: string
  videoTitle: string
  durationSeconds?: number
  settings: StudioSettings
  platforms: StudioPlatform[]
}

/**
 * Provider boundary for Phase 6 AI model integrations (e.g. Ollama or cloud LLM adapters).
 */
export interface AiContentProvider {
  id: string
  name: string
  isConfigured: boolean
  statusMessage: string
  generate: (request: AiGenerationRequest) => Promise<Partial<StudioDraftContent>>
}

/**
 * Default Phase 5 placeholder provider reporting that no AI model is connected yet.
 */
export const unconfiguredAiProvider: AiContentProvider = {
  id: 'unconfigured',
  name: 'No AI Provider Connected',
  isConfigured: false,
  statusMessage:
    'AI model integration is planned for Phase 6. Edit platform copy manually below in the meantime.',
  async generate() {
    throw new Error(
      'No AI provider is configured yet. AI content generation will be enabled in Phase 6.',
    )
  },
}
