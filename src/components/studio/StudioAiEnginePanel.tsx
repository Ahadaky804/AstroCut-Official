import {
  ArrowRight,
  BookOpen,
  Cloud,
  Cpu,
  PlugZap,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAiProviders } from '../../context/AiProvidersContext'
import { useStudio } from '../../context/StudioContext'
import type { ProviderId } from '../../types/ai'
import { Badge, buttonStyles, Button, Card, Select, type BadgeVariant } from '../ui'
import { OllamaSetupModal } from './OllamaSetupModal'

const STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  connected: { label: 'Connected', variant: 'success' },
  configured: { label: 'Configured', variant: 'primary' },
  disconnected: { label: 'Disconnected', variant: 'warning' },
  not_configured: { label: 'Not Configured', variant: 'neutral' },
  error: { label: 'Error', variant: 'danger' },
}

/**
 * Displays active Universal AI Provider routing mode, provider/model selection, and quick actions in Studio.
 */
export function StudioAiEnginePanel() {
  const {
    providers,
    routing,
    testingProviderId,
    refreshingProviderId,
    testConnection,
    refreshModels,
  } = useAiProviders()
  const {
    manualProviderId,
    setManualProviderId,
    manualModel,
    setManualModel,
    isGenerating,
  } = useStudio()

  const [isSetupOpen, setIsSetupOpen] = useState(false)

  const activeProvider =
    providers.find((p) => p.id === manualProviderId) ??
    providers.find((p) => p.id === routing?.defaultProviderId) ??
    providers[0]

  const isManual = routing?.mode === 'manual'
  const statusMeta = activeProvider
    ? STATUS_BADGE[activeProvider.status] ?? STATUS_BADGE.not_configured
    : STATUS_BADGE.not_configured
  const isLocal = activeProvider?.capabilities.kind === 'local'

  const modelOptions = (() => {
    const names = new Set<string>()
    for (const m of activeProvider?.discoveredModels ?? []) {
      names.add(m.name)
    }
    if (activeProvider?.defaultModel) names.add(activeProvider.defaultModel)
    if (manualModel) names.add(manualModel)
    const list = Array.from(names)
    if (list.length === 0) {
      return [
        {
          value: '',
          label: 'No models loaded (test connection or configure)',
          disabled: true,
        },
      ]
    }
    return list.map((m) => ({ value: m, label: m }))
  })()

  return (
    <>
      <Card
        title="AI Engine"
        subtitle={
          isManual
            ? 'Manual Mode: uses your exact selected provider and model.'
            : 'Automatic Mode: routes across eligible providers with optional fallback.'
        }
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              {isManual ? 'Manual Mode' : 'Automatic Mode'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setIsSetupOpen(true)}
            >
              Ollama Guide
            </Button>
            <Link
              to="/providers"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              <span>AI Provider Settings</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
            <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 lg:col-span-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent-soft text-accent">
                    {isLocal ? (
                      <Cpu className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Cloud className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-content-secondary">
                      {isManual ? 'Selected Provider' : 'Default Provider'}
                    </p>
                    <p className="truncate text-sm font-semibold text-content-primary">
                      {activeProvider?.name ?? 'Loading...'}
                    </p>
                  </div>
                </div>
                <Badge variant={statusMeta.variant} dot>
                  {statusMeta.label}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-content-muted">
                {isLocal ? 'Local · Zero API Cost' : 'Cloud API'} ·{' '}
                {routing?.fallbackEnabled
                  ? 'Fallback enabled'
                  : 'Fallback disabled'}
              </p>
            </div>

            {isManual ? (
              <>
                <div className="lg:col-span-3">
                  <Select
                    label="Provider (Manual)"
                    value={manualProviderId}
                    disabled={isGenerating}
                    onChange={(e) =>
                      setManualProviderId(e.target.value as ProviderId)
                    }
                    options={providers
                      .filter((p) => p.enabled)
                      .map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.capabilities.kind === 'local' ? 'Local' : 'Cloud'})`,
                      }))}
                  />
                </div>

                <div className="lg:col-span-3">
                  <Select
                    label="Model (Manual)"
                    value={manualModel}
                    disabled={isGenerating || modelOptions[0]?.value === ''}
                    onChange={(e) => setManualModel(e.target.value)}
                    options={modelOptions}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-edge-subtle bg-elevated/70 p-3.5 text-xs text-content-secondary lg:col-span-6">
                <p className="font-medium text-content-primary">
                  Automatic Provider Routing Active
                </p>
                <p className="mt-1 leading-relaxed">
                  Priority order:{' '}
                  {routing?.providerPriority
                    .map((id) => providers.find((p) => p.id === id))
                    .filter(
                      (p) =>
                        p &&
                        p.enabled &&
                        (!p.capabilities.requiresApiKey || p.hasApiKey),
                    )
                    .map((p) => p!.name)
                    .join(' → ') || 'No configured providers yet (configure in AI Provider Settings)'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
              {activeProvider && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={refreshingProviderId === activeProvider.id}
                    disabled={isGenerating}
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => void refreshModels(activeProvider.id)}
                  >
                    Models
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={testingProviderId === activeProvider.id}
                    disabled={isGenerating}
                    leftIcon={<PlugZap className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => void testConnection(activeProvider.id)}
                  >
                    Test
                  </Button>
                </>
              )}
            </div>
          </div>

          {activeProvider && (
            <p className="text-xs text-content-secondary">
              {activeProvider.statusMessage}
            </p>
          )}
        </div>
      </Card>

      <OllamaSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </>
  )
}
