import { ArrowDown, ArrowUp, Cpu, Sliders, Sparkles } from 'lucide-react'
import { useAiProviders } from '../../context/AiProvidersContext'
import type { OperatingMode, ProviderId } from '../../types/ai'
import { cn } from '../../utils/cn'
import { Badge, Button, Card, Select } from '../ui'

/**
 * Controls Manual vs Automatic operating mode, default provider/model, fallback, and priority order.
 */
export function RoutingSettingsCard() {
  const { providers, routing, updateRouting } = useAiProviders()
  if (!routing) return null

  const enabledProviders = providers.filter((p) => p.enabled)
  const selectedDefaultProvider =
    providers.find((p) => p.id === routing.defaultProviderId) ?? providers[0]

  const defaultModelOptions = (() => {
    const names = new Set<string>()
    for (const m of selectedDefaultProvider?.discoveredModels ?? []) {
      names.add(m.name)
    }
    if (selectedDefaultProvider?.defaultModel) {
      names.add(selectedDefaultProvider.defaultModel)
    }
    if (routing.defaultModel) {
      names.add(routing.defaultModel)
    }
    const items = Array.from(names)
    if (items.length === 0) {
      return [{ value: '', label: 'Use provider default / discovered model' }]
    }
    return items.map((name) => ({ value: name, label: name }))
  })()

  const movePriority = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= routing.providerPriority.length) return
    const copy = [...routing.providerPriority]
    const [moved] = copy.splice(index, 1)
    copy.splice(nextIndex, 0, moved)
    void updateRouting({ providerPriority: copy })
  }

  return (
    <Card
      title="Operating Mode & Fallback"
      subtitle="Switch between strict Manual selection and rule-based Automatic provider routing."
      headerAction={
        <Badge variant="primary">
          {routing.mode === 'manual' ? 'Mode A: Manual' : 'Mode B: Automatic'}
        </Badge>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              {
                mode: 'manual' as OperatingMode,
                title: 'Manual Mode',
                description:
                  'Strictly uses your selected provider and model. Never silently switches providers on failure.',
                icon: Sliders,
              },
              {
                mode: 'automatic' as OperatingMode,
                title: 'Automatic Mode',
                description:
                  'Selects the highest-priority eligible provider based on configuration, availability, and task compatibility.',
                icon: Sparkles,
              },
            ] as const
          ).map((item) => {
            const active = routing.mode === item.mode
            const Icon = item.icon
            return (
              <button
                key={item.mode}
                type="button"
                aria-pressed={active}
                onClick={() => void updateRouting({ mode: item.mode })}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                  active
                    ? 'border-accent bg-accent-soft'
                    : 'border-edge-subtle bg-elevated hover:border-edge-strong',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-subtle bg-card text-accent">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content-primary">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                    {item.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Default Provider"
            value={routing.defaultProviderId}
            onChange={(event) => {
              const nextId = event.target.value as ProviderId
              const nextProvider = providers.find((p) => p.id === nextId)
              void updateRouting({
                defaultProviderId: nextId,
                defaultModel:
                  nextProvider?.defaultModel ||
                  nextProvider?.discoveredModels[0]?.name ||
                  '',
              })
            }}
            options={enabledProviders.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.capabilities.kind === 'local' ? 'Local' : 'Cloud'})`,
            }))}
          />

          <Select
            label="Default Model"
            value={routing.defaultModel}
            onChange={(event) =>
              void updateRouting({ defaultModel: event.target.value })
            }
            options={defaultModelOptions}
          />
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-edge-subtle bg-elevated p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-content-primary">
              Enable Automatic Fallback
            </p>
            <p className="mt-0.5 text-xs text-content-secondary">
              In Automatic mode, tries the next eligible provider in priority
              order if the preferred provider fails or hits rate limits.
            </p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-content-primary">
            <input
              type="checkbox"
              checked={routing.fallbackEnabled}
              onChange={(e) =>
                void updateRouting({ fallbackEnabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-edge-default accent-[var(--accent-primary)]"
            />
            <span>{routing.fallbackEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wider text-content-muted uppercase">
            Automatic Mode Provider Priority
          </p>
          <div className="space-y-1.5">
            {routing.providerPriority.map((pid, idx) => {
              const p = providers.find((item) => item.id === pid)
              if (!p) return null
              return (
                <div
                  key={pid}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge-subtle bg-elevated/60 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 text-center font-semibold text-content-muted tabular-nums">
                      {idx + 1}
                    </span>
                    <Cpu className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="truncate font-medium text-content-primary">
                      {p.name}
                    </span>
                    <Badge variant="neutral">
                      {p.capabilities.kind === 'local' ? 'Local' : 'Cloud'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === 0}
                      aria-label={`Move ${p.name} up`}
                      onClick={() => movePriority(idx, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === routing.providerPriority.length - 1}
                      aria-label={`Move ${p.name} down`}
                      onClick={() => movePriority(idx, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
