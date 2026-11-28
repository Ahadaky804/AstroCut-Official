import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { fieldControlStyles } from './fieldStyles'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightElement?: ReactNode
  containerClassName?: string
}

/**
 * Accessible text input field with label, icon slots, hint, and error support.
 */
export function Input({
  label,
  hint,
  error,
  leftIcon,
  rightElement,
  id,
  className,
  containerClassName,
  disabled,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-content-primary"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span
            className="pointer-events-none absolute left-3 inline-flex text-content-muted"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          className={fieldControlStyles({
            hasError: Boolean(error),
            className: cn(
              'h-10 px-3',
              Boolean(leftIcon) && 'pl-9',
              Boolean(rightElement) && 'pr-10',
              className,
            ),
          })}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-2.5 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

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
