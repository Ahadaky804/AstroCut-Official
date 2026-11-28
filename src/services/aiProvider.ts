import type {
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
} from '../types/studio'

export interface AiModelInfo {
  name: string
  sizeBytes?: number
  parameterSize?: string
  quantization?: string
  modifiedAt?: string
}

export type AiErrorCode =
  | 'connection_refused'
  | 'timeout'
  | 'cors_or_network'
  | 'no_models'
  | 'model_unavailable'
  | 'http_error'
  | 'invalid_response'
  | 'empty_output'
  | 'unknown'

export interface AiConnectionCheckResult {
  connected: boolean
  models: AiModelInfo[]
  message: string
  errorCode?: AiErrorCode
}

export interface AiGenerationRequest {
  videoId: string
  videoTitle: string
  fileExtension?: string
  durationSeconds?: number
  sizeBytes?: number
  videoContext?: string
  settings: StudioSettings
  platforms: StudioPlatform[]
  model: string
  signal?: AbortSignal
}

export interface AiGenerationResult {
  content: Partial<StudioDraftContent>
  model: string
  warnings?: string[]
}

/**
 * Extensible AI provider boundary separating Studio UI from concrete local or future engines.
 */
export interface AiContentProvider {
  readonly id: string
  readonly name: string
  readonly baseUrl: string
  testConnection: (signal?: AbortSignal) => Promise<AiConnectionCheckResult>
  listModels: (signal?: AbortSignal) => Promise<AiModelInfo[]>
  checkModelAvailability: (
    modelName: string,
    signal?: AbortSignal,
  ) => Promise<boolean>
  generate: (request: AiGenerationRequest) => Promise<AiGenerationResult>
}
