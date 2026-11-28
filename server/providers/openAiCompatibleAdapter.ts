import type { AiModelInfo } from '../../src/types/ai.ts'
import {
  deduplicateModels,
  isIncompatibleNonTextModel,
} from './modelCatalog.ts'
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

const CONNECT_TIMEOUT_MS = 15000
const GENERATE_TIMEOUT_MS = 60000
const MAX_MODEL_PAGES = 50

interface OpenAiModelItem {
  id?: string
  name?: string
  context_length?: number
  max_context_length?: number
  architecture?: {
    modality?: string
    output_modalities?: string[]
  }
}

interface OpenAiModelsResponse {
  data?: OpenAiModelItem[]
  models?: OpenAiModelItem[]
  has_more?: boolean
  last_id?: string
  next_page?: string
  next?: string
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

function extractOpenAiModelList(payload: unknown): {
  items: OpenAiModelItem[]
  hasMore: boolean
  nextCursor?: string
  nextUrl?: string
} | null {
  if (Array.isArray(payload)) {
    return {
      items: payload as OpenAiModelItem[],
      hasMore: false,
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const obj = payload as OpenAiModelsResponse
  const items = Array.isArray(obj.data)
    ? obj.data
    : Array.isArray(obj.models)
      ? obj.models
      : null

  if (!items) return null

  return {
    items,
    hasMore: Boolean(obj.has_more),
    nextCursor: typeof obj.last_id === 'string' ? obj.last_id.trim() : undefined,
    nextUrl:
      typeof obj.next_page === 'string'
        ? obj.next_page.trim()
        : typeof obj.next === 'string'
          ? obj.next.trim()
          : undefined,
  }
}

function resolveNextPageUrl(
  baseUrl: string,
  nextUrl?: string,
  nextCursor?: string,
): string | null {
  if (nextUrl) {
    if (nextUrl.startsWith('http://') || nextUrl.startsWith('https://')) {
      try {
        const baseOrigin = new URL(baseUrl).origin
        const target = new URL(nextUrl)
        return target.origin === baseOrigin ? target.toString() : null
      } catch {
        return null
      }
    }
    if (nextUrl.startsWith('/')) {
      const origin = new URL(baseUrl).origin
      return `${origin}${nextUrl}`
    }
    return `${baseUrl}/${nextUrl.replace(/^\/+/, '')}`
  }

  if (nextCursor) {
    return `${baseUrl}/models?after=${encodeURIComponent(nextCursor)}`
  }

  return null
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
      const collected: AiModelInfo[] = []
      let currentUrl: string | null = `${baseUrl}/models`
      const visitedUrls = new Set<string>()

      for (let page = 0; page < MAX_MODEL_PAGES && currentUrl; page++) {
        if (visitedUrls.has(currentUrl)) break
        visitedUrls.add(currentUrl)

        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: buildAuthHeaders(config),
          signal: reqSignal,
        })

        if (!response.ok) {
          const detail = parseError(await readSafeResponseText(response))
          const code = mapHttpStatusToErrorCode(response.status)
          if (
            (response.status === 404 ||
              response.status === 405 ||
              response.status === 501) &&
            page === 0
          ) {
            throw new ProviderRequestError(
              `${config.name} does not support model discovery at GET /models (HTTP ${response.status}). You can still enter a default model manually.`,
              'model_unavailable',
              response.status,
            )
          }
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

        let rawPayload: unknown
        try {
          rawPayload = await response.json()
        } catch (err) {
          throw new ProviderRequestError(
            `${config.name} /models returned malformed JSON.`,
            'invalid_response',
            undefined,
            err,
          )
        }

        const extracted = extractOpenAiModelList(rawPayload)
        if (!extracted) {
          throw new ProviderRequestError(
            `${config.name} /models returned an unexpected format.`,
            'invalid_response',
          )
        }

        for (const m of extracted.items) {
          if (!m || typeof m.id !== 'string' || !m.id.trim()) continue
          const modelId = m.id.trim()
          if (
            isIncompatibleNonTextModel(modelId, {
              modality: m.architecture?.modality,
              outputModalities: m.architecture?.output_modalities,
            })
          ) {
            continue
          }

          const hasTextOutputModality = Boolean(
            m.architecture?.output_modalities?.some(
              (mod) => mod.toLowerCase() === 'text',
            ),
          )

          collected.push({
            name: modelId,
            displayName: m.name?.trim() || modelId,
            contextWindow: m.context_length ?? m.max_context_length,
            verificationStatus: hasTextOutputModality ? 'verified_text' : 'listed',
            capabilityNote: hasTextOutputModality
              ? 'Verified text output modality'
              : `Listed by ${config.name} /models`,
          })
        }

        if (extracted.hasMore && (extracted.nextUrl || extracted.nextCursor)) {
          currentUrl = resolveNextPageUrl(
            baseUrl,
            extracted.nextUrl,
            extracted.nextCursor,
          )
        } else if (extracted.nextUrl) {
          currentUrl = resolveNextPageUrl(baseUrl, extracted.nextUrl)
        } else {
          currentUrl = null
        }
      }

      return deduplicateModels(collected)
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
      if (models.length === 0) {
        return {
          providerId: config.id,
          connected: true,
          models: [],
          errorCode: 'no_models',
          message: `Connected to ${config.name}, but no compatible text models were returned.`,
        }
      }
      return {
        providerId: config.id,
        connected: true,
        models,
        message: `Connected to ${config.name} (${models.length} models discovered).`,
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
