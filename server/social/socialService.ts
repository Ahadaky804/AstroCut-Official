import { createHash } from 'node:crypto'
import type {
  SocialAccountsSnapshot,
  SocialConnectedAccountPublic,
  SocialConnectionStatus,
  SocialPlatformId,
  SocialPlatformPublicOverview,
} from '../../src/types/social.ts'
import { loadServerEnv, redactSecrets } from '../envLoader.ts'
import { instagramOAuthAdapter } from './providers/instagramOAuth.ts'
import { tiktokOAuthAdapter } from './providers/tiktokOAuth.ts'
import { youtubeOAuthAdapter } from './providers/youtubeOAuth.ts'
import { generatePkcePair, SocialTokenStore } from './socialStore.ts'
import { SocialOAuthError, type SocialProviderAdapter } from './types.ts'

const ADAPTERS: Record<SocialPlatformId, SocialProviderAdapter> = {
  youtube: youtubeOAuthAdapter,
  instagram: instagramOAuthAdapter,
  tiktok: tiktokOAuthAdapter,
}

export const SOCIAL_PLATFORM_ORDER: readonly SocialPlatformId[] = [
  'youtube',
  'instagram',
  'tiktok',
]

export function getSocialAdapter(
  platform: SocialPlatformId,
): SocialProviderAdapter {
  const adapter = ADAPTERS[platform]
  if (!adapter) {
    throw new SocialOAuthError(
      `Unsupported social platform "${String(platform)}".`,
      'provider_error',
      400,
    )
  }
  return adapter
}

function getAllKnownSecrets(store: SocialTokenStore): string[] {
  const adapterSecrets = SOCIAL_PLATFORM_ORDER.flatMap((id) =>
    ADAPTERS[id].getSecretValues(),
  )
  return [...store.getAllSecretTokens(), ...adapterSecrets]
}

export class SocialIntegrationService {
  readonly store: SocialTokenStore

  constructor(rootDir: string = process.cwd()) {
    loadServerEnv(rootDir)
    this.store = new SocialTokenStore(rootDir)
  }

  getSnapshot(
    ownerSessionId: string,
    requestOrigin: string,
  ): SocialAccountsSnapshot {
    const platforms: SocialPlatformPublicOverview[] = SOCIAL_PLATFORM_ORDER.map(
      (platformId) => {
        const adapter = ADAPTERS[platformId]
        const missingEnvVars = adapter.getMissingEnvVars()
        const configured = missingEnvVars.length === 0
        const redirectUri = adapter.resolveRedirectUri(requestOrigin)
        const accounts = this.store.listPublicConnectionsForSession(
          ownerSessionId,
          platformId,
        )

        let status: SocialConnectionStatus
        let statusMessage: string

        if (accounts.some((a) => a.status === 'connected')) {
          status = 'connected'
          statusMessage = `${accounts.filter((a) => a.status === 'connected').length} account connected.`
        } else if (accounts.some((a) => a.status === 'expired')) {
          status = 'expired'
          statusMessage =
            accounts.find((a) => a.status === 'expired')?.statusMessage ||
            'Authorization expired. Reconnect your account.'
        } else if (accounts.some((a) => a.status === 'error')) {
          status = 'error'
          statusMessage =
            accounts.find((a) => a.status === 'error')?.statusMessage ||
            'Connection error occurred.'
        } else if (!configured) {
          status = 'setup_required'
          statusMessage = `Set ${missingEnvVars.join(' and ')} on the server to enable ${adapter.platformName} OAuth.`
        } else {
          status = 'disconnected'
          statusMessage = `Ready to connect via official ${adapter.platformName} OAuth.`
        }

        return {
          platform: platformId,
          platformName: adapter.platformName,
          status,
          statusMessage,
          configured,
          missingEnvVars,
          redirectUri,
          requestedScopes: [...adapter.requestedScopes],
          eligibilityNote: adapter.eligibilityNote,
          reviewRequirementNote: adapter.reviewRequirementNote,
          accounts,
        }
      },
    )

    return {
      encryptionMode: this.store.encryptionMode,
      platforms,
    }
  }

  startAuthorization(input: {
    platform: SocialPlatformId
    ownerSessionId: string
    requestOrigin: string
  }): { authorizationUrl: string; state: string; redirectUri: string } {
    const adapter = getSocialAdapter(input.platform)
    if (!adapter.isConfigured()) {
      const missing = adapter.getMissingEnvVars()
      throw new SocialOAuthError(
        `${adapter.platformName} OAuth is not configured on the server. Missing: ${missing.join(', ')}.`,
        'setup_required',
        400,
      )
    }

    const redirectUri = adapter.resolveRedirectUri(input.requestOrigin)
    const pending = this.store.createPendingState({
      platform: input.platform,
      ownerSessionId: input.ownerSessionId,
      redirectUri,
    })

    const codeChallenge = createHash('sha256')
      .update(pending.codeVerifier)
      .digest('base64url')

    const authorizationUrl = adapter.buildAuthorizationUrl({
      state: pending.state,
      redirectUri,
      codeChallenge,
    })

    return {
      authorizationUrl,
      state: pending.state,
      redirectUri,
    }
  }

  async completeOAuthCallback(input: {
    platform: SocialPlatformId
    ownerSessionId: string
    requestOrigin: string
    code?: string
    state?: string
    oauthError?: string
    oauthErrorDescription?: string
    signal?: AbortSignal
  }): Promise<SocialConnectedAccountPublic> {
    const adapter = getSocialAdapter(input.platform)
    const expectedRedirectUri = adapter.resolveRedirectUri(input.requestOrigin)

    if (!input.state) {
      throw new SocialOAuthError(
        'Missing OAuth state parameter in callback.',
        'invalid_code',
        400,
      )
    }

    let pending
    try {
      pending = this.store.consumePendingState({
        state: input.state,
        platform: input.platform,
        ownerSessionId: input.ownerSessionId,
        expectedRedirectUri,
      })
    } catch (err) {
      throw new SocialOAuthError(
        err instanceof Error ? err.message : 'OAuth state validation failed.',
        'invalid_code',
        403,
        { cause: err },
      )
    }

    if (input.oauthError) {
      const detail = input.oauthErrorDescription || input.oauthError
      throw new SocialOAuthError(
        redactSecrets(
          `${adapter.platformName} authorization declined: ${detail}`,
          getAllKnownSecrets(this.store),
        ),
        input.oauthError === 'access_denied'
          ? 'permission_denied'
          : 'provider_error',
        400,
      )
    }

    if (!input.code?.trim()) {
      throw new SocialOAuthError(
        'Missing authorization code in OAuth callback.',
        'invalid_code',
        400,
      )
    }

    try {
      const exchanged = await adapter.exchangeCodeForAccount({
        code: input.code.trim(),
        redirectUri: pending.redirectUri,
        codeVerifier: pending.codeVerifier,
        signal: input.signal,
      })

      const saved = this.store.saveConnection({
        ownerSessionId: input.ownerSessionId,
        platform: input.platform,
        ...exchanged,
      })

      return {
        connectionId: saved.connectionId,
        platform: saved.platform,
        externalAccountId: saved.externalAccountId,
        accountName: saved.accountName,
        usernameOrChannelId: saved.usernameOrChannelId,
        profileImageUrl: saved.profileImageUrl,
        accountType: saved.accountType,
        status: saved.status,
        statusMessage: saved.statusMessage,
        grantedScopes: saved.grantedScopes,
        connectedAt: saved.connectedAt,
        updatedAt: saved.updatedAt,
        expiresAt: saved.expiresAt,
      }
    } catch (err) {
      const cleanMessage = redactSecrets(
        err instanceof Error
          ? err.message
          : `${adapter.platformName} connection failed.`,
        getAllKnownSecrets(this.store),
      )
      if (err instanceof SocialOAuthError) {
        throw new SocialOAuthError(cleanMessage, err.code, err.statusCode, {
          cause: err,
        })
      }
      throw new SocialOAuthError(cleanMessage, 'provider_error', 502, {
        cause: err,
      })
    }
  }

  async verifyConnection(input: {
    connectionId: string
    ownerSessionId: string
    signal?: AbortSignal
  }): Promise<SocialConnectedAccountPublic> {
    const conn = this.store.getConnectionForSession(
      input.connectionId,
      input.ownerSessionId,
    )
    if (!conn) {
      throw new SocialOAuthError(
        'Connected social account was not found in your session.',
        'provider_error',
        404,
      )
    }

    const adapter = getSocialAdapter(conn.platform)
    try {
      const result = await adapter.verifyOrRefreshConnection(conn, input.signal)
      const cleanMsg = redactSecrets(
        result.statusMessage,
        getAllKnownSecrets(this.store),
      )

      const updated = this.store.updateConnection(
        conn.connectionId,
        input.ownerSessionId,
        {
          status: result.status,
          statusMessage: cleanMsg,
          ...(result.accessToken ? { accessToken: result.accessToken } : {}),
          ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
          ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
          ...(result.accountName ? { accountName: result.accountName } : {}),
          ...(result.usernameOrChannelId
            ? { usernameOrChannelId: result.usernameOrChannelId }
            : {}),
          ...(result.profileImageUrl
            ? { profileImageUrl: result.profileImageUrl }
            : {}),
        },
      )!

      return {
        connectionId: updated.connectionId,
        platform: updated.platform,
        externalAccountId: updated.externalAccountId,
        accountName: updated.accountName,
        usernameOrChannelId: updated.usernameOrChannelId,
        profileImageUrl: updated.profileImageUrl,
        accountType: updated.accountType,
        status: updated.status,
        statusMessage: updated.statusMessage,
        grantedScopes: updated.grantedScopes,
        connectedAt: updated.connectedAt,
        updatedAt: updated.updatedAt,
        expiresAt: updated.expiresAt,
      }
    } catch (err) {
      const cleanMsg = redactSecrets(
        err instanceof Error ? err.message : 'Verification failed.',
        getAllKnownSecrets(this.store),
      )
      this.store.updateConnection(conn.connectionId, input.ownerSessionId, {
        status: 'error',
        statusMessage: cleanMsg,
      })
      throw new SocialOAuthError(cleanMsg, 'provider_error', 502, {
        cause: err,
      })
    }
  }

  async disconnectAccount(input: {
    connectionId: string
    ownerSessionId: string
    signal?: AbortSignal
  }): Promise<{ revokedAtProvider: boolean; note?: string }> {
    const conn = this.store.getConnectionForSession(
      input.connectionId,
      input.ownerSessionId,
    )
    if (!conn) {
      throw new SocialOAuthError(
        'Connected social account was not found in your session.',
        'provider_error',
        404,
      )
    }

    const adapter = getSocialAdapter(conn.platform)
    const revokeOutcome = await adapter.revokeConnection(conn, input.signal)
    this.store.deleteConnection(conn.connectionId, input.ownerSessionId)
    return revokeOutcome
  }
}

export { generatePkcePair }
