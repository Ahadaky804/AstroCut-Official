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

const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'
const CONNECT_TIMEOUT_MS = 10000
const GENERATE_TIMEOUT_MS = 60000

interface AnthropicModelsResponse {
  data?: Array<{
    id?: string
    display_name?: string
  }>
}

interface AnthropicMessagesResponse {
  model?: string
  content?: Array<{
    type?: string
    text?: string
  }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
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

export const anthropicAdapter: ServerAiAdapter = {
  id: 'anthropic',

  async listModels(
    config: ServerProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<AiModelInfo[]> {
    const apiKey = config.apiKey?.trim()
    if (!apiKey) {
      throw new ProviderRequestError(
        'Anthropic API key is not configured. Set ANTHROPIC_API_KEY or save a key in AI Provider Settings.',
        'not_configured',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, DEFAULT_ANTHROPIC_BASE_URL)
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      CONNECT_TIMEOUT_MS,
      signal,
    )

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: reqSignal,
      })

      if (!response.ok) {
        const detail = parseError(await readSafeResponseText(response))
        const code = mapHttpStatusToErrorCode(response.status)
        throw new ProviderRequestError(
          code === 'unauthorized'
            ? 'Anthropic API key was rejected (HTTP 401/403).'
            : code === 'rate_limited'
              ? 'Anthropic API rate limit reached (HTTP 429).'
              : `Anthropic returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`,
          code,
          response.status,
        )
      }

      const data = (await response.json()) as AnthropicModelsResponse
      if (!Array.isArray(data.data)) {
        throw new ProviderRequestError(
          'Anthropic /models returned an unexpected response.',
          'invalid_response',
        )
      }

      return data.data
        .filter((m): m is { id: string; display_name?: string } => Boolean(m.id))
        .map((m) => ({
          name: m.id,
          displayName: m.display_name || m.id,
        }))
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? 'Anthropic connection timed out.'
            : 'Anthropic request was cancelled.',
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        `Unable to reach Anthropic API at ${baseUrl}.`,
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
      const models = await anthropicAdapter.listModels(config, signal)
      return {
        providerId: config.id,
        connected: true,
        models,
        message: `Connected to Anthropic Claude (${models.length} models available).`,
      }
    } catch (err) {
      const pErr = err instanceof ProviderRequestError ? err : null
      return {
        providerId: config.id,
        connected: false,
        models: [],
        errorCode: pErr?.code ?? 'unknown',
        message:
          err instanceof Error ? err.message : 'Anthropic connection failed.',
      }
    }
  },

  async generate(
    config: ServerProviderRuntimeConfig,
    input: AdapterGenerationInput,
  ): Promise<AdapterGenerationOutput> {
    const apiKey = config.apiKey?.trim()
    if (!apiKey) {
      throw new ProviderRequestError(
        'Anthropic API key is not configured.',
        'not_configured',
      )
    }

    const model = input.model.trim() || config.defaultModel.trim()
    if (!model) {
      throw new ProviderRequestError(
        'No Anthropic Claude model is selected.',
        'model_unavailable',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, DEFAULT_ANTHROPIC_BASE_URL)
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      GENERATE_TIMEOUT_MS,
      input.signal,
    )

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: reqSignal,
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature: input.temperature ?? 0.6,
          system: input.systemPrompt,
          messages: [{ role: 'user', content: input.userPrompt }],
        }),
      })

      if (!response.ok) {
        const detail = parseError(await readSafeResponseText(response))
        const code = mapHttpStatusToErrorCode(response.status)
        throw new ProviderRequestError(
          code === 'unauthorized'
            ? 'Anthropic API key is invalid or unauthorized.'
            : code === 'rate_limited'
              ? 'Anthropic API rate limit exceeded (HTTP 429).'
              : `Anthropic generation failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`,
          code,
          response.status,
        )
      }

      const payload = (await response.json()) as AnthropicMessagesResponse
      if (payload.error?.message) {
        throw new ProviderRequestError(
          `Anthropic error: ${payload.error.message}`,
          'http_error',
        )
      }

      const rawText =
        payload.content
          ?.filter((c) => c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text!)
          .join('')
          .trim() ?? ''

      if (!rawText) {
        throw new ProviderRequestError(
          'Anthropic returned an empty response.',
          'empty_output',
        )
      }

      const promptTokens = payload.usage?.input_tokens
      const completionTokens = payload.usage?.output_tokens

      return {
        rawText,
        model: payload.model || model,
        usage:
          promptTokens !== undefined || completionTokens !== undefined
            ? {
                promptTokens,
                completionTokens,
                totalTokens:
                  promptTokens !== undefined && completionTokens !== undefined
                    ? promptTokens + completionTokens
                    : undefined,
              }
            : undefined,
      }
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? 'Anthropic generation timed out.'
            : 'Anthropic generation cancelled.',
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        'Network error while calling Anthropic API.',
        'connection_refused',
        undefined,
        err,
      )
    } finally {
      cleanup()
    }
  },
}
