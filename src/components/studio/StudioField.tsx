import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { CopyButton } from './CopyButton'

interface StudioFieldProps {
  label: string
  value: string
  maxLength?: number
  children: ReactNode
}

/**
 * Wraps an editor field with a consistent label, character counter, and copy control.
 */
export function StudioField({
  label,
  value,
  maxLength,
  children,
}: StudioFieldProps) {
  const isOverLimit = maxLength !== undefined && value.length > maxLength

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-content-primary">{label}</span>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs tabular-nums',
              isOverLimit ? 'font-medium text-warning' : 'text-content-muted',
            )}
          >
            {maxLength !== undefined
              ? `${value.length} / ${maxLength}`
              : `${value.length} chars`}
          </span>
          <CopyButton text={value} size="sm" variant="ghost" />
        </div>
      </div>

      {children}
    </div>
  )
}
