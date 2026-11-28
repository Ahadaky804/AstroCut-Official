import { ChevronDown } from 'lucide-react'
import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import { fieldControlStyles } from './fieldStyles'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: SelectOption[]
  containerClassName?: string
}

/**
 * Accessible select menu styled consistently with AstroCut form controls.
 */
export function Select({
  label,
  hint,
  error,
  options,
  id,
  className,
  containerClassName,
  disabled,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const messageId = `${selectId}-message`

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-content-primary"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          className={fieldControlStyles({
            hasError: Boolean(error),
            className: cn('h-10 appearance-none py-2 pr-9 pl-3', className),
          })}
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-content-muted"
          aria-hidden="true"
        />
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
