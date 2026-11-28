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

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const CONNECT_TIMEOUT_MS = 5000
const GENERATE_TIMEOUT_MS = 90000

interface OllamaTagsResponse {
  models?: Array<{
    name?: string
    size?: number
    details?: {
      parameter_size?: string
      quantization_level?: string
    }
  }>
}

interface OllamaChatResponse {
  model?: string
  message?: {
    content?: string
  }
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

export const ollamaAdapter: ServerAiAdapter = {
  id: 'ollama',

  async listModels(
    config: ServerProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<AiModelInfo[]> {
    const baseUrl = normalizeBaseUrl(config.baseUrl, DEFAULT_OLLAMA_BASE_URL)
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      CONNECT_TIMEOUT_MS,
      signal,
    )

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: reqSignal,
      })

      if (!response.ok) {
        const detail = await readSafeResponseText(response)
        throw new ProviderRequestError(
          `Ollama returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`,
          mapHttpStatusToErrorCode(response.status),
          response.status,
        )
      }

      let data: OllamaTagsResponse
      try {
        data = (await response.json()) as OllamaTagsResponse
      } catch (err) {
        throw new ProviderRequestError(
          'Ollama /api/tags returned malformed JSON.',
          'invalid_response',
          undefined,
          err,
        )
      }

      if (!Array.isArray(data.models)) {
        throw new ProviderRequestError(
          'Ollama /api/tags did not include a models list.',
          'invalid_response',
        )
      }

      const collected: AiModelInfo[] = []
      for (const m of data.models) {
        if (!m || typeof m.name !== 'string' || !m.name.trim()) continue
        const modelName = m.name.trim()
        if (isIncompatibleNonTextModel(modelName)) continue

        collected.push({
          name: modelName,
          displayName: modelName,
          sizeBytes: typeof m.size === 'number' ? m.size : undefined,
          parameterSize: m.details?.parameter_size,
          quantization: m.details?.quantization_level,
          verificationStatus: 'listed',
          capabilityNote: 'Installed in local Ollama (/api/tags)',
        })
      }

      return deduplicateModels(collected)
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderRequestError(
          wasTimeout()
            ? `Connection to Ollama at ${baseUrl} timed out.`
            : 'Ollama connection check cancelled.',
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        `Unable to reach Ollama at ${baseUrl}. Make sure Ollama is installed and running ("ollama serve").`,
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
      const models = await ollamaAdapter.listModels(config, signal)
      if (models.length === 0) {
        return {
          providerId: config.id,
          connected: true,
          models: [],
          errorCode: 'no_models',
          message:
            'Ollama is running, but no compatible models are installed yet. Pull a model (e.g. "ollama pull llama3.2:3b") and click Models.',
        }
      }
      return {
        providerId: config.id,
        connected: true,
        models,
        message: `Connected to Ollama (${models.length} ${models.length === 1 ? 'model' : 'models'} installed).`,
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
            : 'Unable to reach local Ollama service.',
      }
    }
  },

  async generate(
    config: ServerProviderRuntimeConfig,
    input: AdapterGenerationInput,
  ): Promise<AdapterGenerationOutput> {
    const model = input.model.trim() || config.defaultModel.trim()
    if (!model) {
      throw new ProviderRequestError(
        'No Ollama model is selected.',
        'model_unavailable',
      )
    }

    const availableModels = await ollamaAdapter.listModels(config, input.signal)
    if (!availableModels.some((m) => m.name === model)) {
      throw new ProviderRequestError(
        `Model "${model}" is not installed in Ollama. Refresh models or select another installed model.`,
        'model_unavailable',
      )
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl, DEFAULT_OLLAMA_BASE_URL)
    const { signal: reqSignal, cleanup, wasTimeout } = combineTimeoutSignal(
      GENERATE_TIMEOUT_MS,
      input.signal,
    )

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: reqSignal,
        body: JSON.stringify({
          model,
          stream: false,
          ...(input.structuredJson ? { format: 'json' } : {}),
          options: { temperature: input.temperature ?? 0.6 },
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
        }),
      })

      if (!response.ok) {
        const detail = await readSafeResponseText(response)
        throw new ProviderRequestError(
          `Ollama returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`,
          mapHttpStatusToErrorCode(response.status),
          response.status,
        )
      }

      const payload = (await response.json()) as OllamaChatResponse
      if (payload.error) {
        throw new ProviderRequestError(
          `Ollama error: ${payload.error}`,
          'http_error',
        )
      }

      const rawText = payload.message?.content?.trim() ?? ''
      if (!rawText) {
        throw new ProviderRequestError(
          'Ollama returned an empty response.',
          'empty_output',
        )
      }

      const promptTokens = payload.prompt_eval_count
      const completionTokens = payload.eval_count

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
            ? 'Ollama generation timed out. Smaller 2B–4B models are faster on CPU/4GB VRAM.'
            : 'Ollama generation cancelled.',
          'timeout',
          undefined,
          err,
        )
      }
      throw new ProviderRequestError(
        `Unable to reach Ollama at ${baseUrl}.`,
        'connection_refused',
        undefined,
        err,
      )
    } finally {
      cleanup()
    }
  },
}
