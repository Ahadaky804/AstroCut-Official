import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline'

export interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  icon?: ReactNode
  children: ReactNode
  className?: string
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-elevated text-content-secondary border-edge-subtle',
  primary: 'bg-accent-soft text-accent border-accent/30',
  secondary: 'bg-secondary-soft text-secondary border-secondary/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  outline: 'bg-transparent text-content-secondary border-edge-default',
}

const DOT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-content-muted',
  primary: 'bg-accent',
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  outline: 'bg-content-secondary',
}

/**
 * Compact status or category indicator pill.
 */
export function Badge({
  variant = 'neutral',
  dot = false,
  icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[variant])}
          aria-hidden="true"
        />
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
