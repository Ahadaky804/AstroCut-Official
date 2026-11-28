import {
  BookOpen,
  Cpu,
  PlugZap,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useStudio } from '../../context/StudioContext'
import { DEFAULT_OLLAMA_BASE_URL } from '../../services/ollamaProvider'
import { formatFileSize } from '../../utils/videoFormat'
import { Badge, Button, Card, Input, Select, type BadgeVariant } from '../ui'
import { OllamaSetupModal } from './OllamaSetupModal'

const STATUS_BADGE: Record<
  'disconnected' | 'checking' | 'connected' | 'error',
  { label: string; variant: BadgeVariant }
> = {
  connected: { label: 'Connected', variant: 'success' },
  disconnected: { label: 'Disconnected', variant: 'danger' },
  checking: { label: 'Checking...', variant: 'secondary' },
  error: { label: 'Error', variant: 'danger' },
}

/**
 * Local AI Engine configuration panel for Ollama connection testing and model discovery.
 */
export function StudioAiEnginePanel() {
  const {
    providerName,
    ollamaBaseUrl,
    setOllamaBaseUrl,
    connectionStatus,
    connectionMessage,
    installedModels,
    selectedModel,
    setSelectedModel,
    isRefreshingModels,
    isGenerating,
    testConnection,
    refreshModels,
  } = useStudio()

  const [endpointDraft, setEndpointDraft] = useState(ollamaBaseUrl)
  const [isSetupOpen, setIsSetupOpen] = useState(false)

  const statusMeta = STATUS_BADGE[connectionStatus]

  const modelOptions =
    installedModels.length > 0
      ? installedModels.map((model) => {
          const details = [
            model.parameterSize,
            model.sizeBytes ? formatFileSize(model.sizeBytes) : undefined,
          ]
            .filter(Boolean)
            .join(' · ')
          return {
            value: model.name,
            label: details ? `${model.name} (${details})` : model.name,
          }
        })
      : [
          {
            value: '',
            label:
              connectionStatus === 'connected'
                ? 'No models installed in Ollama'
                : 'Connect to Ollama to load installed models',
            disabled: true,
          },
        ]

  const handleApplyEndpoint = (event: FormEvent) => {
    event.preventDefault()
    setOllamaBaseUrl(endpointDraft)
  }

  return (
    <>
      <Card
        title="AI Engine"
        subtitle="Connect AstroCut to your local Ollama service for zero-cost, private copy generation."
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusMeta.variant} dot>
              {statusMeta.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setIsSetupOpen(true)}
            >
              Setup Guide
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
            <div className="rounded-xl border border-edge-subtle bg-elevated p-3.5 lg:col-span-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent-soft text-accent">
                  <Cpu className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-content-secondary">Provider</p>
                  <p className="truncate text-sm font-semibold text-content-primary">
                    {providerName}
                  </p>
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-content-muted">
                Selected model:{' '}
                <span className="font-medium text-content-primary">
                  {selectedModel || 'None selected'}
                </span>
              </p>
            </div>

            <div className="lg:col-span-5">
              <Select
                label="Installed Model"
                value={selectedModel}
                disabled={installedModels.length === 0 || isGenerating}
                onChange={(event) => setSelectedModel(event.target.value)}
                options={modelOptions}
                hint="Discovered dynamically from your local Ollama installation."
              />
            </div>

            <div className="flex flex-wrap gap-2 lg:col-span-3 lg:justify-end">
              <Button
                variant="outline"
                size="md"
                isLoading={isRefreshingModels}
                disabled={isGenerating}
                leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                onClick={() => void refreshModels()}
              >
                Refresh Models
              </Button>
              <Button
                variant="secondary"
                size="md"
                isLoading={connectionStatus === 'checking'}
                disabled={isGenerating}
                leftIcon={<PlugZap className="h-4 w-4" aria-hidden="true" />}
                onClick={() => void testConnection()}
              >
                Test Connection
              </Button>
            </div>
          </div>

          <form
            onSubmit={handleApplyEndpoint}
            className="flex flex-col gap-2.5 rounded-xl border border-edge-subtle bg-elevated/60 p-3.5 sm:flex-row sm:items-end"
          >
            <Input
              label="Local Ollama URL"
              value={endpointDraft}
              onChange={(event) => setEndpointDraft(event.target.value)}
              placeholder={DEFAULT_OLLAMA_BASE_URL}
              containerClassName="flex-1"
              disabled={isGenerating}
            />
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="outline"
                size="md"
                disabled={isGenerating || endpointDraft.trim() === ollamaBaseUrl}
              >
                Apply URL
              </Button>
              {ollamaBaseUrl !== DEFAULT_OLLAMA_BASE_URL && (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={isGenerating}
                  onClick={() => {
                    setEndpointDraft(DEFAULT_OLLAMA_BASE_URL)
                    setOllamaBaseUrl(DEFAULT_OLLAMA_BASE_URL)
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>

          <div
            role={connectionStatus === 'disconnected' ? 'status' : undefined}
            className="flex flex-col justify-between gap-2 rounded-xl border border-edge-subtle bg-elevated/45 px-4 py-3 text-xs sm:flex-row sm:items-center"
          >
            <p
              className={
                connectionStatus === 'connected'
                  ? 'text-success font-medium'
                  : 'text-content-secondary'
              }
            >
              {connectionMessage}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-content-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              <span>Local only · CPU fallback supported</span>
            </span>
          </div>
        </div>
      </Card>

      <OllamaSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </>
  )
}
