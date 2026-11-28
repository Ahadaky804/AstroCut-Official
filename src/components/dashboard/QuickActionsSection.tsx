import type { QuickActionItem } from '../../types/dashboard'
import { Badge, Button, Card, Tooltip } from '../ui'

interface QuickActionsSectionProps {
  actions: QuickActionItem[]
  onActionSelect?: (actionId: QuickActionItem['id']) => void
}

/**
 * Displays primary workspace quick actions with honest availability states.
 */
export function QuickActionsSection({
  actions,
  onActionSelect,
}: QuickActionsSectionProps) {
  return (
    <Card
      title="Quick Actions"
      subtitle="Core workflow shortcuts. Upcoming modules remain disabled until implemented."
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <div
              key={action.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-edge-subtle bg-elevated p-4 transition-colors hover:border-edge-default"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-subtle bg-card text-accent">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <Badge variant={action.available ? 'success' : 'outline'}>
                    {action.statusLabel}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-content-primary">
                    {action.label}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                    {action.description}
                  </p>
                </div>
              </div>

              <Tooltip content={action.targetPhase} side="top" className="w-full">
                <span className="w-full">
                  <Button
                    variant={action.available ? 'secondary' : 'outline'}
                    size="sm"
                    fullWidth
                    disabled={!action.available}
                    leftIcon={<Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => onActionSelect?.(action.id)}
                  >
                    {action.label}
                  </Button>
                </span>
              </Tooltip>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
