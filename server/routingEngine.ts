import type {
  AiAttemptLog,
  AiConnectionCheckResult,
  AiGenerationRequest,
  AiGenerationResult,
  AiModelInfo,
  AiTaskType,
  ProviderId,
} from '../src/types/ai.ts'
import {
  buildStudioPrompts,
  parseGeneratedStudioResponse,
} from '../src/services/promptBuilder.ts'
import type { ServerConfigStore } from './configStore.ts'
import { redactSecrets } from './envLoader.ts'
import { getAdapterForFormat } from './providerRegistry.ts'
import { deduplicateModels } from './providers/modelCatalog.ts'
import { ProviderRequestError } from './providers/types.ts'

const COOLDOWN_MS = 45000

const TASK_CAPABILITIES: Record<
  AiTaskType,
  { requiresStructuredJson: boolean; requiresVideoUnderstanding: boolean }
> = {
  titles_descriptions: {
    requiresStructuredJson: true,
    requiresVideoUnderstanding: false,
  },
  captions_hashtags: {
    requiresStructuredJson: true,
    requiresVideoUnderstanding: false,
  },
  video_summaries: {
    requiresStructuredJson: true,
    requiresVideoUnderstanding: true,
  },
  transcript_cleanup: {
    requiresStructuredJson: true,
    requiresVideoUnderstanding: false,
  },
  translation_roman_urdu: {
    requiresStructuredJson: true,
    requiresVideoUnderstanding: false,
  },
}

export function inferTaskType(request: AiGenerationRequest): AiTaskType {
  if (request.taskType) return request.taskType
  if (
    request.settings.language === 'roman-urdu' ||
    request.settings.language === 'hinglish'
  ) {
    return 'translation_roman_urdu'
  }
  if (
    request.platforms.length > 0 &&
    !request.platforms.includes('youtube')
  ) {
    return 'captions_hashtags'
  }
  return 'titles_descriptions'
}

export async function testProviderConnection(
  store: ServerConfigStore,
  providerId: ProviderId,
  signal?: AbortSignal,
): Promise<AiConnectionCheckResult> {
  const pub = store.getPublicProvider(providerId)
  const runtime = store.getRuntimeConfig(providerId)
  if (!pub || !runtime) {
    return {
      providerId,
      connected: false,
      models: [],
      errorCode: 'not_configured',
      message: `Provider "${providerId}" was not found.`,
    }
  }

  const adapter = getAdapterForFormat(pub.apiFormat)
  const result = await adapter.testConnection(runtime, signal)
  result.message = redactSecrets(result.message, store.getAllSecrets())
  const models = result.connected ? deduplicateModels(result.models) : []
  result.models = models

  store.setRuntimeStatus(providerId, {
    status: result.connected ? 'connected' : 'error',
    statusMessage: result.message,
    discoveredModels: models,
    discoveryFailed: !result.connected,
  })

  if (result.connected && models.length > 0 && !pub.defaultModel.trim()) {
    const preferred =
      models.find((m) => m.verificationStatus === 'verified_text')?.name ??
      models[0].name
    store.upsertProvider({
      id: providerId,
      defaultModel: preferred,
    })
  }

  return result
}

export async function refreshProviderModels(
  store: ServerConfigStore,
  providerId: ProviderId,
  signal?: AbortSignal,
): Promise<AiModelInfo[]> {
  const pub = store.getPublicProvider(providerId)
  const runtime = store.getRuntimeConfig(providerId)
  if (!pub || !runtime) {
    throw new ProviderRequestError(
      `Provider "${providerId}" was not found.`,
      'not_configured',
    )
  }

  const adapter = getAdapterForFormat(pub.apiFormat)
  try {
    const models = deduplicateModels(await adapter.listModels(runtime, signal))
    store.setRuntimeStatus(providerId, {
      status: 'connected',
      statusMessage:
        models.length > 0
          ? `Connected (${models.length} compatible model${models.length === 1 ? '' : 's'} discovered).`
          : 'Connected, but no compatible models were returned.',
      discoveredModels: models,
      discoveryFailed: false,
    })

    if (models.length > 0 && !pub.defaultModel.trim()) {
      const preferred =
        models.find((m) => m.verificationStatus === 'verified_text')?.name ??
        models[0].name
      store.upsertProvider({
        id: providerId,
        defaultModel: preferred,
      })
    }

    return models
  } catch (err) {
    const cleanMsg = redactSecrets(
      err instanceof Error ? err.message : 'Model discovery failed.',
      store.getAllSecrets(),
    )
    store.setRuntimeStatus(providerId, {
      status: 'error',
      statusMessage: cleanMsg,
      discoveredModels: [],
      discoveryFailed: true,
    })
    throw new ProviderRequestError(
      cleanMsg,
      err instanceof ProviderRequestError ? err.code : 'unknown',
      err instanceof ProviderRequestError ? err.status : undefined,
    )
  }
}

function resolveModelForProvider(
  store: ServerConfigStore,
  providerId: ProviderId,
  preferredModel?: string,
): string {
  if (preferredModel?.trim()) return preferredModel.trim()
  const pub = store.getPublicProvider(providerId)
  if (pub?.defaultModel.trim()) return pub.defaultModel.trim()
  if (pub?.discoveredModels[0]?.name) return pub.discoveredModels[0].name
  return ''
}

function isProviderEligibleForAuto(
  store: ServerConfigStore,
  providerId: ProviderId,
): boolean {
  const pub = store.getPublicProvider(providerId)
  if (!pub || !pub.enabled) return false
  if (pub.capabilities.requiresApiKey && !pub.hasApiKey) return false
  if (pub.id === 'ollama' && pub.status === 'error') return false
  return true
}

export async function generateWithRouting(
  store: ServerConfigStore,
  request: AiGenerationRequest,
  signal?: AbortSignal,
): Promise<AiGenerationResult> {
  const taskType = inferTaskType(request)
  const taskReq = TASK_CAPABILITIES[taskType]
  const snapshot = store.getSnapshot()
  const { routing } = snapshot

  if (taskReq.requiresVideoUnderstanding) {
    const hasVideoProvider = snapshot.providers.some(
      (p) => p.enabled && p.capabilities.supportsVideoInput,
    )
    if (!hasVideoProvider) {
      throw new ProviderRequestError(
        'Video summarization from actual video content requires multimodal/transcription support (planned for Phase 7). Text-only AI endpoints cannot analyze video files directly.',
        'unsupported_capability',
      )
    }
  }

  const taskRoute = routing.taskRoutes[taskType]

  // Mode A: Manual — strictly honors user selection, NEVER silently switches providers
  if (routing.mode === 'manual') {
    const chosenProviderId =
      request.providerId ||
      (taskRoute.providerId !== 'default'
        ? taskRoute.providerId
        : routing.defaultProviderId)

    const pub = store.getPublicProvider(chosenProviderId)
    const runtime = store.getRuntimeConfig(chosenProviderId)
    if (!pub || !runtime) {
      throw new ProviderRequestError(
        `Selected provider "${chosenProviderId}" is not configured.`,
        'not_configured',
      )
    }
    if (!pub.enabled) {
      throw new ProviderRequestError(
        `Selected provider "${pub.name}" is currently disabled in AI Provider Settings.`,
        'not_configured',
      )
    }

    const modelOverride =
      request.model ||
      (taskRoute.providerId === chosenProviderId && taskRoute.model
        ? taskRoute.model
        : routing.defaultProviderId === chosenProviderId && routing.defaultModel
          ? routing.defaultModel
          : undefined)

    let model = resolveModelForProvider(store, chosenProviderId, modelOverride)
    if (!model && pub.id === 'ollama') {
      const models = await refreshProviderModels(store, 'ollama', signal)
      model = models[0]?.name ?? ''
    }
    if (!model) {
      throw new ProviderRequestError(
        `No model is selected for ${pub.name}. Select or enter a model in AI Provider Settings.`,
        'model_unavailable',
      )
    }

    const { systemPrompt, userPrompt } = buildStudioPrompts(request)
    const adapter = getAdapterForFormat(pub.apiFormat)
    const attempts: AiAttemptLog[] = []

    try {
      const output = await adapter.generate(runtime, {
        model,
        systemPrompt,
        userPrompt,
        structuredJson: pub.capabilities.supportsStructuredJson,
        signal,
      })

      const { content, warnings } = parseGeneratedStudioResponse(
        output.rawText,
        request.platforms,
      )

      store.setRuntimeStatus(chosenProviderId, {
        status: 'connected',
        statusMessage: `Connected (${output.model} ready).`,
      })

      attempts.push({
        providerId: chosenProviderId,
        providerName: pub.name,
        model: output.model,
        success: true,
      })

      return {
        content,
        providerId: chosenProviderId,
        providerName: pub.name,
        providerKind: pub.capabilities.kind,
        model: output.model,
        modeUsed: 'manual',
        fallbackUsed: false,
        attempts,
        usage: output.usage,
        warnings,
      }
    } catch (err) {
      const cleanMessage = redactSecrets(
        err instanceof Error ? err.message : 'Generation failed.',
        store.getAllSecrets(),
      )
      store.setRuntimeStatus(chosenProviderId, {
        status: 'error',
        statusMessage: cleanMessage,
      })
      throw new ProviderRequestError(
        cleanMessage,
        err instanceof ProviderRequestError ? err.code : 'unknown',
      )
    }
  }

  // Mode B: Automatic — selects best eligible configured provider with optional fallback
  const candidateIds: ProviderId[] = []
  const pushUnique = (id: ProviderId) => {
    if (!candidateIds.includes(id) && isProviderEligibleForAuto(store, id)) {
      candidateIds.push(id)
    }
  }

  if (taskRoute.providerId !== 'default') {
    pushUnique(taskRoute.providerId)
  }
  pushUnique(routing.defaultProviderId)

  const nonCooldown: ProviderId[] = []
  const inCooldown: ProviderId[] = []
  for (const pid of routing.providerPriority) {
    if (!isProviderEligibleForAuto(store, pid)) continue
    if (store.isInCooldown(pid)) inCooldown.push(pid)
    else nonCooldown.push(pid)
  }
  for (const pid of nonCooldown) pushUnique(pid)
  for (const pid of inCooldown) pushUnique(pid)

  if (candidateIds.length === 0) {
    throw new ProviderRequestError(
      'No enabled AI provider is ready in Automatic mode. Configure an API key in AI Provider Settings or start local Ollama.',
      'not_configured',
    )
  }

  const maxAttempts = routing.fallbackEnabled ? candidateIds.length : 1
  const attempts: AiAttemptLog[] = []
  const { systemPrompt, userPrompt } = buildStudioPrompts(request)

  for (let i = 0; i < maxAttempts; i++) {
    const pid = candidateIds[i]
    const pub = store.getPublicProvider(pid)!
    const runtime = store.getRuntimeConfig(pid)!
    const adapter = getAdapterForFormat(pub.apiFormat)

    const preferredModel =
      taskRoute.providerId === pid && taskRoute.model
        ? taskRoute.model
        : routing.defaultProviderId === pid && routing.defaultModel
          ? routing.defaultModel
          : undefined

    let model = resolveModelForProvider(store, pid, preferredModel)
    if (!model && pid === 'ollama') {
      try {
        const models = await adapter.listModels(runtime, signal)
        model = models[0]?.name ?? ''
      } catch {
        model = ''
      }
    }

    if (!model) {
      attempts.push({
        providerId: pid,
        providerName: pub.name,
        model: '(none)',
        success: false,
        error: `No model configured or installed for ${pub.name}.`,
      })
      continue
    }

    try {
      const output = await adapter.generate(runtime, {
        model,
        systemPrompt,
        userPrompt,
        structuredJson: pub.capabilities.supportsStructuredJson,
        signal,
      })

      const { content, warnings } = parseGeneratedStudioResponse(
        output.rawText,
        request.platforms,
      )

      store.setRuntimeStatus(pid, {
        status: 'connected',
        statusMessage: `Connected (${output.model} ready).`,
      })

      attempts.push({
        providerId: pid,
        providerName: pub.name,
        model: output.model,
        success: true,
      })

      return {
        content,
        providerId: pid,
        providerName: pub.name,
        providerKind: pub.capabilities.kind,
        model: output.model,
        modeUsed: 'automatic',
        fallbackUsed: i > 0,
        attempts,
        usage: output.usage,
        warnings,
      }
    } catch (err) {
      const pErr = err instanceof ProviderRequestError ? err : null
      const cleanMessage = redactSecrets(
        err instanceof Error ? err.message : 'Generation failed.',
        store.getAllSecrets(),
      )
      store.setRuntimeStatus(pid, {
        status: 'error',
        statusMessage: cleanMessage,
        cooldownUntil:
          pErr?.code === 'rate_limited' || pErr?.code === 'connection_refused'
            ? Date.now() + COOLDOWN_MS
            : undefined,
      })
      attempts.push({
        providerId: pid,
        providerName: pub.name,
        model,
        success: false,
        error: cleanMessage,
      })
    }
  }

  const summary = attempts
    .map((a) => `${a.providerName}: ${a.error || 'Failed'}`)
    .join(' | ')
  throw new ProviderRequestError(
    `AI generation failed across ${attempts.length} ${attempts.length === 1 ? 'provider' : 'providers'}. ${summary}`,
    'http_error',
  )
}
