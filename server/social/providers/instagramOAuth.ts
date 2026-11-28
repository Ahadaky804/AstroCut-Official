import {
  computeExpiresAtIso,
  safeParseJson,
  SocialOAuthError,
  type ExchangedSocialAccount,
  type SocialProviderAdapter,
} from '../types.ts'

const IG_AUTH_ENDPOINT = () =>
  process.env.META_INSTAGRAM_AUTH_URL?.trim() ||
  'https://api.instagram.com/oauth/authorize'
const IG_TOKEN_ENDPOINT = () =>
  process.env.META_INSTAGRAM_TOKEN_URL?.trim() ||
  'https://api.instagram.com/oauth/access_token'
const IG_GRAPH_ME_ENDPOINT = () =>
  process.env.META_INSTAGRAM_GRAPH_ME_URL?.trim() ||
  'https://graph.instagram.com/v21.0/me'

const INSTAGRAM_BASIC_SCOPE = 'instagram_business_basic'

function getMetaCreds() {
  return {
    appId: process.env.META_APP_ID?.trim() || '',
    appSecret: process.env.META_APP_SECRET?.trim() || '',
    redirectUriOverride: process.env.META_REDIRECT_URI?.trim() || '',
  }
}

async function fetchInstagramProfile(
  accessToken: string,
  signal?: AbortSignal,
): Promise<{
  accountId: string
  username: string
  displayName: string
  accountType: string
  profilePictureUrl?: string
}> {
  const url = `${IG_GRAPH_ME_ENDPOINT()}?fields=id,user_id,username,name,account_type,profile_picture_url`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    signal,
  })
  const body = await safeParseJson(res)

  if (!res.ok) {
    const errObj = body?.error as Record<string, unknown> | undefined
    const msg =
      typeof errObj?.message === 'string'
        ? errObj.message
        : `Instagram Graph API failed (HTTP ${res.status}).`
    if (res.status === 401 || Number(errObj?.code) === 190) {
      throw new SocialOAuthError(
        `Instagram authorization expired or revoked: ${msg}`,
        'expired_token',
        401,
      )
    }
    throw new SocialOAuthError(msg, 'provider_error', res.status)
  }

  const rawType = String(body?.account_type ?? '').trim().toUpperCase()
  const isProfessional =
    rawType === 'BUSINESS' ||
    rawType === 'MEDIA_CREATOR' ||
    rawType === 'CREATOR'

  if (!isProfessional) {
    throw new SocialOAuthError(
      `Unsupported Instagram account type "${rawType || 'PERSONAL'}". Meta's official Instagram API only supports Instagram Professional accounts (Business or Creator); personal Instagram accounts are not supported.`,
      'unsupported_account',
      400,
    )
  }

  const accountId = String(body?.user_id || body?.id || '').trim()
  const username = String(body?.username || '').trim()
  const displayName =
    typeof body?.name === 'string' && body.name.trim()
      ? body.name.trim()
      : username || 'Instagram Account'

  if (!accountId) {
    throw new SocialOAuthError(
      'Instagram Graph API did not return an eligible account ID.',
      'provider_error',
      502,
    )
  }

  return {
    accountId,
    username: username ? `@${username.replace(/^@/, '')}` : accountId,
    displayName,
    accountType: rawType === 'BUSINESS' ? 'Instagram Business' : 'Instagram Creator',
    profilePictureUrl:
      typeof body?.profile_picture_url === 'string'
        ? body.profile_picture_url
        : undefined,
  }
}

export const instagramOAuthAdapter: SocialProviderAdapter = {
  platform: 'instagram',
  platformName: 'Instagram',
  requiredEnvVars: ['META_APP_ID', 'META_APP_SECRET'],
  requestedScopes: [INSTAGRAM_BASIC_SCOPE],
  eligibilityNote:
    'Requires an Instagram Professional account (Business or Creator). Standard personal Instagram accounts are not supported by Meta’s current API (Instagram Basic Display was retired).',
  reviewRequirementNote:
    'During development, Instagram accounts must be added as App Testers in the Meta Developer Dashboard. Production use requires Meta App Review for instagram_business_basic.',

  getMissingEnvVars() {
    const { appId, appSecret } = getMetaCreds()
    const missing: string[] = []
    if (!appId) missing.push('META_APP_ID')
    if (!appSecret) missing.push('META_APP_SECRET')
    return missing
  },

  isConfigured() {
    return this.getMissingEnvVars().length === 0
  },

  resolveRedirectUri(requestOrigin) {
    const { redirectUriOverride } = getMetaCreds()
    if (redirectUriOverride) return redirectUriOverride
    return `${requestOrigin.replace(/\/+$/, '')}/api/social/oauth/instagram/callback`
  },

  buildAuthorizationUrl({ state, redirectUri }) {
    const { appId } = getMetaCreds()
    if (!appId) {
      throw new SocialOAuthError(
        'Missing META_APP_ID on the server.',
        'setup_required',
        400,
      )
    }
    const url = new URL(IG_AUTH_ENDPOINT())
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', INSTAGRAM_BASIC_SCOPE)
    url.searchParams.set('state', state)
    return url.toString()
  },

  async exchangeCodeForAccount({
    code,
    redirectUri,
    signal,
  }): Promise<ExchangedSocialAccount> {
    const { appId, appSecret } = getMetaCreds()
    if (!appId || !appSecret) {
      throw new SocialOAuthError(
        'Meta / Instagram OAuth credentials are not configured on the server.',
        'setup_required',
        400,
      )
    }

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    })

    const res = await fetch(IG_TOKEN_ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    })
    const body = await safeParseJson(res)
    if (!res.ok || !body?.access_token) {
      const msg =
        typeof body?.error_message === 'string'
          ? body.error_message
          : typeof (body?.error as Record<string, unknown> | undefined)?.message ===
              'string'
            ? String((body?.error as Record<string, unknown>).message)
            : `Instagram OAuth token exchange failed (HTTP ${res.status}).`
      throw new SocialOAuthError(
        msg,
        /code|expired/i.test(msg) ? 'invalid_code' : 'provider_error',
        res.status >= 400 ? res.status : 400,
      )
    }

    const accessToken = String(body.access_token)
    const expiresAt = computeExpiresAtIso(body.expires_in)
    const grantedScopes =
      typeof body.permissions === 'string'
        ? body.permissions.split(/[,\s]+/).filter(Boolean)
        : [INSTAGRAM_BASIC_SCOPE]

    const profile = await fetchInstagramProfile(accessToken, signal)

    return {
      externalAccountId: profile.accountId,
      accountName: profile.displayName,
      usernameOrChannelId: profile.username,
      profileImageUrl: profile.profilePictureUrl,
      accountType: profile.accountType,
      grantedScopes,
      accessToken,
      expiresAt,
      statusMessage: `Connected to ${profile.accountType} "${profile.username}".`,
    }
  },

  async verifyOrRefreshConnection(connection, signal) {
    try {
      const profile = await fetchInstagramProfile(connection.accessToken, signal)
      return {
        status: 'connected',
        statusMessage: `Verified ${profile.accountType} (${profile.username}).`,
        accountName: profile.displayName,
        usernameOrChannelId: profile.username,
        profileImageUrl: profile.profilePictureUrl,
      }
    } catch (err) {
      return {
        status:
          err instanceof SocialOAuthError && err.code === 'expired_token'
            ? 'expired'
            : 'error',
        statusMessage:
          err instanceof Error
            ? err.message
            : 'Unable to verify Instagram Professional account.',
      }
    }
  },

  async revokeConnection(connection, signal) {
    if (!connection.accessToken) return { revokedAtProvider: false }
    try {
      const url = `${IG_GRAPH_ME_ENDPOINT()}/permissions`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${connection.accessToken}` },
        signal,
      })
      return {
        revokedAtProvider: res.ok,
        note: res.ok
          ? 'Instagram app permissions revoked cleanly.'
          : 'Removed local encrypted credentials (token may already be expired).',
      }
    } catch {
      return {
        revokedAtProvider: false,
        note: 'Removed local encrypted credentials.',
      }
    }
  },

  getSecretValues() {
    const { appSecret } = getMetaCreds()
    return appSecret ? [appSecret] : []
  },
}
