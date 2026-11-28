import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let envLoaded = false

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const eqIndex = trimmed.indexOf('=')
  if (eqIndex <= 0) return null

  const key = trimmed.slice(0, eqIndex).trim()
  let value = trimmed.slice(eqIndex + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return key ? [key, value] : null
}

/**
 * Loads .env and .env.local into process.env on the server without overwriting shell variables.
 */
export function loadServerEnv(rootDir: string = process.cwd()): void {
  if (envLoaded) return
  envLoaded = true

  for (const fileName of ['.env', '.env.local']) {
    const filePath = resolve(rootDir, fileName)
    if (!existsSync(filePath)) continue
    try {
      const content = readFileSync(filePath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const parsed = parseEnvLine(line)
        if (!parsed) continue
        const [key, value] = parsed
        if (process.env[key] === undefined || process.env[key] === '') {
          process.env[key] = value
        }
      }
    } catch {
      // Ignore unreadable env file
    }
  }
}

/**
 * Masks an API key for safe display in responses and UI (never returns the raw secret).
 */
export function maskApiKey(key?: string | null): string | null {
  if (!key) return null
  const trimmed = key.trim()
  if (!trimmed) return null
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}

/**
 * Redacts any known secret values from error strings before returning or logging.
 */
export function redactSecrets(
  message: string,
  secrets: Array<string | undefined | null>,
): string {
  let clean = message
  for (const secret of secrets) {
    const val = secret?.trim()
    if (val && val.length >= 6) {
      clean = clean.split(val).join('[REDACTED]')
    }
  }
  return clean
}
