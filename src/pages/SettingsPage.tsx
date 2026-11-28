import { Check, Info, Moon, RotateCcw, Shield, Sun } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
} from '../components/ui'
import { APP_META } from '../config/navigation'
import { useTheme, type ThemeMode } from '../context/ThemeContext'
import { cn } from '../utils/cn'

const THEME_PRESETS: Array<{
  mode: ThemeMode
  title: string
  subtitle: string
  swatchCanvas: string
  swatchCard: string
  swatchAccent: string
}> = [
  {
    mode: 'dark',
    title: 'Obsidian Dark',
    subtitle: 'Deep navy-black surfaces with electric blue focus.',
    swatchCanvas: '#0B1220',
    swatchCard: '#151F32',
    swatchAccent: '#4D9FFF',
  },
  {
    mode: 'light',
    title: 'Cool Slate Light',
    subtitle: 'Soft cool canvas with crisp white cards and slate-blue edges.',
    swatchCanvas: '#F4F7FB',
    swatchCard: '#FFFFFF',
    swatchAccent: '#2878D0',
  },
]

/**
 * Settings page providing persistent Obsidian Blue theme switching and non-sensitive workspace metadata.
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge
            variant="primary"
            icon={
              theme === 'dark' ? (
                <Moon className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Sun className="h-3 w-3" aria-hidden="true" />
              )
            }
          >
            {theme === 'dark' ? 'Obsidian Dark' : 'Cool Light'}
          </Badge>
        }
        title="Workspace Settings"
        description="Manage visual theme preferences and review non-sensitive workspace details."
      />

      <Card
        title="Appearance & Theme"
        subtitle="Obsidian Dark is the default AstroCut theme. Your selection persists locally in this browser."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-content-secondary">
              Active token set:{' '}
              <span className="font-medium text-content-primary">
                {theme === 'dark' ? 'Obsidian Dark' : 'Cool Light'}
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              disabled={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              Reset to Dark Default
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            {THEME_PRESETS.map((preset) => {
              const isSelected = theme === preset.mode
              return (
                <button
                  key={preset.mode}
                  type="button"
                  onClick={() => setTheme(preset.mode)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors duration-150',
                    isSelected
                      ? 'border-accent bg-accent-soft'
                      : 'border-edge-subtle bg-elevated hover:border-edge-strong',
                  )}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-8 items-center justify-end rounded-md border border-black/15 p-1"
                        style={{ backgroundColor: preset.swatchCanvas }}
                        aria-hidden="true"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: preset.swatchAccent }}
                        />
                      </span>
                      <span className="text-sm font-semibold text-content-primary">
                        {preset.title}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-content-secondary">
                      {preset.subtitle}
                    </p>
                  </div>

                  {isSelected && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="max-w-sm">
            <Select
              label="Color Theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as ThemeMode)}
              hint="Applies Obsidian Blue CSS variable tokens immediately across all surfaces."
              options={[
                { value: 'dark', label: 'Obsidian Dark (Default)' },
                { value: 'light', label: 'Cool Light' },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card
        title="Workspace Metadata"
        subtitle="Read-only foundation attributes for this build."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Application" value={APP_META.name} readOnly />
          <Input label="Phase" value={APP_META.phaseLabel} readOnly />
          <Input label="Version" value={`v${APP_META.version}`} readOnly />
        </div>
      </Card>

      <Card title="Phase Boundary & Security Baseline">
        <div className="space-y-3 text-sm text-content-secondary">
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            <p>
              External service endpoints, local AI models, media processing tools,
              and social integrations are intentionally excluded in this phase.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Shield
              className="mt-0.5 h-4 w-4 shrink-0 text-success"
              aria-hidden="true"
            />
            <p>
              No credentials, API keys, or mock social connections are stored in
              client source code.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
