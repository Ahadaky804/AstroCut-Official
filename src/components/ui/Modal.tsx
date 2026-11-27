import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Button } from './Button'

export type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  size?: ModalSize
  footer?: ReactNode
  children: ReactNode
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

/**
 * Accessible dialog foundation with keyboard Escape support, backdrop dismissal, and focus restoration.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        className="fixed inset-0 backdrop-blur-xs transition-opacity"
        style={{ backgroundColor: 'var(--overlay-backdrop)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        style={{ boxShadow: 'var(--shadow-modal)' }}
        className={cn(
          'relative z-10 w-full rounded-2xl border border-edge-default bg-card p-6',
          SIZE_CLASSES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-lg font-semibold tracking-tight text-content-primary"
            >
              {title}
            </h3>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm leading-relaxed text-content-secondary"
              >
                {description}
              </p>
            )}
          </div>

          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-5">{children}</div>

        {footer && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-edge-subtle pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
