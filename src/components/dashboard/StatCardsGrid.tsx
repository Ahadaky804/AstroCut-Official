import type { DashboardStatItem } from '../../types/dashboard'
import { cn } from '../../utils/cn'
import { Card } from '../ui'

interface StatCardsGridProps {
  stats: DashboardStatItem[]
}

const TONE_CLASSES: Record<DashboardStatItem['accentTone'], string> = {
  primary: 'border-accent/25 bg-accent-soft text-accent',
  secondary: 'border-secondary/25 bg-secondary-soft text-secondary',
  neutral: 'border-edge-default bg-elevated text-content-secondary',
  success: 'border-success/25 bg-success-soft text-success',
}

/**
 * Displays key AstroCut workspace counts in a responsive 4-column grid.
 */
export function StatCardsGrid({ stats }: StatCardsGridProps) {
  return (
    <section aria-label="Workspace statistics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.id} variant="interactive" padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-content-secondary">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-content-primary tabular-nums">
                    {stat.value}
                  </p>
                </div>

                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                    TONE_CLASSES[stat.accentTone],
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-content-muted">
                {stat.helperText}
              </p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
