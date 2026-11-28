import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Cpu,
  Wand2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  STUDIO_LANGUAGE_OPTIONS,
  STUDIO_PLATFORM_OPTIONS,
  STUDIO_TONE_OPTIONS,
} from '../../config/studio'
import { useAiProviders } from '../../context/AiProvidersContext'
import { useStudio } from '../../context/StudioContext'
import type { AiTaskType } from '../../types/ai'
import type {
  StudioLanguage,
  StudioPlatformSelection,
  StudioTone,
} from '../../types/studio'
import { Badge, Button, buttonStyles, Card, Select, Tooltip } from '../ui'

const TASK_OPTIONS = [
  { value: 'auto', label: 'Auto-detect from settings' },
  { value: 'titles_descriptions', label: 'Titles & Descriptions' },
  { value: 'captions_hashtags', label: 'Captions & Hashtags' },
  { value: 'translation_roman_urdu', label: 'Translation & Roman Urdu / Hinglish' },
  { value: 'transcript_cleanup', label: 'Transcript Cleanup' },
  { value: 'video_summaries', label: 'Video Summaries (From Transcript)' },
]

/**
 * Configures language, platform target, tone, task routing, and triggers multi-provider AI generation.
 */
export function StudioSettingsPanel() {
  const { routing } = useAiProviders()
  const {
    selectedVideoId,
    settings,
    updateSettings,
    selectedTaskType,
    setSelectedTaskType,
    isGenerating,
    hasTranscript,
    canGenerate,
    generationError,
    generationResult,
    clearGenerationFeedback,
    generateContent,
  } = useStudio()

  const disabledReason = !hasTranscript
    ? 'Transcribe this video first in Video Transcription before generating AI content'
    : canGenerate
      ? 'Generate copy grounded in your saved transcript'
      : 'Configure or connect at least one eligible AI provider in AI Provider Settings'

  return (
    <Card
      title="Content Settings & Generation"
      subtitle="Select target language, platforms, tone, and run AI generation."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          <Select
            label="Task Routing"
            value={selectedTaskType}
            disabled={isGenerating}
            onChange={(event) =>
              setSelectedTaskType(event.target.value as AiTaskType | 'auto')
            }
            options={TASK_OPTIONS}
          />
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-edge-subtle bg-elevated p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={canGenerate ? 'success' : 'warning'} dot>
                {!hasTranscript
                  ? 'Transcribe Video First'
                  : canGenerate
                    ? 'Ready to Generate'
                    : 'Provider Setup Required'}
              </Badge>
              <span className="text-xs font-medium text-content-primary">
                {routing?.mode === 'manual' ? 'Manual Mode' : 'Automatic Mode'}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-content-secondary">
              {hasTranscript
                ? 'Generates editable copy grounded in the saved transcript. Existing edits are preserved if a request fails.'
                : 'A saved transcript is required so AI generates accurate content from real speech instead of guessing.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!hasTranscript && selectedVideoId && (
              <Link
                to={`/transcribe?video=${encodeURIComponent(selectedVideoId)}`}
                className={buttonStyles({ variant: 'outline', size: 'md' })}
              >
                Transcribe First
              </Link>
            )}
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

        {generationResult && (
          <div
            role="status"
            aria-live="polite"
            className="space-y-2.5 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-xs text-success"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-semibold">
                  Generated by {generationResult.providerName} ·{' '}
                  {generationResult.model}
                </span>
                <Badge
                  variant="neutral"
                  icon={
                    generationResult.providerKind === 'local' ? (
                      <Cpu className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Cloud className="h-3 w-3" aria-hidden="true" />
                    )
                  }
                >
                  {generationResult.providerKind === 'local'
                    ? 'Local (Zero API Cost)'
                    : 'Cloud API'}
                </Badge>
                {generationResult.fallbackUsed && (
                  <Badge variant="warning">Fallback Used</Badge>
                )}
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

            {generationResult.usage && (
              <p className="text-[11px] text-content-secondary tabular-nums">
                Reported token usage:{' '}
                {generationResult.usage.promptTokens !== undefined
                  ? `${generationResult.usage.promptTokens} prompt`
                  : ''}
                {generationResult.usage.completionTokens !== undefined
                  ? ` · ${generationResult.usage.completionTokens} completion`
                  : ''}
                {generationResult.usage.totalTokens !== undefined
                  ? ` · ${generationResult.usage.totalTokens} total`
                  : ''}
              </p>
            )}

            {generationResult.warnings &&
              generationResult.warnings.length > 0 && (
                <div className="flex items-start gap-2 border-t border-success/20 pt-2 text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <p>{generationResult.warnings.join(' ')}</p>
                </div>
              )}
          </div>
        )}
      </div>
    </Card>
  )
}
