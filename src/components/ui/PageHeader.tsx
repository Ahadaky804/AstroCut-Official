import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface PageHeaderProps {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Standardized page-level header establishing consistent typography and action alignment.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-edge-subtle pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {badge && <div>{badge}</div>}
        <h2 className="text-2xl font-semibold tracking-tight text-content-primary sm:text-[1.75rem] sm:leading-tight">
          {title}
        </h2>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-content-secondary">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </div>
  )
}
