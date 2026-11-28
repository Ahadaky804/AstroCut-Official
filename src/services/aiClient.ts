import type {
  AiConnectionCheckResult,
  AiGenerationRequest,
  AiGenerationResult,
  AiModelInfo,
  AiRoutingSettings,
  AiSystemSnapshot,
  ProviderId,
  ProviderUpsertPayload,
} from '../types/ai'
import type {
  TranscriptTransformRequest,
  TranscriptTransformResult,
} from '../types/transcription'

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const errMsg =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Request failed with HTTP ${response.status}.`
    throw new Error(errMsg)
  }

  if (parsed === null) {
    throw new Error('Server returned an empty or invalid JSON response.')
  }

  return parsed as T
}

/**
 * Frontend client communicating strictly with AstroCut's server-side /api/ai/* endpoints.
 * No API keys or secrets are stored or handled directly in browser storage.
 */
export const aiClient = {
  getSystemSnapshot(): Promise<AiSystemSnapshot> {
    return requestJson<AiSystemSnapshot>('/api/ai/system', { method: 'GET' })
  },

  upsertProvider(
    payload: ProviderUpsertPayload,
  ): Promise<{ snapshot: AiSystemSnapshot }> {
    return requestJson<{ snapshot: AiSystemSnapshot }>('/api/ai/providers', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteProvider(id: ProviderId): Promise<{ snapshot: AiSystemSnapshot }> {
    return requestJson<{ snapshot: AiSystemSnapshot }>(
      `/api/ai/providers/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    )
  },

  testConnection(
    id: ProviderId,
  ): Promise<{ result: AiConnectionCheckResult; snapshot: AiSystemSnapshot }> {
    return requestJson<{
      result: AiConnectionCheckResult
      snapshot: AiSystemSnapshot
    }>(`/api/ai/providers/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    })
  },

  refreshModels(
    id: ProviderId,
  ): Promise<{ models: AiModelInfo[]; snapshot: AiSystemSnapshot }> {
    return requestJson<{ models: AiModelInfo[]; snapshot: AiSystemSnapshot }>(
      `/api/ai/providers/${encodeURIComponent(id)}/models`,
      { method: 'POST' },
    )
  },

  updateRouting(
    patch: Partial<AiRoutingSettings>,
  ): Promise<{ routing: AiRoutingSettings; snapshot: AiSystemSnapshot }> {
    return requestJson<{
      routing: AiRoutingSettings
      snapshot: AiSystemSnapshot
    }>('/api/ai/routing', {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
  },

  generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    return requestJson<AiGenerationResult>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  transformTranscript(
    request: TranscriptTransformRequest,
  ): Promise<TranscriptTransformResult> {
    return requestJson<TranscriptTransformResult>(
      '/api/ai/transcript-transform',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    )
  },
}
