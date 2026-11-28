import { cn } from '../../utils/cn'

/**
 * Shared styling helper for text inputs, textareas, and select menus.
 */
export function fieldControlStyles({
  hasError = false,
  className,
}: {
  hasError?: boolean
  className?: string
} = {}): string {
  return cn(
    'w-full rounded-lg border bg-input text-sm text-content-primary placeholder:text-content-muted',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    hasError
      ? 'border-danger focus:border-danger focus:ring-danger/25'
      : 'border-edge-default hover:border-edge-strong focus:border-accent focus:ring-[var(--focus-ring)]',
    className,
  )
}
