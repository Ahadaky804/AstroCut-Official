import { AlertCircle, Plus, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import {
  ProviderCard,
  ProviderConfigModal,
  RoutingSettingsCard,
  TaskRoutingCard,
} from '../components/providers'
import {
  Badge,
  Button,
  Card,
  LoadingState,
  PageHeader,
} from '../components/ui'
import { useAiProviders } from '../context/AiProvidersContext'
import type { ProviderPublicConfig } from '../types/ai'

/**
 * AI Provider Settings page for configuring cloud/local AI providers, API keys, modes, and routing.
 */
export function ProvidersPage() {
  const { providers, routing, isLoading, error, clearError } = useAiProviders()
  const [editingProvider, setEditingProvider] =
    useState<ProviderPublicConfig | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const configuredCount = providers.filter(
    (p) => p.enabled && (!p.capabilities.requiresApiKey || p.hasApiKey),
  ).length

  const openNewCustomModal = () => {
    setEditingProvider(null)
    setIsModalOpen(true)
  }

  const openEditModal = (provider: ProviderPublicConfig) => {
    setEditingProvider(provider)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge variant="primary" dot>
            {configuredCount} of {providers.length} Ready
          </Badge>
        }
        title="AI Provider Settings"
        description="Connect Google Gemini, OpenAI, Claude, Groq, OpenRouter, DeepSeek, Mistral, local Ollama, or custom OpenAI-compatible APIs."
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={openNewCustomModal}
          >
            Add Custom Provider
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="rounded p-0.5 hover:bg-danger/15"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState
          label="Loading AI Provider Configuration..."
          description="Reading server-side provider status and routing preferences."
        />
      ) : (
        <>
          <RoutingSettingsCard />

          <section aria-label="Configured AI Providers" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-content-primary">
                  Connected &amp; Available Providers
                </h2>
                <p className="text-xs text-content-secondary">
                  Each adapter uses its official API format. Ollama remains
                  available for local zero-API-cost inference.
                </p>
              </div>
              <Badge variant="neutral">{providers.length} providers</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {providers.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isDefault={routing?.defaultProviderId === provider.id}
                  onConfigure={openEditModal}
                />
              ))}
            </div>
          </section>

          <TaskRoutingCard />

          <Card title="API Key Security & Cost Transparency">
            <div className="space-y-2.5 text-xs leading-relaxed text-content-secondary">
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <p>
                  API keys are stored only on the local Node server via{' '}
                  <code>.env.local</code> environment variables or{' '}
                  <code>.astrocut/providers.local.json</code> (gitignored). Keys
                  are never placed in <code>localStorage</code>,{' '}
                  <code>IndexedDB</code>, or frontend bundles, and are masked in
                  UI responses. Note: local config JSON on disk is not encrypted
                  at rest; prefer environment variables when sharing a machine.
                </p>
              </div>
              <p>
                Cloud AI providers (Gemini, OpenAI, Claude, Groq, OpenRouter,
                DeepSeek, Mistral) are external services that may have usage
                quotas or billing charges. Local Ollama runs on your PC with zero
                API fees.
              </p>
            </div>
          </Card>
        </>
      )}

      <ProviderConfigModal
        isOpen={isModalOpen}
        provider={editingProvider}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
