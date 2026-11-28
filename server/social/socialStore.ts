import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {
  SocialConnectedAccountPublic,
  SocialPlatformId,
} from '../../src/types/social.ts'
import {
  decryptJsonPayload,
  encryptJsonPayload,
  resolveSocialEncryptionKey,
} from './cryptoVault.ts'

export interface StoredSocialConnection {
  connectionId: string
  ownerSessionId: string
  platform: SocialPlatformId
  externalAccountId: string
  accountName: string
  usernameOrChannelId?: string
  profileImageUrl?: string
  accountType?: string
  status: 'connected' | 'expired' | 'error'
  statusMessage: string
  grantedScopes: string[]
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  connectedAt: string
  updatedAt: string
}

export interface PendingOAuthState {
  state: string
  platform: SocialPlatformId
  ownerSessionId: string
  redirectUri: string
  codeVerifier: string
  createdAt: number
}

interface PersistedVaultData {
  connections: Record<string, StoredSocialConnection>
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Encrypted server-side OAuth token & connection store with session-bound CSRF state.
 */
export class SocialTokenStore {
  private readonly vaultPath: string
  private readonly encryptionKey: Buffer
  readonly encryptionMode: 'env_key' | 'local_key_file'
  private data: PersistedVaultData
  private readonly pendingStates = new Map<string, PendingOAuthState>()

  constructor(rootDir: string = process.cwd()) {
    const resolved = resolveSocialEncryptionKey(rootDir)
    this.encryptionKey = resolved.key
    this.encryptionMode = resolved.mode
    this.vaultPath = resolve(rootDir, '.astrocut', 'social.enc.json')
    this.data = this.loadFromDisk()
  }

  private loadFromDisk(): PersistedVaultData {
    if (!existsSync(this.vaultPath)) {
      return { connections: {} }
    }
    try {
      const raw = readFileSync(this.vaultPath, 'utf8')
      const parsed = decryptJsonPayload<PersistedVaultData>(raw, this.encryptionKey)
      return {
        connections: parsed?.connections ?? {},
      }
    } catch {
      return { connections: {} }
    }
  }

  private saveToDisk(): void {
    const dir = dirname(this.vaultPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const encrypted = encryptJsonPayload(this.data, this.encryptionKey)
    writeFileSync(this.vaultPath, encrypted, { encoding: 'utf8', mode: 0o600 })
  }

  createPendingState(input: {
    platform: SocialPlatformId
    ownerSessionId: string
    redirectUri: string
  }): PendingOAuthState {
    this.pruneExpiredStates()
    const state = randomBytes(32).toString('base64url')
    const { verifier } = generatePkcePair()
    const record: PendingOAuthState = {
      state,
      platform: input.platform,
      ownerSessionId: input.ownerSessionId,
      redirectUri: input.redirectUri,
      codeVerifier: verifier,
      createdAt: Date.now(),
    }
    this.pendingStates.set(state, record)
    return record
  }

  consumePendingState(input: {
    state: string
    platform: SocialPlatformId
    ownerSessionId: string
    expectedRedirectUri: string
  }): PendingOAuthState {
    this.pruneExpiredStates()
    const record = this.pendingStates.get(input.state)
    if (!record) {
      throw new Error(
        'Invalid or expired OAuth state parameter. Restart the connection flow.',
      )
    }
    // Single-use token: delete immediately regardless of validation outcome
    this.pendingStates.delete(input.state)

    if (Date.now() - record.createdAt > OAUTH_STATE_TTL_MS) {
      throw new Error(
        'OAuth state expired before completion. Please try connecting again.',
      )
    }
    if (record.platform !== input.platform) {
      throw new Error('OAuth state platform mismatch.')
    }
    if (record.ownerSessionId !== input.ownerSessionId) {
      throw new Error(
        'OAuth state does not belong to your current browser session.',
      )
    }
    if (record.redirectUri !== input.expectedRedirectUri) {
      throw new Error('OAuth callback redirect URI validation failed.')
    }
    return record
  }

  private pruneExpiredStates(): void {
    const now = Date.now()
    for (const [key, item] of this.pendingStates.entries()) {
      if (now - item.createdAt > OAUTH_STATE_TTL_MS) {
        this.pendingStates.delete(key)
      }
    }
  }

  saveConnection(input: {
    ownerSessionId: string
    platform: SocialPlatformId
    externalAccountId: string
    accountName: string
    usernameOrChannelId?: string
    profileImageUrl?: string
    accountType?: string
    statusMessage: string
    grantedScopes: string[]
    accessToken: string
    refreshToken?: string
    expiresAt?: string
  }): StoredSocialConnection {
    const connectionId = `${input.platform}:${input.externalAccountId}`
    const existing = this.data.connections[connectionId]
    const now = new Date().toISOString()

    const next: StoredSocialConnection = {
      connectionId,
      ownerSessionId: input.ownerSessionId,
      platform: input.platform,
      externalAccountId: input.externalAccountId,
      accountName: input.accountName,
      usernameOrChannelId: input.usernameOrChannelId,
      profileImageUrl: input.profileImageUrl,
      accountType: input.accountType,
      status: 'connected',
      statusMessage: input.statusMessage,
      grantedScopes: [...input.grantedScopes],
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? existing?.refreshToken,
      expiresAt: input.expiresAt,
      connectedAt: existing?.connectedAt ?? now,
      updatedAt: now,
    }

    this.data.connections[connectionId] = next
    this.saveToDisk()
    return next
  }

  updateConnection(
    connectionId: string,
    ownerSessionId: string,
    patch: Partial<
      Pick<
        StoredSocialConnection,
        | 'status'
        | 'statusMessage'
        | 'accountName'
        | 'usernameOrChannelId'
        | 'profileImageUrl'
        | 'accountType'
        | 'accessToken'
        | 'refreshToken'
        | 'expiresAt'
      >
    >,
  ): StoredSocialConnection | null {
    const existing = this.data.connections[connectionId]
    if (!existing || existing.ownerSessionId !== ownerSessionId) {
      return null
    }
    const updated: StoredSocialConnection = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    this.data.connections[connectionId] = updated
    this.saveToDisk()
    return updated
  }

  getConnectionForSession(
    connectionId: string,
    ownerSessionId: string,
  ): StoredSocialConnection | null {
    const item = this.data.connections[connectionId]
    if (!item || item.ownerSessionId !== ownerSessionId) {
      return null
    }
    return item
  }

  listConnectionsForSession(ownerSessionId: string): StoredSocialConnection[] {
    return Object.values(this.data.connections).filter(
      (c) => c.ownerSessionId === ownerSessionId,
    )
  }

  listPublicConnectionsForSession(
    ownerSessionId: string,
    platform?: SocialPlatformId,
  ): SocialConnectedAccountPublic[] {
    return this.listConnectionsForSession(ownerSessionId)
      .filter((c) => !platform || c.platform === platform)
      .map((c) => {
        const isTimeExpired =
          c.status === 'connected' &&
          c.expiresAt &&
          !c.refreshToken &&
          new Date(c.expiresAt).getTime() <= Date.now()
        const effectiveStatus = isTimeExpired ? 'expired' : c.status
        return {
          connectionId: c.connectionId,
          platform: c.platform,
          externalAccountId: c.externalAccountId,
          accountName: c.accountName,
          usernameOrChannelId: c.usernameOrChannelId,
          profileImageUrl: c.profileImageUrl,
          accountType: c.accountType,
          status: effectiveStatus,
          statusMessage: isTimeExpired
            ? 'Access token expired and no refresh token was issued. Reconnect your account.'
            : c.statusMessage,
          grantedScopes: c.grantedScopes,
          connectedAt: c.connectedAt,
          updatedAt: c.updatedAt,
          expiresAt: c.expiresAt,
        }
      })
  }

  deleteConnection(connectionId: string, ownerSessionId: string): boolean {
    const existing = this.data.connections[connectionId]
    if (!existing || existing.ownerSessionId !== ownerSessionId) {
      return false
    }
    delete this.data.connections[connectionId]
    this.saveToDisk()
    return true
  }

  getAllSecretTokens(): string[] {
    const secrets: string[] = []
    for (const c of Object.values(this.data.connections)) {
      if (c.accessToken) secrets.push(c.accessToken)
      if (c.refreshToken) secrets.push(c.refreshToken)
    }
    return secrets
  }
}
