import type {
  StudioDraftContent,
  StudioPlatform,
  StudioSettings,
} from './studio.ts'

export type BuiltInProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'mistral'
  | 'ollama'

export type ProviderId = BuiltInProviderId | `custom-${string}`

export type ProviderKind = 'local' | 'cloud'

export type ProviderApiFormat =
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'openai-compatible'

export type OperatingMode = 'manual' | 'automatic'

export type AiTaskType =
  | 'titles_descriptions'
  | 'captions_hashtags'
  | 'video_summaries'
  | 'transcript_cleanup'
  | 'translation_roman_urdu'

export type ProviderConnectionStatus =
  | 'connected'
  | 'configured'
  | 'disconnected'
  | 'not_configured'
  | 'error'

export interface ProviderCapabilities {
  kind: ProviderKind
  supportsModelDiscovery: boolean
  supportsStructuredJson: boolean
  supportsStreaming: boolean
  supportsUsageMetrics: boolean
  supportsVideoInput: boolean
  requiresApiKey: boolean
}

export type ModelVerificationStatus = 'verified_text' | 'listed'

export interface AiModelInfo {
  name: string
  displayName?: string
  sizeBytes?: number
  parameterSize?: string
  quantization?: string
  contextWindow?: number
  verificationStatus?: ModelVerificationStatus
  capabilityNote?: string
}

export type AiErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'connection_refused'
  | 'timeout'
  | 'no_models'
  | 'model_unavailable'
  | 'unsupported_capability'
  | 'http_error'
  | 'invalid_response'
  | 'empty_output'
  | 'not_configured'
  | 'unknown'

export interface AiUsageMetrics {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ProviderPublicConfig {
  id: ProviderId
  name: string
  description: string
  apiFormat: ProviderApiFormat
  isCustom: boolean
  enabled: boolean
  baseUrl: string
  defaultModel: string
  hasApiKey: boolean
  maskedApiKey: string | null
  keySource: 'env' | 'config' | 'none'
  envVarName?: string
  capabilities: ProviderCapabilities
  status: ProviderConnectionStatus
  statusMessage: string
  discoveryFailed?: boolean
  discoveredModels: AiModelInfo[]
  lastCheckedAt?: string
  implementationStatus: 'implemented' | 'prepared'
}

export interface TaskRouteConfig {
  providerId: ProviderId | 'default'
  model: string
}

export interface AiRoutingSettings {
  mode: OperatingMode
  defaultProviderId: ProviderId
  defaultModel: string
  fallbackEnabled: boolean
  providerPriority: ProviderId[]
  taskRoutes: Record<AiTaskType, TaskRouteConfig>
}

export interface AiSystemSnapshot {
  providers: ProviderPublicConfig[]
  routing: AiRoutingSettings
}

export interface ProviderUpsertPayload {
  id?: ProviderId
  name?: string
  baseUrl?: string
  apiKey?: string
  clearApiKey?: boolean
  defaultModel?: string
  enabled?: boolean
  apiFormat?: ProviderApiFormat
}

export interface AiConnectionCheckResult {
  providerId: ProviderId
  connected: boolean
  models: AiModelInfo[]
  message: string
  errorCode?: AiErrorCode
}

export interface AiAttemptLog {
  providerId: ProviderId
  providerName: string
  model: string
  success: boolean
  error?: string
}

export interface AiGenerationRequest {
  videoId: string
  videoTitle: string
  fileExtension?: string
  durationSeconds?: number
  sizeBytes?: number
  videoContext?: string
  transcriptText?: string
  transcriptLanguage?: string
  settings: StudioSettings
  platforms: StudioPlatform[]
  taskType?: AiTaskType
  providerId?: ProviderId
  model?: string
  stream?: boolean
}

export interface AiGenerationResult {
  content: Partial<StudioDraftContent>
  providerId: ProviderId
  providerName: string
  providerKind: ProviderKind
  model: string
  modeUsed: OperatingMode
  fallbackUsed: boolean
  attempts: AiAttemptLog[]
  usage?: AiUsageMetrics
  warnings?: string[]
}
