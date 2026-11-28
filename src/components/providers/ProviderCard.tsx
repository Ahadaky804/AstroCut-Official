import {
  Cloud,
  Cpu,
  KeyRound,
  PlugZap,
  RefreshCw,
  Settings2,
  Star,
  Trash2,
} from 'lucide-react'
import { useAiProviders } from '../../context/AiProvidersContext'
import type { ProviderConnectionStatus, ProviderPublicConfig } from '../../types/ai'
import { Badge, Button, Card, Select, Tooltip, type BadgeVariant } from '../ui'

interface ProviderCardProps {
  provider: ProviderPublicConfig
  isDefault: boolean
  onConfigure: (provider: ProviderPublicConfig) => void
}

const STATUS_BADGE_MAP: Record<
  ProviderConnectionStatus,
  { label: string; variant: BadgeVariant }
> = {
  connected: { label: 'Connected', variant: 'success' },
  configured: { label: 'Key Configured', variant: 'primary' },
  disconnected: { label: 'Disconnected', variant: 'warning' },
  not_configured: { label: 'Not Configured', variant: 'neutral' },
  error: { label: 'Error', variant: 'danger' },
}

/**
 * Displays a single AI provider's status, local/cloud indicator, masked key, model selector, and actions.
 */
export function ProviderCard({
  provider,
  isDefault,
  onConfigure,
}: ProviderCardProps) {
  const {
    testingProviderId,
    refreshingProviderId,
    saveProvider,
    deleteProvider,
    testConnection,
    refreshModels,
    updateRouting,
  } = useAiProviders()

  const statusMeta = STATUS_BADGE_MAP[provider.status]
  const isLocal = provider.capabilities.kind === 'local'
  const isTesting = testingProviderId === provider.id
  const isRefreshing = refreshingProviderId === provider.id

  const modelOptions = (() => {
    const names = new Set<string>()
    for (const m of provider.discoveredModels) {
      names.add(m.name)
    }
    if (provider.defaultModel) {
      names.add(provider.defaultModel)
    }
    const list = Array.from(names)
    if (list.length === 0) {
      return [
        {
          value: '',
          label: 'No models loaded (Test Connection or Configure)',
          disabled: true,
        },
      ]
    }
    return list.map((name) => ({ value: name, label: name }))
  })()

  return (
    <Card
      variant="default"
      className={!provider.enabled ? 'opacity-70' : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-content-primary">
                {provider.name}
              </h3>

              <Badge
                variant={isLocal ? 'secondary' : 'outline'}
                icon={
                  isLocal ? (
                    <Cpu className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Cloud className="h-3 w-3" aria-hidden="true" />
                  )
                }
              >
                {isLocal ? 'Local · Zero API Cost' : 'Cloud'}
              </Badge>

              {isDefault && (
                <Badge
                  variant="primary"
                  icon={<Star className="h-3 w-3" aria-hidden="true" />}
                >
                  Default
                </Badge>
              )}
            </div>

            <p className="text-xs leading-relaxed text-content-secondary">
              {provider.description}
            </p>
          </div>

          <Badge variant={statusMeta.variant} dot>
            {statusMeta.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-edge-subtle bg-elevated p-3.5 text-xs sm:grid-cols-2">
          <div>
            <span className="text-content-muted">Endpoint &amp; Format</span>
            <p className="mt-0.5 truncate font-mono text-[11px] text-content-primary">
              {provider.baseUrl}
            </p>
            <p className="mt-0.5 text-[11px] text-content-secondary">
              Adapter: {provider.apiFormat}
            </p>
          </div>

          <div>
            <span className="text-content-muted">Credentials</span>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-content-primary">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
              {provider.capabilities.requiresApiKey || provider.hasApiKey ? (
                provider.hasApiKey ? (
                  <span>
                    {provider.maskedApiKey} ({provider.keySource})
                  </span>
                ) : (
                  <span className="font-sans text-content-secondary">
                    Not set ({provider.envVarName || 'Server config'})
                  </span>
                )
              ) : (
                <span className="font-sans text-content-secondary">
                  No API key required
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-6">
            <Select
              label="Active Model"
              value={provider.defaultModel || provider.discoveredModels[0]?.name || ''}
              options={modelOptions}
              disabled={modelOptions[0]?.value === ''}
              onChange={(event) =>
                void saveProvider({
                  id: provider.id,
                  defaultModel: event.target.value,
                })
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-6 sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              isLoading={isTesting}
              leftIcon={<PlugZap className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => void testConnection(provider.id)}
            >
              Test
            </Button>

            <Tooltip content="Fetch available models from provider API">
              <Button
                variant="outline"
                size="sm"
                isLoading={isRefreshing}
                leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void refreshModels(provider.id)}
              >
                Models
              </Button>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Settings2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => onConfigure(provider)}
            >
              Configure
            </Button>

            {!isDefault && provider.enabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void updateRouting({
                    defaultProviderId: provider.id,
                    defaultModel:
                      provider.defaultModel ||
                      provider.discoveredModels[0]?.name ||
                      '',
                  })
                }
              >
                Set Default
              </Button>
            )}

            {provider.isCustom && (
              <Tooltip content="Remove custom provider">
                <Button
                  variant="danger"
                  size="icon"
                  aria-label={`Remove ${provider.name}`}
                  onClick={() => void deleteProvider(provider.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        <p
          className={
            provider.status === 'error'
              ? 'text-xs text-danger'
              : provider.status === 'connected'
                ? 'text-xs text-success'
                : 'text-xs text-content-secondary'
          }
        >
          {provider.statusMessage}
        </p>
      </div>
    </Card>
  )
}
