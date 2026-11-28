import type { SocialPlatformId } from '../../src/types/social.ts'
import type { StoredSocialConnection } from './socialStore.ts'

export type SocialOAuthErrorCode =
  | 'setup_required'
  | 'invalid_code'
  | 'expired_token'
  | 'revoked'
  | 'unsupported_account'
  | 'permission_denied'
  | 'provider_error'

export class SocialOAuthError extends Error {
  readonly code: SocialOAuthErrorCode
  readonly statusCode: number

  constructor(
    message: string,
    code: SocialOAuthErrorCode,
    statusCode = 400,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'SocialOAuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

export interface ExchangedSocialAccount {
  externalAccountId: string
  accountName: string
  usernameOrChannelId?: string
  profileImageUrl?: string
  accountType?: string
  grantedScopes: string[]
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  statusMessage: string
}

export interface SocialProviderAdapter {
  readonly platform: SocialPlatformId
  readonly platformName: string
  readonly requiredEnvVars: readonly string[]
  readonly requestedScopes: readonly string[]
  readonly eligibilityNote: string
  readonly reviewRequirementNote: string
  getMissingEnvVars(): string[]
  isConfigured(): boolean
  resolveRedirectUri(requestOrigin: string): string
  buildAuthorizationUrl(params: {
    state: string
    redirectUri: string
    codeChallenge: string
  }): string
  exchangeCodeForAccount(params: {
    code: string
    redirectUri: string
    codeVerifier: string
    signal?: AbortSignal
  }): Promise<ExchangedSocialAccount>
  verifyOrRefreshConnection(
    connection: StoredSocialConnection,
    signal?: AbortSignal,
  ): Promise<{
    status: 'connected' | 'expired' | 'error'
    statusMessage: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: string
    accountName?: string
    usernameOrChannelId?: string
    profileImageUrl?: string
  }>
  revokeConnection(
    connection: StoredSocialConnection,
    signal?: AbortSignal,
  ): Promise<{ revokedAtProvider: boolean; note?: string }>
  getSecretValues(): string[]
}

export function computeExpiresAtIso(expiresInSeconds: unknown): string | undefined {
  const num = Number(expiresInSeconds)
  if (!Number.isFinite(num) || num <= 0) return undefined
  return new Date(Date.now() + num * 1000).toISOString()
}

export async function safeParseJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}
