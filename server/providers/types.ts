import type {
  AiConnectionCheckResult,
  AiErrorCode,
  AiModelInfo,
  AiUsageMetrics,
  ProviderCapabilities,
  ProviderId,
} from '../../src/types/ai.ts'

export interface ServerProviderRuntimeConfig {
  id: ProviderId
  name: string
  baseUrl: string
  apiKey?: string
  defaultModel: string
  capabilities: ProviderCapabilities
  extraHeaders?: Record<string, string>
}

export interface AdapterGenerationInput {
  model: string
  systemPrompt: string
  userPrompt: string
  structuredJson: boolean
  temperature?: number
  signal?: AbortSignal
}

export interface AdapterGenerationOutput {
  rawText: string
  model: string
  usage?: AiUsageMetrics
}

export interface ServerAiAdapter {
  readonly id: ProviderId
  testConnection: (
    config: ServerProviderRuntimeConfig,
    signal?: AbortSignal,
  ) => Promise<AiConnectionCheckResult>
  listModels: (
    config: ServerProviderRuntimeConfig,
    signal?: AbortSignal,
  ) => Promise<AiModelInfo[]>
  generate: (
    config: ServerProviderRuntimeConfig,
    input: AdapterGenerationInput,
  ) => Promise<AdapterGenerationOutput>
}

export class ProviderRequestError extends Error {
  readonly code: AiErrorCode
  readonly status?: number

  constructor(message: string, code: AiErrorCode, status?: number, cause?: unknown) {
    super(message, { cause })
    this.name = 'ProviderRequestError'
    this.code = code
    this.status = status
  }
}

export function normalizeBaseUrl(url: string, fallback: string): string {
  const clean = url.trim().replace(/\/+$/, '')
  return clean || fallback
}

export function combineTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void; wasTimeout: () => boolean } {
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    wasTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onAbort)
    },
  }
}

export async function readSafeResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export function mapHttpStatusToErrorCode(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  if (status === 404) return 'model_unavailable'
  return 'http_error'
}
