import { Loader2 } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white shadow-xs hover:bg-accent-hover active:translate-y-px border border-transparent',
  secondary:
    'bg-secondary-soft text-secondary border border-secondary/30 hover:bg-secondary/20',
  outline:
    'bg-elevated/70 text-content-primary border border-edge-default hover:bg-elevated hover:border-edge-strong',
  ghost:
    'bg-transparent text-content-secondary border border-transparent hover:bg-elevated/80 hover:text-content-primary',
  danger:
    'bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 p-0 rounded-lg',
}

/**
 * Computes consistent AstroCut button styling for both button and link elements.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
} = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium transition-colors duration-150 select-none',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && 'w-full',
    className,
  )
}

/**
 * Reusable action button with consistent variants, sizes, and loading states.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isLoading)

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && (
        <span className="inline-flex shrink-0">{rightIcon}</span>
      )}
    </button>
  )
}
