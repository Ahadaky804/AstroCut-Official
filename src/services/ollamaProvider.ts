import type {
  AiConnectionCheckResult,
  AiContentProvider,
  AiGenerationRequest,
  AiGenerationResult,
  AiModelInfo,
} from './aiProvider'
import {
  buildStudioPrompts,
  parseGeneratedStudioResponse,
} from './promptBuilder'

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const CONNECTION_TIMEOUT_MS = 5000
const GENERATION_TIMEOUT_MS = 90000

interface OllamaTagsResponse {
  models?: Array<{
    name?: string
    size?: number
    modified_at?: string
    details?: {
      parameter_size?: string
      quantization_level?: string
    }
  }>
}

interface OllamaChatResponse {
  model?: string
  message?: {
    role?: string
    content?: string
  }
  error?: string
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_OLLAMA_BASE_URL
}

function combineSignals(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void; wasTimeout: () => boolean } {
  const controller = new AbortController()
  let timedOut = false

  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const handleExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, {
        once: true,
      })
    }
  }

  return {
    signal: controller.signal,
    wasTimeout: () => timedOut,
    cleanup: () => {
      window.clearTimeout(timer)
      externalSignal?.removeEventListener('abort', handleExternalAbort)
    },
  }
}

function describeNetworkFailure(baseUrl: string): string {
  return `Unable to reach Ollama at ${baseUrl}. Make sure Ollama is installed and running ("ollama serve"), and verify browser CORS access (OLLAMA_ORIGINS) if running from localhost.`
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    if (!text) return ''
    try {
      const json = JSON.parse(text) as { error?: string }
      return json.error || text
    } catch {
      return text
    }
  } catch {
    return ''
  }
}

/**
 * Creates a local Ollama provider implementing AstroCut's AiContentProvider interface.
 */
export function createOllamaProvider(
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
): AiContentProvider {
  const normalizedUrl = normalizeBaseUrl(baseUrl)

  const listModels = async (signal?: AbortSignal): Promise<AiModelInfo[]> => {
    const { signal: reqSignal, cleanup, wasTimeout } = combineSignals(
      CONNECTION_TIMEOUT_MS,
      signal,
    )

    try {
      const response = await fetch(`${normalizedUrl}/api/tags`, {
        method: 'GET',
        signal: reqSignal,
      })

      if (!response.ok) {
        const detail = await readErrorBody(response)
        throw new Error(
          detail
            ? `Ollama returned HTTP ${response.status}: ${detail}`
            : `Ollama returned HTTP ${response.status} while listing models.`,
        )
      }

      let data: OllamaTagsResponse
      try {
        data = (await response.json()) as OllamaTagsResponse
      } catch (err) {
        throw new Error('Ollama returned malformed JSON from /api/tags.', {
          cause: err,
        })
      }

      if (!Array.isArray(data.models)) {
        throw new Error('Ollama /api/tags response did not include a models list.')
      }

      return data.models
        .filter((m): m is NonNullable<typeof m> & { name: string } =>
          Boolean(m && typeof m.name === 'string' && m.name.trim()),
        )
        .map((m) => ({
          name: m.name.trim(),
          sizeBytes: typeof m.size === 'number' ? m.size : undefined,
          parameterSize: m.details?.parameter_size,
          quantization: m.details?.quantization_level,
          modifiedAt: m.modified_at,
        }))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (wasTimeout()) {
          throw new Error(
            `Connection to Ollama at ${normalizedUrl} timed out after ${CONNECTION_TIMEOUT_MS / 1000}s.`,
            { cause: err },
          )
        }
        throw new Error('Connection check was cancelled.', { cause: err })
      }
      if (err instanceof TypeError) {
        throw new Error(describeNetworkFailure(normalizedUrl), { cause: err })
      }
      throw err
    } finally {
      cleanup()
    }
  }

  const testConnection = async (
    signal?: AbortSignal,
  ): Promise<AiConnectionCheckResult> => {
    try {
      const models = await listModels(signal)
      if (models.length === 0) {
        return {
          connected: true,
          models: [],
          errorCode: 'no_models',
          message:
            'Ollama is running, but no models are installed yet. Pull a model (e.g. "ollama pull llama3.2:3b") and click Refresh Models.',
        }
      }
      return {
        connected: true,
        models,
        message: `Connected to Ollama (${models.length} ${models.length === 1 ? 'model' : 'models'} installed).`,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to connect to Ollama.'
      const isTimeout = message.toLowerCase().includes('timed out')
      const isNetwork =
        message.toLowerCase().includes('unable to reach') ||
        message.toLowerCase().includes('failed to fetch')

      return {
        connected: false,
        models: [],
        errorCode: isTimeout
          ? 'timeout'
          : isNetwork
            ? 'cors_or_network'
            : 'unknown',
        message,
      }
    }
  }

  const checkModelAvailability = async (
    modelName: string,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    const target = modelName.trim()
    if (!target) return false
    const models = await listModels(signal)
    return models.some((m) => m.name === target)
  }

  const generate = async (
    request: AiGenerationRequest,
  ): Promise<AiGenerationResult> => {
    const model = request.model.trim()
    if (!model) {
      throw new Error('Select an installed Ollama model before generating.')
    }

    const available = await checkModelAvailability(model, request.signal)
    if (!available) {
      throw new Error(
        `Model "${model}" is not currently installed in Ollama. Refresh models or select another installed model.`,
      )
    }

    const { systemPrompt, userPrompt } = buildStudioPrompts(request)
    const { signal: reqSignal, cleanup, wasTimeout } = combineSignals(
      GENERATION_TIMEOUT_MS,
      request.signal,
    )

    try {
      const response = await fetch(`${normalizedUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: reqSignal,
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.6,
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!response.ok) {
        const detail = await readErrorBody(response)
        if (response.status === 404) {
          throw new Error(
            detail ||
              `Ollama could not find model "${model}" or /api/chat endpoint.`,
          )
        }
        throw new Error(
          detail
            ? `Ollama generation error (HTTP ${response.status}): ${detail}`
            : `Ollama generation failed with HTTP ${response.status}.`,
        )
      }

      let payload: OllamaChatResponse
      try {
        payload = (await response.json()) as OllamaChatResponse
      } catch (err) {
        throw new Error(
          'Ollama returned malformed JSON during content generation.',
          { cause: err },
        )
      }

      if (payload.error) {
        throw new Error(`Ollama error: ${payload.error}`)
      }

      const rawContent = payload.message?.content ?? ''
      const { content, warnings } = parseGeneratedStudioResponse(
        rawContent,
        request.platforms,
      )

      return {
        content,
        model: payload.model || model,
        warnings,
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (wasTimeout()) {
          throw new Error(
            `Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s. Larger models may run slowly on CPU or limited VRAM—try a smaller 2B–4B model.`,
            { cause: err },
          )
        }
        throw new Error('AI generation was cancelled.', { cause: err })
      }
      if (err instanceof TypeError) {
        throw new Error(describeNetworkFailure(normalizedUrl), { cause: err })
      }
      throw err
    } finally {
      cleanup()
    }
  }

  return {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: normalizedUrl,
    testConnection,
    listModels,
    checkModelAvailability,
    generate,
  }
}
