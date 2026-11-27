import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  headerAction?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Reusable surface container for AstroCut workspace panels and cards.
 */
export function Card({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
}: CardProps) {
  return (
    <section
      className={`rounded-xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-sm backdrop-blur-sm ${className}`.trim()}
    >
      {(title || subtitle || headerAction) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-slate-100">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
