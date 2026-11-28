import { ArrowRight, CheckCircle2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { OnboardingStep } from '../../types/dashboard'
import { Badge, buttonStyles, Card } from '../ui'

interface GettingStartedSectionProps {
  steps: OnboardingStep[]
}

/**
 * Onboarding guide distinguishing currently active workspace settings from upcoming workflow steps.
 */
export function GettingStartedSection({ steps }: GettingStartedSectionProps) {
  return (
    <Card
      title="Getting Started"
      subtitle="Core workflow roadmap for AstroCut. Planned steps activate in upcoming phases."
      headerAction={
        <Link
          to="/settings"
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Workspace Settings</span>
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/25 bg-success-soft/60 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-success"
            aria-hidden="true"
          />
          <p className="text-xs font-medium text-content-primary">
            Available now: Theme preferences, responsive navigation, and workspace overview.
          </p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          <span>Configure theme</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-3.5 rounded-xl border border-edge-subtle bg-elevated/45 p-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-xs font-semibold text-accent">
              {step.stepNumber}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-content-primary">
                  {step.title}
                </h3>
                <Badge variant={step.badgeVariant}>{step.badgeLabel}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
