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

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const CONNECT_TIMEOUT_MS = 10000
const GENERATE_TIMEOUT_MS = 60000

interface GeminiModelsResponse {
  models?: Array<{
    name?: string
    displayName?: string
    supportedGenerationMethods?: string[]
    inputTokenLimit?: number
  }>
  error?: { message?: string }
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  error?: { message?: string }
}

function stripModelPrefix(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name
}

function parseApiError(text: string): string {
  if (!text) return ''
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } }
    return parsed.error?.message || text
  } catch {
    return text
  }
}

export const geminiAdapter: ServerAiAdapter = {
  id: 'gemini',

  async listModels(
    config: ServerProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<AiModelInfo[]> {
    const apiKey = config.apiKey?.trim()
    if (!apiKey) {
      throw new ProviderRequestError(
        'Gemini API key is not configured. Set GEMINI_API_KEY or save a key in AI Provider Settings.',
        'not_configured',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, DEFAULT_GEMINI_BASE_URL)
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      CONNECT_TIMEOUT_MS,
      signal,
    )

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
        signal: reqSignal,
      })

      if (!response.ok) {
        const detail = parseApiError(await readSafeResponseText(response))
        const code = mapHttpStatusToErrorCode(response.status)
        throw new ProviderRequestError(
          code === 'unauthorized'
            ? 'Gemini API key was rejected (HTTP 401/403). Check your key.'
            : code === 'rate_limited'
              ? 'Gemini API rate limit reached (HTTP 429). Wait and retry.'
              : `Gemini returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`,
          code,
          response.status,
        )
      }

      const data = (await response.json()) as GeminiModelsResponse
      if (!Array.isArray(data.models)) {
        throw new ProviderRequestError(
          'Gemini /models returned an unexpected response.',
          'invalid_response',
        )
      }

      return data.models
        .filter(
          (m) =>
            m.name &&
            (!m.supportedGenerationMethods ||
              m.supportedGenerationMethods.includes('generateContent')),
        )
        .map((m) => ({
          name: stripModelPrefix(m.name!),
          displayName: m.displayName || stripModelPrefix(m.name!),
          contextWindow: m.inputTokenLimit,
        }))
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? 'Gemini connection timed out.'
            : 'Gemini request was cancelled.',
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        `Unable to reach Google Gemini API at ${baseUrl}.`,
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
      const models = await geminiAdapter.listModels(config, signal)
      if (models.length === 0) {
        return {
          providerId: config.id,
          connected: true,
          models: [],
          errorCode: 'no_models',
          message: 'Connected to Gemini API, but no generateContent models were returned.',
        }
      }
      return {
        providerId: config.id,
        connected: true,
        models,
        message: `Connected to Google Gemini (${models.length} models available).`,
      }
    } catch (err) {
      const pErr = err instanceof ProviderRequestError ? err : null
      return {
        providerId: config.id,
        connected: false,
        models: [],
        errorCode: pErr?.code ?? 'unknown',
        message: err instanceof Error ? err.message : 'Gemini connection failed.',
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
        'Gemini API key is not configured.',
        'not_configured',
      )
    }

    const model = stripModelPrefix(input.model.trim() || config.defaultModel.trim())
    if (!model) {
      throw new ProviderRequestError(
        'No Gemini model is selected.',
        'model_unavailable',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, DEFAULT_GEMINI_BASE_URL)
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      GENERATE_TIMEOUT_MS,
      input.signal,
    )

    try {
      const response = await fetch(
        `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          signal: reqSignal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: input.systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: input.userPrompt }],
              },
            ],
            generationConfig: {
              temperature: input.temperature ?? 0.6,
              ...(input.structuredJson
                ? { responseMimeType: 'application/json' }
                : {}),
            },
          }),
        },
      )

      if (!response.ok) {
        const detail = parseApiError(await readSafeResponseText(response))
        const code = mapHttpStatusToErrorCode(response.status)
        throw new ProviderRequestError(
          code === 'unauthorized'
            ? 'Gemini API key is invalid or unauthorized.'
            : code === 'rate_limited'
              ? 'Gemini API rate limit exceeded (HTTP 429).'
              : `Gemini generation failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`,
          code,
          response.status,
        )
      }

      const payload = (await response.json()) as GeminiGenerateResponse
      if (payload.error?.message) {
        throw new ProviderRequestError(
          `Gemini error: ${payload.error.message}`,
          'http_error',
        )
      }

      const rawText =
        payload.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('')
          .trim() ?? ''

      if (!rawText) {
        throw new ProviderRequestError(
          'Gemini returned an empty response.',
          'empty_output',
        )
      }

      return {
        rawText,
        model,
        usage: payload.usageMetadata
          ? {
              promptTokens: payload.usageMetadata.promptTokenCount,
              completionTokens: payload.usageMetadata.candidatesTokenCount,
              totalTokens: payload.usageMetadata.totalTokenCount,
            }
          : undefined,
      }
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? 'Gemini generation timed out.'
            : 'Gemini generation cancelled.',
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        'Network error while calling Google Gemini API.',
        'connection_refused',
        undefined,
        err,
      )
    } finally {
      cleanup()
    }
  },
}
