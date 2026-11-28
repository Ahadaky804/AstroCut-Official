export type SocialPlatformId = 'youtube' | 'instagram' | 'tiktok'

export type SocialConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'expired'
  | 'error'
  | 'setup_required'

export interface SocialConnectedAccountPublic {
  connectionId: string
  platform: SocialPlatformId
  externalAccountId: string
  accountName: string
  usernameOrChannelId?: string
  profileImageUrl?: string
  accountType?: string
  status: 'connected' | 'expired' | 'error'
  statusMessage: string
  grantedScopes: string[]
  connectedAt: string
  updatedAt: string
  expiresAt?: string
}

export interface SocialPlatformPublicOverview {
  platform: SocialPlatformId
  platformName: string
  status: SocialConnectionStatus
  statusMessage: string
  configured: boolean
  missingEnvVars: string[]
  redirectUri: string
  requestedScopes: string[]
  eligibilityNote: string
  reviewRequirementNote: string
  accounts: SocialConnectedAccountPublic[]
}

export interface SocialAccountsSnapshot {
  encryptionMode: 'env_key' | 'local_key_file'
  platforms: SocialPlatformPublicOverview[]
}
