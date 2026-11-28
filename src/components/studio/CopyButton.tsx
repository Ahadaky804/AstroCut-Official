import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from '../ui'

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (!value) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fallback below
    }
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      const ok = document.execCommand('copy')
      return ok
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }

  return false
}

/**
 * Reusable clipboard copy button with temporary copied confirmation feedback.
 */
export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'outline',
  size = 'sm',
  disabled,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(text)
    if (!ok) return
    setCopied(true)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || text.trim().length === 0}
      onClick={() => void handleCopy()}
      leftIcon={
        copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )
      }
    >
      {copied ? copiedLabel : label}
    </Button>
  )
}
