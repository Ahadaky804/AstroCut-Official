import {
  computeExpiresAtIso,
  safeParseJson,
  SocialOAuthError,
  type ExchangedSocialAccount,
  type SocialProviderAdapter,
} from '../types.ts'

const AUTH_ENDPOINT = () =>
  process.env.GOOGLE_OAUTH_AUTH_URL?.trim() ||
  'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = () =>
  process.env.GOOGLE_OAUTH_TOKEN_URL?.trim() ||
  'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = () =>
  process.env.GOOGLE_OAUTH_REVOKE_URL?.trim() ||
  'https://oauth2.googleapis.com/revoke'
const CHANNELS_ENDPOINT = () =>
  process.env.YOUTUBE_CHANNELS_API_URL?.trim() ||
  'https://www.googleapis.com/youtube/v3/channels'

const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

function getGoogleCreds() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
    redirectUriOverride: process.env.GOOGLE_REDIRECT_URI?.trim() || '',
  }
}

async function fetchYouTubeChannelProfile(
  accessToken: string,
  signal?: AbortSignal,
): Promise<{
  channelId: string
  channelTitle: string
  customUrl?: string
  thumbnailUrl?: string
}> {
  const url = `${CHANNELS_ENDPOINT()}?part=snippet,id&mine=true`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    signal,
  })

  const body = await safeParseJson(res)
  if (!res.ok) {
    const apiErr = (body?.error as Record<string, unknown> | undefined)?.message
    if (res.status === 401 || res.status === 403) {
      throw new SocialOAuthError(
        typeof apiErr === 'string'
          ? `YouTube authorization expired or was revoked: ${apiErr}`
          : 'YouTube authorization expired or permissions were revoked.',
        res.status === 401 ? 'expired_token' : 'permission_denied',
        res.status,
      )
    }
    throw new SocialOAuthError(
      typeof apiErr === 'string'
        ? `YouTube channel lookup failed: ${apiErr}`
        : `YouTube channel lookup failed with HTTP ${res.status}.`,
      'provider_error',
      res.status,
    )
  }

  const items = Array.isArray(body?.items) ? body.items : []
  const first = items[0] as Record<string, unknown> | undefined
  const channelId = typeof first?.id === 'string' ? first.id : ''
  const snippet = (first?.snippet as Record<string, unknown> | undefined) ?? {}
  const channelTitle =
    typeof snippet.title === 'string' && snippet.title.trim()
      ? snippet.title.trim()
      : 'YouTube Channel'
  const customUrl =
    typeof snippet.customUrl === 'string' && snippet.customUrl.trim()
      ? snippet.customUrl.trim()
      : undefined
  const thumbs = snippet.thumbnails as
    | Record<string, { url?: string }>
    | undefined
  const thumbnailUrl =
    thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url

  if (!channelId) {
    throw new SocialOAuthError(
      'Authorized Google account does not have an active YouTube channel yet. Create a YouTube channel first and reconnect.',
      'unsupported_account',
      400,
    )
  }

  return { channelId, channelTitle, customUrl, thumbnailUrl }
}

export const youtubeOAuthAdapter: SocialProviderAdapter = {
  platform: 'youtube',
  platformName: 'YouTube',
  requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  requestedScopes: [YOUTUBE_READONLY_SCOPE],
  eligibilityNote:
    'Requires a Google account with an active YouTube channel.',
  reviewRequirementNote:
    'Local testing works with Google OAuth Test Users configured in Google Cloud Console. Production distribution requires Google OAuth verification.',

  getMissingEnvVars() {
    const { clientId, clientSecret } = getGoogleCreds()
    const missing: string[] = []
    if (!clientId) missing.push('GOOGLE_CLIENT_ID')
    if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET')
    return missing
  },

  isConfigured() {
    return this.getMissingEnvVars().length === 0
  },

  resolveRedirectUri(requestOrigin) {
    const { redirectUriOverride } = getGoogleCreds()
    if (redirectUriOverride) return redirectUriOverride
    return `${requestOrigin.replace(/\/+$/, '')}/api/social/oauth/youtube/callback`
  },

  buildAuthorizationUrl({ state, redirectUri, codeChallenge }) {
    const { clientId } = getGoogleCreds()
    if (!clientId) {
      throw new SocialOAuthError(
        'Missing GOOGLE_CLIENT_ID on the server.',
        'setup_required',
        400,
      )
    }
    const url = new URL(AUTH_ENDPOINT())
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', YOUTUBE_READONLY_SCOPE)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('include_granted_scopes', 'true')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  },

  async exchangeCodeForAccount({
    code,
    redirectUri,
    codeVerifier,
    signal,
  }): Promise<ExchangedSocialAccount> {
    const { clientId, clientSecret } = getGoogleCreds()
    if (!clientId || !clientSecret) {
      throw new SocialOAuthError(
        'Google OAuth credentials are not configured on the server.',
        'setup_required',
        400,
      )
    }

    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    })

    const res = await fetch(TOKEN_ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    })

    const body = await safeParseJson(res)
    if (!res.ok || !body?.access_token) {
      const errCode = typeof body?.error === 'string' ? body.error : ''
      const errDesc =
        typeof body?.error_description === 'string'
          ? body.error_description
          : `Google OAuth token exchange failed (HTTP ${res.status}).`
      throw new SocialOAuthError(
        errDesc,
        errCode === 'invalid_grant' ? 'invalid_code' : 'provider_error',
        res.status >= 400 ? res.status : 400,
      )
    }

    const accessToken = String(body.access_token)
    const refreshToken =
      typeof body.refresh_token === 'string' ? body.refresh_token : undefined
    const expiresAt = computeExpiresAtIso(body.expires_in)
    const grantedScopes =
      typeof body.scope === 'string'
        ? body.scope.split(/\s+/).filter(Boolean)
        : [YOUTUBE_READONLY_SCOPE]

    const channel = await fetchYouTubeChannelProfile(accessToken, signal)
    return {
      externalAccountId: channel.channelId,
      accountName: channel.channelTitle,
      usernameOrChannelId: channel.customUrl || channel.channelId,
      profileImageUrl: channel.thumbnailUrl,
      accountType: 'YouTube Channel',
      grantedScopes,
      accessToken,
      refreshToken,
      expiresAt,
      statusMessage: `Connected to YouTube channel "${channel.channelTitle}" (read-only identification).`,
    }
  },

  async verifyOrRefreshConnection(connection, signal) {
    const { clientId, clientSecret } = getGoogleCreds()
    const isNearExpiry =
      connection.expiresAt &&
      new Date(connection.expiresAt).getTime() - 60_000 <= Date.now()

    if (!isNearExpiry) {
      try {
        const profile = await fetchYouTubeChannelProfile(
          connection.accessToken,
          signal,
        )
        return {
          status: 'connected',
          statusMessage: `Verified active connection to "${profile.channelTitle}".`,
          accountName: profile.channelTitle,
          usernameOrChannelId: profile.customUrl || profile.channelId,
          profileImageUrl: profile.thumbnailUrl,
        }
      } catch (err) {
        if (!(err instanceof SocialOAuthError) || err.code !== 'expired_token') {
          return {
            status:
              err instanceof SocialOAuthError && err.code === 'revoked'
                ? 'expired'
                : 'error',
            statusMessage:
              err instanceof Error
                ? err.message
                : 'Failed to verify YouTube connection.',
          }
        }
      }
    }

    if (!connection.refreshToken || !clientId || !clientSecret) {
      return {
        status: 'expired',
        statusMessage:
          'YouTube access token expired and cannot be refreshed automatically. Reconnect your Google account.',
      }
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    })

    const res = await fetch(TOKEN_ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    })
    const body = await safeParseJson(res)
    if (!res.ok || !body?.access_token) {
      return {
        status: 'expired',
        statusMessage:
          typeof body?.error_description === 'string'
            ? `YouTube token expired or revoked: ${body.error_description}`
            : 'YouTube refresh token was rejected or revoked. Reconnect your account.',
      }
    }

    const nextAccessToken = String(body.access_token)
    const profile = await fetchYouTubeChannelProfile(nextAccessToken, signal)
    return {
      status: 'connected',
      statusMessage: `Refreshed active session for "${profile.channelTitle}".`,
      accessToken: nextAccessToken,
      expiresAt: computeExpiresAtIso(body.expires_in),
      accountName: profile.channelTitle,
      usernameOrChannelId: profile.customUrl || profile.channelId,
      profileImageUrl: profile.thumbnailUrl,
    }
  },

  async revokeConnection(connection, signal) {
    const tokenToRevoke = connection.refreshToken || connection.accessToken
    if (!tokenToRevoke) return { revokedAtProvider: false }
    try {
      const res = await fetch(
        `${REVOKE_ENDPOINT()}?token=${encodeURIComponent(tokenToRevoke)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal,
        },
      )
      return {
        revokedAtProvider: res.ok,
        note: res.ok
          ? 'Google OAuth token revoked cleanly.'
          : 'Removed local credentials (provider token may already be expired).',
      }
    } catch {
      return {
        revokedAtProvider: false,
        note: 'Removed local encrypted credentials (provider revocation request unreachable).',
      }
    }
  },

  getSecretValues() {
    const { clientSecret } = getGoogleCreds()
    return clientSecret ? [clientSecret] : []
  },
}
