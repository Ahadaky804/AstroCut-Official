import {
  computeExpiresAtIso,
  safeParseJson,
  SocialOAuthError,
  type ExchangedSocialAccount,
  type SocialProviderAdapter,
} from '../types.ts'

const TIKTOK_AUTH_ENDPOINT = () =>
  process.env.TIKTOK_OAUTH_AUTH_URL?.trim() ||
  'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_TOKEN_ENDPOINT = () =>
  process.env.TIKTOK_OAUTH_TOKEN_URL?.trim() ||
  'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_USER_INFO_ENDPOINT = () =>
  process.env.TIKTOK_USER_INFO_URL?.trim() ||
  'https://open.tiktokapis.com/v2/user/info/'
const TIKTOK_REVOKE_ENDPOINT = () =>
  process.env.TIKTOK_OAUTH_REVOKE_URL?.trim() ||
  'https://open.tiktokapis.com/v2/oauth/revoke/'

const TIKTOK_BASIC_SCOPE = 'user.info.basic'

function getTikTokCreds() {
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY?.trim() || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim() || '',
    redirectUriOverride: process.env.TIKTOK_REDIRECT_URI?.trim() || '',
  }
}

async function fetchTikTokUserInfo(
  accessToken: string,
  signal?: AbortSignal,
): Promise<{
  openId: string
  displayName: string
  username?: string
  avatarUrl?: string
}> {
  const url = `${TIKTOK_USER_INFO_ENDPOINT()}?fields=open_id,union_id,avatar_url,display_name,username`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    signal,
  })
  const body = await safeParseJson(res)
  const errObj = body?.error as Record<string, unknown> | undefined
  const errCode = typeof errObj?.code === 'string' ? errObj.code : 'ok'

  if (!res.ok || (errCode && errCode !== 'ok')) {
    const errMsg =
      typeof errObj?.message === 'string'
        ? errObj.message
        : `TikTok user info request failed (HTTP ${res.status}).`
    if (res.status === 401 || /token|expired|revoked/i.test(errCode)) {
      throw new SocialOAuthError(
        `TikTok session expired or revoked: ${errMsg}`,
        'expired_token',
        401,
      )
    }
    throw new SocialOAuthError(errMsg, 'provider_error', res.status || 400)
  }

  const data = (body?.data as Record<string, unknown> | undefined) ?? {}
  const user = (data.user as Record<string, unknown> | undefined) ?? data
  const openId = String(user.open_id || '').trim()
  const displayName =
    typeof user.display_name === 'string' && user.display_name.trim()
      ? user.display_name.trim()
      : 'TikTok Account'
  const username =
    typeof user.username === 'string' && user.username.trim()
      ? `@${user.username.trim().replace(/^@/, '')}`
      : undefined
  const avatarUrl =
    typeof user.avatar_url === 'string' && user.avatar_url.trim()
      ? user.avatar_url.trim()
      : undefined

  if (!openId) {
    throw new SocialOAuthError(
      'TikTok profile endpoint did not return an open_id.',
      'provider_error',
      502,
    )
  }

  return { openId, displayName, username, avatarUrl }
}

export const tiktokOAuthAdapter: SocialProviderAdapter = {
  platform: 'tiktok',
  platformName: 'TikTok',
  requiredEnvVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  requestedScopes: [TIKTOK_BASIC_SCOPE],
  eligibilityNote:
    'Requires a TikTok account authorized in a registered TikTok Login Kit v2 app (Sandbox or Production).',
  reviewRequirementNote:
    'Local testing works using TikTok Developer Sandbox target users. Public availability requires TikTok App Review for Login Kit.',

  getMissingEnvVars() {
    const { clientKey, clientSecret } = getTikTokCreds()
    const missing: string[] = []
    if (!clientKey) missing.push('TIKTOK_CLIENT_KEY')
    if (!clientSecret) missing.push('TIKTOK_CLIENT_SECRET')
    return missing
  },

  isConfigured() {
    return this.getMissingEnvVars().length === 0
  },

  resolveRedirectUri(requestOrigin) {
    const { redirectUriOverride } = getTikTokCreds()
    if (redirectUriOverride) return redirectUriOverride
    return `${requestOrigin.replace(/\/+$/, '')}/api/social/oauth/tiktok/callback`
  },

  buildAuthorizationUrl({ state, redirectUri, codeChallenge }) {
    const { clientKey } = getTikTokCreds()
    if (!clientKey) {
      throw new SocialOAuthError(
        'Missing TIKTOK_CLIENT_KEY on the server.',
        'setup_required',
        400,
      )
    }
    const url = new URL(TIKTOK_AUTH_ENDPOINT())
    url.searchParams.set('client_key', clientKey)
    url.searchParams.set('scope', TIKTOK_BASIC_SCOPE)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', redirectUri)
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
    const { clientKey, clientSecret } = getTikTokCreds()
    if (!clientKey || !clientSecret) {
      throw new SocialOAuthError(
        'TikTok OAuth credentials are not configured on the server.',
        'setup_required',
        400,
      )
    }

    const params = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    })

    const res = await fetch(TIKTOK_TOKEN_ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    })
    const body = await safeParseJson(res)
    if (!res.ok || !body?.access_token) {
      const desc =
        typeof body?.error_description === 'string'
          ? body.error_description
          : typeof body?.error === 'string'
            ? body.error
            : `TikTok OAuth token exchange failed (HTTP ${res.status}).`
      throw new SocialOAuthError(
        desc,
        /invalid|expired|grant/i.test(desc) ? 'invalid_code' : 'provider_error',
        res.status >= 400 ? res.status : 400,
      )
    }

    const accessToken = String(body.access_token)
    const refreshToken =
      typeof body.refresh_token === 'string' ? body.refresh_token : undefined
    const expiresAt = computeExpiresAtIso(body.expires_in)
    const grantedScopes =
      typeof body.scope === 'string'
        ? body.scope.split(/[,\s]+/).filter(Boolean)
        : [TIKTOK_BASIC_SCOPE]

    const user = await fetchTikTokUserInfo(accessToken, signal)
    return {
      externalAccountId: user.openId,
      accountName: user.displayName,
      usernameOrChannelId: user.username || user.openId,
      profileImageUrl: user.avatarUrl,
      accountType: 'TikTok Account',
      grantedScopes,
      accessToken,
      refreshToken,
      expiresAt,
      statusMessage: `Connected to TikTok account "${user.displayName}".`,
    }
  },

  async verifyOrRefreshConnection(connection, signal) {
    const { clientKey, clientSecret } = getTikTokCreds()
    const isNearExpiry =
      connection.expiresAt &&
      new Date(connection.expiresAt).getTime() - 60_000 <= Date.now()

    if (!isNearExpiry) {
      try {
        const profile = await fetchTikTokUserInfo(connection.accessToken, signal)
        return {
          status: 'connected',
          statusMessage: `Verified active TikTok session (${profile.displayName}).`,
          accountName: profile.displayName,
          usernameOrChannelId: profile.username || profile.openId,
          profileImageUrl: profile.avatarUrl,
        }
      } catch (err) {
        if (!(err instanceof SocialOAuthError) || err.code !== 'expired_token') {
          return {
            status: 'error',
            statusMessage:
              err instanceof Error
                ? err.message
                : 'Failed to verify TikTok connection.',
          }
        }
      }
    }

    if (!connection.refreshToken || !clientKey || !clientSecret) {
      return {
        status: 'expired',
        statusMessage:
          'TikTok access token expired. Reconnect your TikTok account.',
      }
    }

    const params = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    })

    const res = await fetch(TIKTOK_TOKEN_ENDPOINT(), {
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
            ? `TikTok token expired or revoked: ${body.error_description}`
            : 'TikTok refresh token rejected or revoked. Reconnect your account.',
      }
    }

    const nextAccess = String(body.access_token)
    const profile = await fetchTikTokUserInfo(nextAccess, signal)
    return {
      status: 'connected',
      statusMessage: `Refreshed active TikTok session (${profile.displayName}).`,
      accessToken: nextAccess,
      refreshToken:
        typeof body.refresh_token === 'string'
          ? body.refresh_token
          : connection.refreshToken,
      expiresAt: computeExpiresAtIso(body.expires_in),
      accountName: profile.displayName,
      usernameOrChannelId: profile.username || profile.openId,
      profileImageUrl: profile.avatarUrl,
    }
  },

  async revokeConnection(connection, signal) {
    const { clientKey, clientSecret } = getTikTokCreds()
    if (!clientKey || !clientSecret || !connection.accessToken) {
      return { revokedAtProvider: false }
    }
    try {
      const params = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        token: connection.accessToken,
      })
      const res = await fetch(TIKTOK_REVOKE_ENDPOINT(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal,
      })
      return {
        revokedAtProvider: res.ok,
        note: res.ok
          ? 'TikTok OAuth token revoked cleanly.'
          : 'Removed local encrypted credentials (provider token may already be expired).',
      }
    } catch {
      return {
        revokedAtProvider: false,
        note: 'Removed local encrypted credentials.',
      }
    }
  },

  getSecretValues() {
    const { clientSecret } = getTikTokCreds()
    return clientSecret ? [clientSecret] : []
  },
}
