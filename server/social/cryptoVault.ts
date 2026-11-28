import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface EncryptedBlobPayload {
  version: 1
  iv: string
  authTag: string
  ciphertext: string
}

function normalizeKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }
  return createHash('sha256').update(trimmed, 'utf8').digest()
}

export interface EncryptionKeyResolution {
  key: Buffer
  mode: 'env_key' | 'local_key_file'
}

/**
 * Resolves a 256-bit symmetric key from ASTROCUT_ENCRYPTION_KEY or a local-only
 * key file inside .astrocut/ (gitignored) for zero-setup localhost development.
 */
export function resolveSocialEncryptionKey(
  rootDir: string = process.cwd(),
): EncryptionKeyResolution {
  const envKey = process.env.ASTROCUT_ENCRYPTION_KEY?.trim()
  if (envKey) {
    return {
      key: normalizeKeyMaterial(envKey),
      mode: 'env_key',
    }
  }

  const keyFilePath = resolve(rootDir, '.astrocut', 'social.key')
  if (existsSync(keyFilePath)) {
    const existing = readFileSync(keyFilePath, 'utf8').trim()
    if (existing) {
      return {
        key: normalizeKeyMaterial(existing),
        mode: 'local_key_file',
      }
    }
  }

  const dir = dirname(keyFilePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const generatedHex = randomBytes(32).toString('hex')
  writeFileSync(keyFilePath, generatedHex, { encoding: 'utf8', mode: 0o600 })
  return {
    key: Buffer.from(generatedHex, 'hex'),
    mode: 'local_key_file',
  }
}

export function encryptJsonPayload(value: unknown, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  const payload: EncryptedBlobPayload = {
    version: 1,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
  return JSON.stringify(payload)
}

export function decryptJsonPayload<T>(raw: string, key: Buffer): T {
  const parsed = JSON.parse(raw) as Partial<EncryptedBlobPayload>
  if (
    parsed.version !== 1 ||
    !parsed.iv ||
    !parsed.authTag ||
    !parsed.ciphertext
  ) {
    throw new Error('Encrypted social vault payload is corrupted.')
  }

  const iv = Buffer.from(parsed.iv, 'base64')
  const authTag = Buffer.from(parsed.authTag, 'base64')
  const ciphertext = Buffer.from(parsed.ciphertext, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8')) as T
}
