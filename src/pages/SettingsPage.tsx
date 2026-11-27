import { Info, Moon, RotateCcw, Shield, Sun } from 'lucide-react'
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

/**
 * Settings page providing persistent theme switching and non-sensitive workspace metadata.
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <PageHeader
        badge={
          <Badge
            variant="secondary"
            icon={
              theme === 'dark' ? (
                <Moon className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Sun className="h-3 w-3" aria-hidden="true" />
              )
            }
          >
            {theme === 'dark' ? 'Dark Theme' : 'Light Theme'}
          </Badge>
        }
        title="Workspace Settings"
        description="Manage visual theme preferences and review non-sensitive Phase 2 foundation details."
      />

      <Card
        title="Appearance & Theme"
        subtitle="Dark mode is the default AstroCut experience. Preferences persist locally in your browser."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-content-secondary">
              Active token set: <span className="font-medium text-content-primary">{theme}</span>
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
        <div className="max-w-sm">
          <Select
            label="Color Theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemeMode)}
            hint="Applies CSS variable tokens immediately across all surfaces."
            options={[
              { value: 'dark', label: 'Dark (Default Studio)' },
              { value: 'light', label: 'Light' },
            ]}
          />
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
              className="mt-0.5 h-4 w-4 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <p>
              External service endpoints, local AI models, media processing tools,
              and social integrations are intentionally excluded in Phase 2.
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
