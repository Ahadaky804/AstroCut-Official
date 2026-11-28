import { useState, type FormEvent } from 'react'
import { useAiProviders } from '../../context/AiProvidersContext'
import type { ProviderPublicConfig } from '../../types/ai'
import { Badge, Button, Input, Modal } from '../ui'

interface ProviderConfigModalProps {
  isOpen: boolean
  provider: ProviderPublicConfig | null
  onClose: () => void
}

function ProviderConfigForm({
  provider,
  onClose,
}: {
  provider: ProviderPublicConfig | null
  onClose: () => void
}) {
  const { saveProvider } = useAiProviders()
  const isNewCustom = !provider

  const [name, setName] = useState(provider?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel ?? '')
  const [apiKey, setApiKey] = useState('')
  const [clearSavedKey, setClearSavedKey] = useState(false)
  const [enabled, setEnabled] = useState(provider?.enabled ?? true)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isNewCustom && !name.trim()) {
      setFormError('Provider name is required.')
      return
    }
    if (!baseUrl.trim()) {
      setFormError('Base URL is required.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    try {
      await saveProvider({
        id: provider?.id,
        name: isNewCustom || provider?.isCustom ? name.trim() : undefined,
        baseUrl: baseUrl.trim(),
        defaultModel: defaultModel.trim(),
        apiKey: apiKey.trim() || undefined,
        clearApiKey: clearSavedKey,
        enabled,
        apiFormat: provider?.apiFormat ?? 'openai-compatible',
      })
      setApiKey('')
      onClose()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to save provider config.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {(isNewCustom || provider?.isCustom) && (
        <Input
          label="Provider Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="LM Studio Local / Together / Custom Gateway"
        />
      )}

      <Input
        label="API Base URL"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="https://api.example.com/v1"
        hint="Valid http:// or https:// endpoint."
      />

      <Input
        label="Default Model"
        value={defaultModel}
        onChange={(e) => setDefaultModel(e.target.value)}
        placeholder="e.g. gemini-2.5-flash, gpt-4o-mini, llama3.2:3b"
        hint="Used as default when generating or before model discovery."
      />

      {provider?.id !== 'ollama' && (
        <div className="space-y-2">
          <Input
            label="API Key (Stored Server-Side Only)"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              if (e.target.value) setClearSavedKey(false)
            }}
            placeholder={
              provider?.hasApiKey
                ? `Current: ${provider.maskedApiKey} (enter new key to replace)`
                : 'Paste API key (optional for local custom servers)'
            }
            hint={
              provider?.envVarName
                ? `Or set ${provider.envVarName} in .env.local on the server. Keys are never sent back to browser JS.`
                : 'Stored server-side in local configuration, never in localStorage or IndexedDB.'
            }
          />

          {provider?.keySource === 'config' && (
            <label className="inline-flex items-center gap-2 text-xs text-content-secondary">
              <input
                type="checkbox"
                checked={clearSavedKey}
                onChange={(e) => setClearSavedKey(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-edge-default accent-[var(--accent-primary)]"
              />
              <span>Clear saved config key (fall back to env var if set)</span>
            </label>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-edge-subtle bg-elevated px-3.5 py-2.5">
        <label
          htmlFor="provider-enabled-toggle"
          className="text-xs font-medium text-content-primary"
        >
          Enable provider for Studio &amp; Automatic routing
        </label>
        <input
          id="provider-enabled-toggle"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-edge-default accent-[var(--accent-primary)]"
        />
      </div>

      {isNewCustom && (
        <div className="flex items-center gap-2 text-xs text-content-secondary">
          <Badge variant="outline">openai-compatible</Badge>
          <span>Uses official OpenAI-compatible /models and /chat/completions endpoints.</span>
        </div>
      )}

      {formError && (
        <p role="alert" className="text-xs text-danger">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-edge-subtle pt-4">
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isSaving}>
          {isNewCustom ? 'Add Provider' : 'Save Configuration'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Modal for configuring built-in providers or adding a custom OpenAI-compatible provider.
 */
export function ProviderConfigModal({
  isOpen,
  provider,
  onClose,
}: ProviderConfigModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={provider ? `Configure ${provider.name}` : 'Add Custom Provider'}
      description={
        provider
          ? provider.description
          : 'Connect any custom OpenAI-compatible local or cloud API endpoint.'
      }
      size="md"
    >
      {isOpen && (
        <ProviderConfigForm
          key={provider?.id ?? 'new-custom'}
          provider={provider}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}
