import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  X,
} from 'lucide-react'
import {
  STUDIO_LANGUAGE_OPTIONS,
  STUDIO_PLATFORM_OPTIONS,
  STUDIO_TONE_OPTIONS,
} from '../../config/studio'
import { useStudio } from '../../context/StudioContext'
import type {
  StudioLanguage,
  StudioPlatformSelection,
  StudioTone,
} from '../../types/studio'
import { Badge, Button, Card, Select, Tooltip } from '../ui'

/**
 * Configures language, platform target, tone, and triggers real local Ollama content generation.
 */
export function StudioSettingsPanel() {
  const {
    settings,
    updateSettings,
    connectionStatus,
    selectedModel,
    isGenerating,
    canGenerate,
    generationError,
    generationSuccess,
    generationWarnings,
    clearGenerationFeedback,
    generateContent,
  } = useStudio()

  const disabledReason =
    connectionStatus !== 'connected'
      ? 'Connect to your local Ollama service above to enable AI generation'
      : !selectedModel
        ? 'Select an installed Ollama model to enable AI generation'
        : 'Generate platform copy using your selected local Ollama model'

  return (
    <Card
      title="Content Settings & Generation"
      subtitle="Select target language, platform outputs, tone, and run local AI generation."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Language"
            value={settings.language}
            disabled={isGenerating}
            onChange={(event) =>
              updateSettings({ language: event.target.value as StudioLanguage })
            }
            options={STUDIO_LANGUAGE_OPTIONS}
          />

          <Select
            label="Platform"
            value={settings.platformSelection}
            disabled={isGenerating}
            onChange={(event) =>
              updateSettings({
                platformSelection: event.target.value as StudioPlatformSelection,
              })
            }
            options={STUDIO_PLATFORM_OPTIONS}
          />

          <Select
            label="Content Tone"
            value={settings.tone}
            disabled={isGenerating}
            onChange={(event) =>
              updateSettings({ tone: event.target.value as StudioTone })
            }
            options={STUDIO_TONE_OPTIONS}
          />
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-edge-subtle bg-elevated p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={connectionStatus === 'connected' ? 'success' : 'warning'}
                dot
              >
                {connectionStatus === 'connected'
                  ? `Ready · ${selectedModel || 'No model'}`
                  : 'Ollama Disconnected'}
              </Badge>
              <span className="text-xs font-medium text-content-primary">
                Local AI Copy Generation
              </span>
            </div>
            <p className="text-xs leading-relaxed text-content-secondary">
              Generates editable copy for your selected platforms only. Existing
              edits are preserved if a request fails.
            </p>
          </div>

          <Tooltip content={disabledReason} side="top">
            <span>
              <Button
                variant="primary"
                isLoading={isGenerating}
                disabled={!canGenerate}
                leftIcon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
                onClick={() => void generateContent()}
              >
                {isGenerating ? 'Generating...' : 'Generate with AI'}
              </Button>
            </span>
          </Tooltip>
        </div>

        {generationError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs text-danger"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{generationError}</p>
            </div>
            <button
              type="button"
              onClick={clearGenerationFeedback}
              className="rounded p-0.5 hover:bg-danger/15"
              aria-label="Dismiss generation error"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {generationSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="space-y-2 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-xs text-success"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="font-medium leading-relaxed">{generationSuccess}</p>
              </div>
              <button
                type="button"
                onClick={clearGenerationFeedback}
                className="rounded p-0.5 hover:bg-success/15"
                aria-label="Dismiss generation notice"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {generationWarnings.length > 0 && (
              <div className="flex items-start gap-2 border-t border-success/20 pt-2 text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p>{generationWarnings.join(' ')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
