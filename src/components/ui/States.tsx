import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface SkeletonProps {
  className?: string
}

/**
 * Subtle loading placeholder bar respecting active theme surface tokens.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-elevated', className)}
    />
  )
}

export interface LoadingStateProps {
  label?: string
  description?: string
  compact?: boolean
  className?: string
}

/**
 * Reusable loading indicator block for async surfaces and section placeholders.
 */
export function LoadingState({
  label = 'Loading workspace...',
  description,
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-edge-subtle bg-card text-center',
        compact ? 'px-4 py-6' : 'px-6 py-10',
        className,
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-content-primary">{label}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-content-secondary">
          {description}
        </p>
      )}
    </div>
  )
}

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

/**
 * Standardized empty state container for unpopulated sections and reserved views.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-edge-default bg-card/60 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-edge-subtle bg-elevated text-accent">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-content-secondary">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
