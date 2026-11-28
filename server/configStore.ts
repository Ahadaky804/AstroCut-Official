import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {
  AiModelInfo,
  AiRoutingSettings,
  AiSystemSnapshot,
  AiTaskType,
  ProviderConnectionStatus,
  ProviderId,
  ProviderPublicConfig,
  ProviderUpsertPayload,
} from '../src/types/ai.ts'
import { loadServerEnv, maskApiKey } from './envLoader.ts'
import {
  BUILT_IN_PROVIDERS,
  getBuiltInDefinition,
  isLocalhostUrl,
  isValidHttpUrl,
} from './providerRegistry.ts'
import type { ServerProviderRuntimeConfig } from './providers/types.ts'

interface PersistedProviderEntry {
  id: ProviderId
  name?: string
  description?: string
  isCustom?: boolean
  apiFormat?: 'openai-compatible' | 'gemini' | 'anthropic' | 'ollama'
  enabled: boolean
  baseUrl: string
  apiKey?: string
  defaultModel: string
  discoveredModels?: AiModelInfo[]
  lastCheckedAt?: string
  discoveryFailed?: boolean
}

interface PersistedConfigFile {
  providers: Record<string, PersistedProviderEntry>
  routing: AiRoutingSettings
}

interface ProviderRuntimeStatus {
  status: ProviderConnectionStatus
  statusMessage: string
  discoveredModels: AiModelInfo[]
  discoveryFailed?: boolean
  lastCheckedAt?: string
  cooldownUntil?: number
}

const DEFAULT_TASK_ROUTES: AiRoutingSettings['taskRoutes'] = {
  titles_descriptions: { providerId: 'default', model: '' },
  captions_hashtags: { providerId: 'default', model: '' },
  video_summaries: { providerId: 'default', model: '' },
  transcript_cleanup: { providerId: 'default', model: '' },
  translation_roman_urdu: { providerId: 'default', model: '' },
}

function createDefaultRouting(): AiRoutingSettings {
  return {
    mode: 'automatic',
    defaultProviderId: 'ollama',
    defaultModel: '',
    fallbackEnabled: true,
    providerPriority: BUILT_IN_PROVIDERS.map((p) => p.id),
    taskRoutes: { ...DEFAULT_TASK_ROUTES },
  }
}

export class ServerConfigStore {
  private readonly configPath: string
  private data: PersistedConfigFile
  private readonly runtimeStatus = new Map<string, ProviderRuntimeStatus>()

  constructor(rootDir: string = process.cwd()) {
    loadServerEnv(rootDir)
    this.configPath = resolve(rootDir, '.astrocut', 'providers.local.json')
    this.data = this.loadFromDisk()
  }

  private loadFromDisk(): PersistedConfigFile {
    const defaults: PersistedConfigFile = {
      providers: {},
      routing: createDefaultRouting(),
    }

    if (!existsSync(this.configPath)) {
      return defaults
    }

    try {
      const raw = readFileSync(this.configPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedConfigFile>
      return {
        providers: parsed.providers ?? {},
        routing: {
          ...defaults.routing,
          ...(parsed.routing ?? {}),
          taskRoutes: {
            ...DEFAULT_TASK_ROUTES,
            ...(parsed.routing?.taskRoutes ?? {}),
          },
        },
      }
    } catch {
      return defaults
    }
  }

  private saveToDisk(): void {
    const dir = dirname(this.configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf8')
  }

  getAllSecrets(): string[] {
    const secrets: string[] = []
    for (const def of BUILT_IN_PROVIDERS) {
      if (def.envVarName && def.id !== 'ollama') {
        const val = process.env[def.envVarName]
        if (val) secrets.push(val)
      }
    }
    for (const entry of Object.values(this.data.providers)) {
      if (entry.apiKey) secrets.push(entry.apiKey)
    }
    return secrets
  }

  private resolveKeyInfo(id: ProviderId): {
    apiKey?: string
    source: 'env' | 'config' | 'none'
  } {
    const stored = this.data.providers[id]?.apiKey?.trim()
    if (stored) {
      return { apiKey: stored, source: 'config' }
    }
    const builtIn = getBuiltInDefinition(id)
    if (builtIn?.envVarName && builtIn.id !== 'ollama') {
      const envVal = process.env[builtIn.envVarName]?.trim()
      if (envVal) {
        return { apiKey: envVal, source: 'env' }
      }
    }
    return { source: 'none' }
  }

  getRuntimeConfig(id: ProviderId): ServerProviderRuntimeConfig | null {
    const builtIn = getBuiltInDefinition(id)
    const entry = this.data.providers[id]

    if (builtIn) {
      const envUrl =
        builtIn.id === 'ollama' && process.env.OLLAMA_BASE_URL?.trim()
          ? process.env.OLLAMA_BASE_URL.trim()
          : builtIn.defaultBaseUrl
      const { apiKey } = this.resolveKeyInfo(id)
      return {
        id: builtIn.id,
        name: builtIn.name,
        baseUrl: entry?.baseUrl || envUrl,
        apiKey,
        defaultModel: entry?.defaultModel ?? builtIn.defaultModel,
        capabilities: builtIn.capabilities,
        extraHeaders: builtIn.extraHeaders,
      }
    }

    if (!entry) return null
    return {
      id: entry.id,
      name: entry.name || 'Custom OpenAI-Compatible',
      baseUrl: entry.baseUrl,
      apiKey: entry.apiKey,
      defaultModel: entry.defaultModel,
      capabilities: {
        kind: isLocalhostUrl(entry.baseUrl) ? 'local' : 'cloud',
        supportsModelDiscovery: true,
        supportsStructuredJson: true,
        supportsStreaming: true,
        supportsUsageMetrics: true,
        supportsVideoInput: false,
        requiresApiKey: false,
      },
    }
  }

  getPublicProvider(id: ProviderId): ProviderPublicConfig | null {
    const builtIn = getBuiltInDefinition(id)
    const entry = this.data.providers[id]
    const runtime = this.runtimeStatus.get(id)

    if (builtIn) {
      const keyInfo = this.resolveKeyInfo(id)
      const envUrl =
        builtIn.id === 'ollama' && process.env.OLLAMA_BASE_URL?.trim()
          ? process.env.OLLAMA_BASE_URL.trim()
          : builtIn.defaultBaseUrl
      const baseUrl = entry?.baseUrl || envUrl
      const enabled = entry?.enabled ?? true
      const hasKey = Boolean(keyInfo.apiKey)

      const fallbackStatus: ProviderConnectionStatus = builtIn.capabilities
        .requiresApiKey
        ? hasKey
          ? 'configured'
          : 'not_configured'
        : 'disconnected'

      const fallbackMessage = builtIn.capabilities.requiresApiKey
        ? hasKey
          ? `API key configured (${keyInfo.source === 'env' ? builtIn.envVarName : 'server config'}). Click Test Connection to verify.`
          : `No API key configured. Set ${builtIn.envVarName} or add a key below.`
        : 'Local provider ready to test. Click Test Connection to verify Ollama is running.'

      const persistedModels = entry?.discoveredModels ?? []
      const discoveredModels = runtime?.discoveredModels ?? persistedModels
      const lastCheckedAt = runtime?.lastCheckedAt ?? entry?.lastCheckedAt
      const discoveryFailed =
        runtime?.discoveryFailed ?? entry?.discoveryFailed ?? false

      const persistedFallbackMessage = discoveryFailed
        ? 'Previous model discovery failed. Click Test Connection or Models to retry.'
        : persistedModels.length > 0
          ? `${fallbackMessage} (${persistedModels.length} saved model${persistedModels.length === 1 ? '' : 's'} from last check.)`
          : fallbackMessage

      return {
        id: builtIn.id,
        name: builtIn.name,
        description: builtIn.description,
        apiFormat: builtIn.apiFormat,
        isCustom: false,
        enabled,
        baseUrl,
        defaultModel: entry?.defaultModel ?? builtIn.defaultModel,
        hasApiKey: hasKey,
        maskedApiKey: maskApiKey(keyInfo.apiKey),
        keySource: keyInfo.source,
        envVarName: builtIn.envVarName,
        capabilities: builtIn.capabilities,
        status: runtime?.status ?? fallbackStatus,
        statusMessage: runtime?.statusMessage ?? persistedFallbackMessage,
        discoveredModels,
        discoveryFailed,
        lastCheckedAt,
        implementationStatus: 'implemented',
      }
    }

    if (!entry) return null
    const hasKey = Boolean(entry.apiKey?.trim())
    const isLocal = isLocalhostUrl(entry.baseUrl)
    return {
      id: entry.id,
      name: entry.name || 'Custom OpenAI-Compatible',
      description:
        entry.description ||
        'Custom OpenAI-compatible API endpoint configured by user.',
      apiFormat: 'openai-compatible',
      isCustom: true,
      enabled: entry.enabled,
      baseUrl: entry.baseUrl,
      defaultModel: entry.defaultModel,
      hasApiKey: hasKey,
      maskedApiKey: maskApiKey(entry.apiKey),
      keySource: hasKey ? 'config' : 'none',
      capabilities: {
        kind: isLocal ? 'local' : 'cloud',
        supportsModelDiscovery: true,
        supportsStructuredJson: true,
        supportsStreaming: true,
        supportsUsageMetrics: true,
        supportsVideoInput: false,
        requiresApiKey: false,
      },
      status: runtime?.status ?? (hasKey || isLocal ? 'configured' : 'not_configured'),
      statusMessage:
        runtime?.statusMessage ??
        (entry?.discoveryFailed
          ? 'Previous model discovery failed. Click Test Connection or Models to retry.'
          : entry?.discoveredModels?.length
            ? `Custom OpenAI-compatible endpoint saved (${entry.discoveredModels.length} saved model${entry.discoveredModels.length === 1 ? '' : 's'} from last check).`
            : 'Custom OpenAI-compatible endpoint saved. Click Test Connection to verify.'),
      discoveredModels: runtime?.discoveredModels ?? entry?.discoveredModels ?? [],
      discoveryFailed: runtime?.discoveryFailed ?? entry?.discoveryFailed ?? false,
      lastCheckedAt: runtime?.lastCheckedAt ?? entry?.lastCheckedAt,
      implementationStatus: 'implemented',
    }
  }

  getSnapshot(): AiSystemSnapshot {
    const providers: ProviderPublicConfig[] = []
    for (const def of BUILT_IN_PROVIDERS) {
      const pub = this.getPublicProvider(def.id)
      if (pub) providers.push(pub)
    }
    for (const key of Object.keys(this.data.providers)) {
      if (!getBuiltInDefinition(key as ProviderId)) {
        const pub = this.getPublicProvider(key as ProviderId)
        if (pub) providers.push(pub)
      }
    }

    const validIds = new Set(providers.map((p) => p.id))
    const priority = this.data.routing.providerPriority.filter((id) =>
      validIds.has(id),
    )
    for (const p of providers) {
      if (!priority.includes(p.id)) priority.push(p.id)
    }

    return {
      providers,
      routing: {
        ...this.data.routing,
        providerPriority: priority,
      },
    }
  }

  upsertProvider(payload: ProviderUpsertPayload): ProviderPublicConfig {
    let targetId = payload.id
    const isBuiltIn = Boolean(targetId && getBuiltInDefinition(targetId))

    if (!targetId) {
      const slug = (payload.name || 'custom')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 24)
      targetId = `custom-${slug || 'endpoint'}-${Date.now().toString(36)}` as ProviderId
    }

    const existing = this.data.providers[targetId]
    const builtIn = getBuiltInDefinition(targetId)

    const nextBaseUrl =
      payload.baseUrl !== undefined
        ? payload.baseUrl.trim()
        : (existing?.baseUrl ?? builtIn?.defaultBaseUrl ?? '')

    if (!isValidHttpUrl(nextBaseUrl)) {
      throw new Error(
        'Base URL must be a valid http:// or https:// endpoint.',
      )
    }

    let nextApiKey = existing?.apiKey
    if (payload.clearApiKey) {
      nextApiKey = undefined
    } else if (payload.apiKey !== undefined && payload.apiKey.trim() !== '') {
      nextApiKey = payload.apiKey.trim()
    }

    const normalizedNextBaseUrl = nextBaseUrl.replace(/\/+$/, '')
    const previousBaseUrl = (
      existing?.baseUrl ??
      builtIn?.defaultBaseUrl ??
      ''
    ).replace(/\/+$/, '')

    const credentialsOrEndpointChanged =
      (payload.apiKey !== undefined &&
        payload.apiKey.trim() !== '' &&
        payload.apiKey.trim() !== existing?.apiKey) ||
      Boolean(payload.clearApiKey) ||
      (payload.baseUrl !== undefined && normalizedNextBaseUrl !== previousBaseUrl)

    const nextEntry: PersistedProviderEntry = {
      id: targetId,
      isCustom: !isBuiltIn,
      name: isBuiltIn
        ? builtIn!.name
        : payload.name?.trim() || existing?.name || 'Custom Provider',
      apiFormat: isBuiltIn ? builtIn!.apiFormat : 'openai-compatible',
      enabled: payload.enabled ?? existing?.enabled ?? true,
      baseUrl: normalizedNextBaseUrl,
      apiKey: nextApiKey,
      defaultModel:
        payload.defaultModel !== undefined
          ? payload.defaultModel.trim()
          : (existing?.defaultModel ?? builtIn?.defaultModel ?? ''),
      discoveredModels: credentialsOrEndpointChanged
        ? undefined
        : existing?.discoveredModels,
      lastCheckedAt: credentialsOrEndpointChanged
        ? undefined
        : existing?.lastCheckedAt,
      discoveryFailed: credentialsOrEndpointChanged
        ? false
        : existing?.discoveryFailed,
    }

    this.data.providers[targetId] = nextEntry
    if (!this.data.routing.providerPriority.includes(targetId)) {
      this.data.routing.providerPriority.push(targetId)
    }
    this.saveToDisk()

    // Reset stale connection status only if credentials or endpoint actually changed
    if (credentialsOrEndpointChanged) {
      this.runtimeStatus.delete(targetId)
    }

    return this.getPublicProvider(targetId)!
  }

  deleteProvider(id: ProviderId): void {
    if (getBuiltInDefinition(id)) {
      // For built-in providers, clearing stored overrides/key resets them safely
      delete this.data.providers[id]
      this.runtimeStatus.delete(id)
      this.saveToDisk()
      return
    }

    delete this.data.providers[id]
    this.runtimeStatus.delete(id)
    this.data.routing.providerPriority =
      this.data.routing.providerPriority.filter((pid) => pid !== id)
    if (this.data.routing.defaultProviderId === id) {
      this.data.routing.defaultProviderId = 'ollama'
      this.data.routing.defaultModel = ''
    }
    for (const taskKey of Object.keys(
      this.data.routing.taskRoutes,
    ) as AiTaskType[]) {
      if (this.data.routing.taskRoutes[taskKey].providerId === id) {
        this.data.routing.taskRoutes[taskKey] = {
          providerId: 'default',
          model: '',
        }
      }
    }
    this.saveToDisk()
  }

  updateRouting(patch: Partial<AiRoutingSettings>): AiRoutingSettings {
    const next: AiRoutingSettings = {
      ...this.data.routing,
      ...patch,
      taskRoutes: {
        ...this.data.routing.taskRoutes,
        ...(patch.taskRoutes ?? {}),
      },
    }
    this.data.routing = next
    this.saveToDisk()
    return next
  }

  setRuntimeStatus(
    id: ProviderId,
    update: Partial<ProviderRuntimeStatus> & {
      status: ProviderConnectionStatus
      statusMessage: string
    },
  ): void {
    const prev = this.runtimeStatus.get(id)
    const nextModels =
      update.discoveredModels ?? prev?.discoveredModels ?? this.data.providers[id]?.discoveredModels ?? []
    const nextCheckedAt = update.lastCheckedAt ?? new Date().toISOString()
    const nextDiscoveryFailed =
      update.discoveryFailed ??
      prev?.discoveryFailed ??
      this.data.providers[id]?.discoveryFailed ??
      false

    this.runtimeStatus.set(id, {
      status: update.status,
      statusMessage: update.statusMessage,
      discoveredModels: nextModels,
      discoveryFailed: nextDiscoveryFailed,
      lastCheckedAt: nextCheckedAt,
      cooldownUntil: update.cooldownUntil,
    })

    const builtIn = getBuiltInDefinition(id)
    const existing = this.data.providers[id]
    if (existing || builtIn) {
      const envUrl =
        builtIn?.id === 'ollama' && process.env.OLLAMA_BASE_URL?.trim()
          ? process.env.OLLAMA_BASE_URL.trim()
          : builtIn?.defaultBaseUrl ?? ''

      this.data.providers[id] = {
        id,
        isCustom: existing?.isCustom ?? !builtIn,
        name: existing?.name ?? builtIn?.name,
        apiFormat: existing?.apiFormat ?? builtIn?.apiFormat,
        enabled: existing?.enabled ?? true,
        baseUrl: existing?.baseUrl ?? envUrl,
        apiKey: existing?.apiKey,
        defaultModel: existing?.defaultModel ?? builtIn?.defaultModel ?? '',
        discoveredModels: nextModels,
        lastCheckedAt: nextCheckedAt,
        discoveryFailed: nextDiscoveryFailed,
      }
      this.saveToDisk()
    }
  }

  isInCooldown(id: ProviderId): boolean {
    const until = this.runtimeStatus.get(id)?.cooldownUntil
    return Boolean(until && until > Date.now())
  }
}
