import type { AiModelInfo } from '../../src/types/ai.ts'
import {
  combineTimeoutSignal,
  mapHttpStatusToErrorCode,
  normalizeBaseUrl,
  ProviderRequestError,
  readSafeResponseText,
  type AdapterGenerationInput,
  type AdapterGenerationOutput,
  type ServerAiAdapter,
  type ServerProviderRuntimeConfig,
} from './types.ts'

const CONNECT_TIMEOUT_MS = 10000
const GENERATE_TIMEOUT_MS = 60000

interface OpenAiModelsResponse {
  data?: Array<{
    id?: string
    name?: string
    context_length?: number
  }>
}

interface OpenAiChatResponse {
  model?: string
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: { message?: string }
}

function parseError(text: string): string {
  if (!text) return ''
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } }
    return parsed.error?.message || text
  } catch {
    return text
  }
}

function buildAuthHeaders(config: ServerProviderRuntimeConfig): Record<string, string> {
  const headers: Record<string, string> = {
    ...(config.extraHeaders ?? {}),
  }
  if (config.apiKey?.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`
  }
  return headers
}

export const openAiCompatibleAdapter: ServerAiAdapter = {
  id: 'openai',

  async listModels(
    config: ServerProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<AiModelInfo[]> {
    if (config.capabilities.requiresApiKey && !config.apiKey?.trim()) {
      throw new ProviderRequestError(
        `${config.name} API key is not configured.`,
        'not_configured',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, '')
    if (!baseUrl) {
      throw new ProviderRequestError(
        `${config.name} base URL is missing.`,
        'not_configured',
      )
    }

    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      CONNECT_TIMEOUT_MS,
      signal,
    )

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: buildAuthHeaders(config),
        signal: reqSignal,
      })

      if (!response.ok) {
        const detail = parseError(await readSafeResponseText(response))
        const code = mapHttpStatusToErrorCode(response.status)
        throw new ProviderRequestError(
          code === 'unauthorized'
            ? `${config.name} API key was rejected (HTTP 401/403).`
            : code === 'rate_limited'
              ? `${config.name} rate limit reached (HTTP 429).`
              : `${config.name} returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`,
          code,
          response.status,
        )
      }

      const payload = (await response.json()) as OpenAiModelsResponse
      if (!Array.isArray(payload.data)) {
        throw new ProviderRequestError(
          `${config.name} /models returned an unexpected format.`,
          'invalid_response',
        )
      }

      return payload.data
        .filter((m): m is { id: string; name?: string; context_length?: number } =>
          Boolean(m.id),
        )
        .map((m) => ({
          name: m.id,
          displayName: m.name || m.id,
          contextWindow: m.context_length,
        }))
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? `${config.name} connection timed out.`
            : `${config.name} request cancelled.`,
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        `Unable to reach ${config.name} at ${baseUrl}.`,
        'connection_refused',
        undefined,
        err,
      )
    } finally {
      cleanup()
    }
  },

  async testConnection(config, signal) {
    try {
      const models = await openAiCompatibleAdapter.listModels(config, signal)
      return {
        providerId: config.id,
        connected: true,
        models,
        message: `Connected to ${config.name} (${models.length} models available).`,
      }
    } catch (err) {
      const pErr = err instanceof ProviderRequestError ? err : null
      return {
        providerId: config.id,
        connected: false,
        models: [],
        errorCode: pErr?.code ?? 'unknown',
        message:
          err instanceof Error
            ? err.message
            : `${config.name} connection failed.`,
      }
    }
  },

  async generate(
    config: ServerProviderRuntimeConfig,
    input: AdapterGenerationInput,
  ): Promise<AdapterGenerationOutput> {
    if (config.capabilities.requiresApiKey && !config.apiKey?.trim()) {
      throw new ProviderRequestError(
        `${config.name} API key is not configured.`,
        'not_configured',
      )
    }

    const model = input.model.trim() || config.defaultModel.trim()
    if (!model) {
      throw new ProviderRequestError(
        `No model is selected for ${config.name}.`,
        'model_unavailable',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, '')
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      GENERATE_TIMEOUT_MS,
      input.signal,
    )

    try {
      const bodyPayload: Record<string, unknown> = {
        model,
        temperature: input.temperature ?? 0.6,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }

      if (input.structuredJson && config.capabilities.supportsStructuredJson) {
        bodyPayload.response_format = { type: 'json_object' }
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(config),
        },
        signal: reqSignal,
        body: JSON.stringify(bodyPayload),
      })

      if (!response.ok) {
        const detail = parseError(await readSafeResponseText(response))
        const code = mapHttpStatusToErrorCode(response.status)
        throw new ProviderRequestError(
          code === 'unauthorized'
            ? `${config.name} API key is invalid or unauthorized.`
            : code === 'rate_limited'
              ? `${config.name} rate limit exceeded (HTTP 429).`
              : `${config.name} generation failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`,
          code,
          response.status,
        )
      }

      const payload = (await response.json()) as OpenAiChatResponse
      if (payload.error?.message) {
        throw new ProviderRequestError(
          `${config.name} error: ${payload.error.message}`,
          'http_error',
        )
      }

      const rawText = payload.choices?.[0]?.message?.content?.trim() ?? ''
      if (!rawText) {
        throw new ProviderRequestError(
          `${config.name} returned an empty response.`,
          'empty_output',
        )
      }

      return {
        rawText,
        model: payload.model || model,
        usage: payload.usage
          ? {
              promptTokens: payload.usage.prompt_tokens,
              completionTokens: payload.usage.completion_tokens,
              totalTokens: payload.usage.total_tokens,
            }
          : undefined,
      }
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? `${config.name} generation timed out.`
            : `${config.name} generation cancelled.`,
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        `Network error while calling ${config.name}.`,
        'connection_refused',
        undefined,
        err,
      )
    } finally {
      cleanup()
    }
  },
}
