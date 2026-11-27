import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type CardVariant = 'default' | 'elevated' | 'interactive'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps {
  title?: string
  subtitle?: string
  headerAction?: ReactNode
  footer?: ReactNode
  variant?: CardVariant
  padding?: CardPadding
  children: ReactNode
  className?: string
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-card border-edge-subtle',
  elevated: 'bg-elevated border-edge-default',
  interactive:
    'bg-card border-edge-subtle transition-colors duration-150 hover:border-edge-strong hover:bg-elevated/65',
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

/**
 * Reusable surface container for AstroCut workspace panels and cards.
 */
export function Card({
  title,
  subtitle,
  headerAction,
  footer,
  variant = 'default',
  padding = 'md',
  children,
  className,
}: CardProps) {
  return (
    <section
      style={{ boxShadow: 'var(--shadow-card)' }}
      className={cn(
        'rounded-xl border',
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className,
      )}
    >
      {(title || subtitle || headerAction) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-content-primary">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>
      )}
      {children}
      {footer && (
        <footer className="mt-5 border-t border-edge-subtle pt-4">
          {footer}
        </footer>
      )}
    </section>
  )
}
