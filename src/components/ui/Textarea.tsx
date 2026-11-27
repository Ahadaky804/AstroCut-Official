import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
}

/**
 * Accessible multi-line textarea control with label, hint, and error state.
 */
export function Textarea({
  label,
  hint,
  error,
  id,
  rows = 4,
  className,
  containerClassName,
  disabled,
  ...props
}: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const messageId = `${textareaId}-message`

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-content-primary"
        >
          {label}
        </label>
      )}

      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(
          'w-full rounded-lg border bg-input px-3 py-2.5 text-sm leading-relaxed text-content-primary placeholder:text-content-muted',
          'transition-colors duration-150 resize-y',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error
            ? 'border-danger focus:border-danger'
            : 'border-edge-default hover:border-edge-strong focus:border-accent',
          className,
        )}
        {...props}
      />

      {(error || hint) && (
        <p
          id={messageId}
          className={cn(
            'text-xs',
            error ? 'text-danger' : 'text-content-secondary',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
