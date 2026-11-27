import { useId, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: string
  side?: TooltipSide
  disabled?: boolean
  children: ReactNode
  className?: string
}

const POSITION_CLASSES: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * Lightweight accessible tooltip revealed on pointer hover or keyboard focus.
 */
export function Tooltip({
  content,
  side = 'top',
  disabled = false,
  children,
  className,
}: TooltipProps) {
  const tooltipId = useId()

  if (disabled) {
    return <>{children}</>
  }

  return (
    <span
      className={cn('group relative inline-flex items-center', className)}
      aria-describedby={tooltipId}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 rounded-md border border-edge-default bg-elevated px-2.5 py-1 text-xs font-medium whitespace-nowrap text-content-primary shadow-md',
          'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          POSITION_CLASSES[side],
        )}
      >
        {content}
      </span>
    </span>
  )
}
