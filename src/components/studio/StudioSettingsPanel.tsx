import { Sparkles, Wand2 } from 'lucide-react'
import {
  STUDIO_LANGUAGE_OPTIONS,
  STUDIO_PLATFORM_OPTIONS,
  STUDIO_TONE_OPTIONS,
} from '../../config/studio'
import { useStudio } from '../../context/StudioContext'
import { unconfiguredAiProvider } from '../../services/aiProvider'
import type {
  StudioLanguage,
  StudioPlatformSelection,
  StudioTone,
} from '../../types/studio'
import { Badge, Button, Card, Select, Tooltip } from '../ui'

/**
 * Configures language, platform target, and tone alongside the honest Phase 5 AI provider status.
 */
export function StudioSettingsPanel() {
  const { settings, updateSettings } = useStudio()

  return (
    <Card
      title="Content Settings"
      subtitle="Select target language, platform outputs, and desired content tone."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Language"
            value={settings.language}
            onChange={(event) =>
              updateSettings({ language: event.target.value as StudioLanguage })
            }
            options={STUDIO_LANGUAGE_OPTIONS}
          />

          <Select
            label="Platform"
            value={settings.platformSelection}
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
            onChange={(event) =>
              updateSettings({ tone: event.target.value as StudioTone })
            }
            options={STUDIO_TONE_OPTIONS}
          />
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-edge-subtle bg-elevated p-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="warning"
                dot
                icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}
              >
                AI Not Connected · Phase 6
              </Badge>
              <span className="text-xs font-medium text-content-primary">
                {unconfiguredAiProvider.name}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-content-secondary">
              {unconfiguredAiProvider.statusMessage}
            </p>
          </div>

          <Tooltip
            content="Available in Phase 6 once an AI model provider is connected"
            side="top"
          >
            <span>
              <Button
                variant="primary"
                disabled={!unconfiguredAiProvider.isConfigured}
                leftIcon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
              >
                Generate with AI
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </Card>
  )
}
